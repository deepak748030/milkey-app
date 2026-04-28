/**
 * Shared thermal-printer payload builders for register & selling payment slips.
 *
 * These mirror the formatting in the slip preview screens so the same receipt
 * layout is used whether printing directly from the tab or from the slip page.
 */
import { brandedFooter, brandedHeader, twoCol, labelValueWrap, line as fmtLine, feed } from './printFormat';
import { left as fmtLeft, center as fmtCenter } from './printFormat';
import type { Payment, MemberPayment, PrintSettings, Farmer, Member } from './milkeyApi';

const formatDateDDMMYYYY = (dateStr?: string): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};

function header(printSettings: PrintSettings | null | undefined): string {
    return brandedHeader({
        dairyName: printSettings?.dairyName || 'Payment Slip',
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
    let payload = '';
    payload += header(printSettings);
    payload += twoCol('From:', formatDateDDMMYYYY(p.periodStart || p.date));
    payload += twoCol('Till:', formatDateDDMMYYYY(p.periodEnd || p.date));
    payload += twoCol('Code:', p.farmer?.code || '-');
    payload += labelValueWrap('Name:', p.farmer?.name || '-');
    payload += feed(1);
    payload += fmtLine();
    payload += twoCol('Last Payment:', (p.previousBalance || 0).toFixed(0));
    payload += twoCol('Milk Amount:', (p.totalMilkAmount || 0).toFixed(0));
    payload += twoCol('Advance/Prod:', (p.totalAdvanceDeduction || 0).toFixed(0));
    payload += twoCol('Total Payable:', (p.netPayable || 0).toFixed(0));
    payload += twoCol('Paid Amount:', (p.amount || 0).toFixed(0));
    payload += fmtLine();
    payload += twoCol('Closing Bal:', (p.closingBalance || 0).toFixed(0), { bold: true });
    payload += brandedFooter(printSettings?.extraInfo?.trim());
    return payload;
}

/** Thermal payload for a selling (member) payment slip. */
export function buildSellingPaymentSlipPayload(
    p: MemberPayment,
    printSettings: PrintSettings | null | undefined,
): string {
    const milkQty = (Number(p.totalQuantity) || 0).toFixed(1);
    const milkRate = (Number(p.milkRate) || 0).toFixed(2);

    let payload = '';
    payload += header(printSettings);
    payload += twoCol('From:', formatDateDDMMYYYY(p.periodStart || p.date));
    payload += twoCol('Till:', formatDateDDMMYYYY(p.periodEnd || p.date));
    payload += labelValueWrap('Member:', p.member?.name || '-');
    payload += feed(1);
    payload += fmtLine();
    payload += twoCol('Last Payment:', (p.previousBalance || 0).toFixed(0));
    payload += twoCol('Milk Qty:', milkQty + ' L');
    payload += twoCol('Milk Rate:', 'Rs ' + milkRate + '/L');
    payload += twoCol('Milk Amount:', (p.totalSellAmount || 0).toFixed(0));
    payload += twoCol('Total Payable:', (p.netPayable || 0).toFixed(0));
    payload += twoCol('Paid Amount:', (p.amount || 0).toFixed(0));
    payload += fmtLine();
    payload += twoCol('Closing Bal:', (p.closingBalance || 0).toFixed(0), { bold: true });
    payload += brandedFooter(printSettings?.extraInfo?.trim());
    return payload;
}

/** Thermal payload for the farmers list (R-Farmer tab Print button). */
export function buildFarmersListPayload(
    farmers: Farmer[],
    printSettings: PrintSettings | null | undefined,
): string {
    let payload = '';
    payload += header(printSettings);
    payload += fmtCenter('Farmers List', { bold: true });
    payload += fmtLine();
    payload += twoCol('Code  Name', 'Mobile', { bold: true });
    payload += fmtLine();
    farmers.forEach((f) => {
        const code = String(f.code ?? '-');
        const name = String(f.name ?? '-');
        const mobile = String(f.mobile ?? '-');
        payload += twoCol(`${code}  ${name}`, mobile);
    });
    payload += fmtLine();
    payload += twoCol('Total:', String(farmers.length), { bold: true });
    payload += brandedFooter(printSettings?.extraInfo?.trim());
    return payload;
}

/** Thermal payload for the members list (Selling Member tab Print button). */
export function buildMembersListPayload(
    members: Member[],
    printSettings: PrintSettings | null | undefined,
): string {
    let payload = '';
    payload += header(printSettings);
    payload += fmtCenter('Members List', { bold: true });
    payload += fmtLine();
    members.forEach((m, idx) => {
        payload += twoCol(`${idx + 1}. ${m.name ?? '-'}`, `Rs ${Number(m.ratePerLiter || 0).toFixed(2)}/L`);
        if (m.mobile) payload += fmtLeft(`   Ph: ${m.mobile}`);
    });
    payload += fmtLine();
    payload += twoCol('Total:', String(members.length), { bold: true });
    payload += brandedFooter(printSettings?.extraInfo?.trim());
    return payload;
}
