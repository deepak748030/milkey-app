// File: src/lib/userExport.ts
// Export users data to CSV / Excel / PDF / Text / JSON for marketing & reporting.
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { User } from './api'

export type ExportFormat = 'csv' | 'xlsx' | 'pdf' | 'txt' | 'json'

const fmtDate = (v?: string) => {
    if (!v) return ''
    const d = new Date(v)
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 19).replace('T', ' ')
}

interface UserRow {
    Name: string
    Email: string
    Phone: string
    Role: string
    Status: string
    Verified: string
    Address: string
    'Referral Code': string
    'Referral Earnings': number
    'Total Referral Earnings': number
    'Joined At': string
    'Last Login': string
    ID: string
}

function toRows(users: User[]): UserRow[] {
    return users.map((u) => ({
        Name: u.name || '',
        Email: u.email || '',
        Phone: u.phone || '',
        Role: u.role || 'owner',
        Status: u.isBlocked ? 'Blocked' : 'Active',
        Verified: u.isVerified ? 'Yes' : 'No',
        Address: u.address || '',
        'Referral Code': u.referralCode || '',
        'Referral Earnings': u.referralEarnings || 0,
        'Total Referral Earnings': u.totalReferralEarnings || 0,
        'Joined At': fmtDate(u.createdAt),
        'Last Login': fmtDate(u.lastLogin),
        ID: u._id,
    }))
}

function timestamp() {
    return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
}

function baseName(filterLabel: string) {
    return `milkey-users-${filterLabel}-${timestamp()}`
}

export function exportUsers(users: User[], format: ExportFormat, filterLabel = 'all') {
    const rows = toRows(users)
    const fname = baseName(filterLabel)

    if (format === 'json') {
        const blob = new Blob([JSON.stringify(users, null, 2)], { type: 'application/json;charset=utf-8' })
        saveAs(blob, `${fname}.json`)
        return
    }

    if (format === 'csv') {
        const ws = XLSX.utils.json_to_sheet(rows)
        const csv = XLSX.utils.sheet_to_csv(ws)
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
        saveAs(blob, `${fname}.csv`)
        return
    }

    if (format === 'xlsx') {
        const ws = XLSX.utils.json_to_sheet(rows)
        // Auto column widths
        const cols = Object.keys(rows[0] || { Name: '' }).map((k) => ({
            wch: Math.min(
                40,
                Math.max(
                    k.length + 2,
                    ...rows.map((r) => String((r as any)[k] ?? '').length + 2)
                )
            ),
        }))
        ws['!cols'] = cols
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Users')
        XLSX.writeFile(wb, `${fname}.xlsx`)
        return
    }

    if (format === 'txt') {
        const lines: string[] = []
        lines.push(`Milkey Users Export — ${filterLabel} — ${new Date().toLocaleString()}`)
        lines.push(`Total: ${rows.length}`)
        lines.push('='.repeat(80))
        rows.forEach((r, i) => {
            lines.push(`#${i + 1}  ${r.Name}  (${r.Status})`)
            lines.push(`   Phone: ${r.Phone}   Email: ${r.Email}`)
            lines.push(`   Role: ${r.Role}   Joined: ${r['Joined At']}`)
            if (r.Address) lines.push(`   Address: ${r.Address}`)
            if (r['Referral Code']) lines.push(`   Referral: ${r['Referral Code']}`)
            lines.push('')
        })
        const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
        saveAs(blob, `${fname}.txt`)
        return
    }

    if (format === 'pdf') {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
        doc.setFontSize(14)
        doc.text(`Milkey Users — ${filterLabel}`, 40, 30)
        doc.setFontSize(9)
        doc.text(`Exported: ${new Date().toLocaleString()}   Total: ${rows.length}`, 40, 46)

        const head = [['Name', 'Phone', 'Email', 'Role', 'Status', 'Joined']]
        const body = rows.map((r) => [r.Name, r.Phone, r.Email, r.Role, r.Status, r['Joined At']])

        autoTable(doc, {
            head,
            body,
            startY: 60,
            styles: { fontSize: 8, cellPadding: 4 },
            headStyles: { fillColor: [37, 99, 235], textColor: 255 },
            alternateRowStyles: { fillColor: [245, 247, 250] },
            margin: { left: 40, right: 40 },
        })

        doc.save(`${fname}.pdf`)
        return
    }
}
