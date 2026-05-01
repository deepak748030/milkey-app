/**
 * Shared thermal-printer payload builders for register & selling payment slips.
 *
 * Labels are localized via `getSlipLabels()` which reads the current app
 * language from `languageStore`.
 */
import { brandedFooter, brandedHeader, twoCol, line as fmtLine } from './printFormat';
import { left as fmtLeft, center as fmtCenter } from './printFormat';
import type { Payment, MemberPayment, PrintSettings, Farmer, Member } from './milkeyApi';
import { getSlipLabels } from './printTranslations';

const formatDateDDMMYYYY = (dateStr?: string): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};

function header(printSettings: PrintSettings | null | undefined, fallback: string): string {
    return brandedHeader({
        dairyName: printSettings?.dairyName || fallback,
        address: printSettings?.address || '',
        mobileNumber: printSettings?.mobileNumber || '',
        showMobileOnReceipt: printSettings?.showMobileOnReceipt !== false,
    });
}

/** Thermal payload for a register (farmer) payment slip. */
export function buildRegisterPaymentSlipPayload(
    p: Payment,
    printSettings: PrintSettings | null | undefined,
): string {
    const t = getSlipLabels();
    let payload = '';
    payload += header(printSettings, t.paymentSlip);
    payload += fmtLeft(`${t.from}:  ${formatDateDDMMYYYY(p.periodStart || p.date)}`);
    payload += fmtLeft(`${t.till}:  ${formatDateDDMMYYYY(p.periodEnd || p.date)}`);
    payload += fmtLeft(`${t.code}:  ${p.farmer?.code || '-'}`);
    payload += fmtLeft(`${t.name}:  ${p.farmer?.name || '-'}`);
    payload += fmtLine();
    payload += twoCol(`${t.lastPayment}:`, (p.previousBalance || 0).toFixed(0));
    payload += twoCol(`${t.milkAmount}:`, (p.totalMilkAmount || 0).toFixed(0));
    payload += twoCol(`${t.advanceProduct}:`, (p.totalAdvanceDeduction || 0).toFixed(0));
    payload += twoCol(`${t.totalPayable}:`, (p.netPayable || 0).toFixed(0));
    payload += twoCol(`${t.paidAmount}:`, (p.amount || 0).toFixed(0));
    payload += fmtLine();
    payload += twoCol(`${t.closingBal}:`, (p.closingBalance || 0).toFixed(0), { bold: true });
    payload += brandedFooter(printSettings?.extraInfo?.trim() || t.thankYou);
    return payload;
}

/** Thermal payload for a selling (member) payment slip. */
export function buildSellingPaymentSlipPayload(
    p: MemberPayment,
    printSettings: PrintSettings | null | undefined,
): string {
    const t = getSlipLabels();
    const milkQty = (Number(p.totalQuantity) || 0).toFixed(1);
    const milkRate = (Number(p.milkRate) || 0).toFixed(2);

    let payload = '';
    payload += header(printSettings, t.paymentSlip);
    payload += fmtLeft(`${t.from}:    ${formatDateDDMMYYYY(p.periodStart || p.date)}`);
    payload += fmtLeft(`${t.till}:    ${formatDateDDMMYYYY(p.periodEnd || p.date)}`);
    payload += fmtLeft(`${t.member}:  ${p.member?.name || '-'}`);
    payload += fmtLine();
    payload += twoCol(`${t.lastPayment}:`, (p.previousBalance || 0).toFixed(0));
    payload += twoCol(`${t.qty}:`, milkQty + ' L');
    payload += twoCol(`${t.rate}:`, 'Rs ' + milkRate + '/L');
    payload += twoCol(`${t.milkAmount}:`, (p.totalSellAmount || 0).toFixed(0));
    payload += twoCol(`${t.totalPayable}:`, (p.netPayable || 0).toFixed(0));
    payload += twoCol(`${t.paidAmount}:`, (p.amount || 0).toFixed(0));
    payload += fmtLine();
    payload += twoCol(`${t.closingBal}:`, (p.closingBalance || 0).toFixed(0), { bold: true });
    payload += brandedFooter(printSettings?.extraInfo?.trim() || t.thankYou);
    return payload;
}

/** Thermal payload for the farmers list (R-Farmer tab Print button). */
export function buildFarmersListPayload(
    farmers: Farmer[],
    printSettings: PrintSettings | null | undefined,
): string {
    const t = getSlipLabels();
    let payload = '';
    payload += header(printSettings, t.paymentSlip);
    payload += fmtCenter(t.farmersList, { bold: true });
    payload += fmtLine();
    payload += twoCol(`${t.code}  ${t.name}`, t.mobile, { bold: true });
    payload += fmtLine();
    farmers.forEach((f) => {
        const code = String(f.code ?? '-');
        const name = String(f.name ?? '-');
        const mobile = String(f.mobile ?? '-');
        payload += twoCol(`${code}  ${name}`, mobile);
    });
    payload += fmtLine();
    payload += twoCol(`${t.total}:`, String(farmers.length), { bold: true });
    payload += brandedFooter(printSettings?.extraInfo?.trim() || t.thankYou);
    return payload;
}

/** Thermal payload for the members list (Selling Member tab Print button). */
export function buildMembersListPayload(
    members: Member[],
    printSettings: PrintSettings | null | undefined,
): string {
    const t = getSlipLabels();
    let payload = '';
    payload += header(printSettings, t.paymentSlip);
    payload += fmtCenter(t.membersList, { bold: true });
    payload += fmtLine();
    members.forEach((m, idx) => {
        payload += twoCol(`${idx + 1}. ${m.name ?? '-'}`, `Rs ${Number(m.ratePerLiter || 0).toFixed(2)}/L`);
        if (m.mobile) payload += fmtLeft(`   ${t.mobile}: ${m.mobile}`);
    });
    payload += fmtLine();
    payload += twoCol(`${t.total}:`, String(members.length), { bold: true });
    payload += brandedFooter(printSettings?.extraInfo?.trim() || t.thankYou);
    return payload;
}
