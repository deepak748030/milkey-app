import { brandedHeader, brandedFooter, brandedHeaderHtml, brandedFooterHtml } from '@/lib/printFormat';
import type { PrintSettings } from '@/lib/milkeyApi';

// Reusable receipt builders - ponytail DRY for purchase/register/selling reports
export function buildHtmlReceipt(title: string, tableHtml: string, settings?: PrintSettings | null, extraInfo?: string) {
  return `${brandedHeaderHtml(settings)}<h2 style="text-align:center;margin:8px 0">${title}</h2>${tableHtml}${brandedFooterHtml(settings, extraInfo)}`;
}
export function buildThermalReceipt(title: string, lines: string, settings?: PrintSettings | null, extraInfo?: string) {
  return `${brandedHeader({ ...settings, title } as any)}${lines}${brandedFooter(extraInfo)}`;
}
export function csvEscape(v: any) { const s = String(v ?? ''); return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s; }
export function buildCsv(rows: string[][]) { return rows.map(r => r.map(csvEscape).join(',')).join('\n'); }
