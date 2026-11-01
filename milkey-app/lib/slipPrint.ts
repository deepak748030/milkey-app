/**
 * Shared thermal-printer payload builders for register & selling payment slips.
 *
 * Labels are localized via `getSlipLabels()` which reads the current app
 * language from `languageStore`.
 */
import { brandedFooter, brandedHeader, twoCol, line as fmtLine } from './printFormat';
import { left as fmtLeft, center as fmtCenter } from './printFormat';
import type { Payment, MemberPayment, PrintSettings, Farmer, Member } from './milkeyApi';
import { getThermalSlipLabels as getSlipLabels } from './printTranslations';

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

/** Helper short date DD/MM/YY for joint slip matching image */
function formatDateShortYY(dateStr?: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
}
function formatDateShortDMShift(dateStr?: string, shift?: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const s = shift === 'evening' ? 'E' : shift === 'morning' ? 'M' : '';
    return s ? `${dd}/${mm}-${s}` : `${dd}/${mm}`;
}

/** Joint Collection + Register payment slip - exactly like image: collection entries + payment slip */
export function buildJointCollectionPaymentSlipPayload(
    p: Payment,
    collections: { date: string; shift?: string; quantity: number; fat?: number; snf?: number; rate: number; amount: number }[],
    printSettings: PrintSettings | null | undefined,
): string {
    const t = getSlipLabels();
    let payload = '';
    // Dairy header - big dairy name, address, PH
    payload += header(printSettings, printSettings?.dairyName || 'YOUR DAIRY NAME');
    // Farmer info - Code, Name, Date period, Address
    payload += fmtLeft(`${t.code} :  ${p.farmer?.code || '-'}`);
    payload += fmtLeft(`${t.name} :  ${p.farmer?.name || '-'}`);
    const ds = formatDateShortYY(p.periodStart || p.date);
    const de = formatDateShortYY(p.periodEnd || p.date);
    payload += fmtLeft(`${t.date} :  ${ds} -${de}`);
    const addr = (printSettings?.address || '').trim();
    if (addr) payload += fmtLeft(`Address :  ${addr}`);
    payload += fmtLine();
    // Collection Entries header
    payload += center(`: ${t.milkEntries || 'Collection Entries'} :`, { bold: true });
    payload += fmtLine();
    // Table header
    payload += left(`Date/S   Qty  FAT  SNF  Rate Amount`);
    payload += fmtLine();
    // Rows
    if (collections.length === 0) {
        payload += center('- No entries -');
    } else {
        for (const c of collections) {
            const dateS = formatDateShortDMShift(c.date, c.shift);
            const qty = (c.quantity ?? 0).toFixed(1);
            const fat = (c.fat ?? 0).toFixed(1);
            const snf = (c.snf ?? 0).toFixed(1);
            const rate = (c.rate ?? 0).toFixed(1);
            const amt = (c.amount ?? 0).toFixed(1);
            // compact columns to fit 32 chars: DateS(7) Qty(4) FAT(4) SNF(4) Rate(5) Amt(5)
            const lineTxt = `${dateS.padEnd(7)} ${qty.padStart(3)} ${fat.padStart(3)} ${snf.padStart(3)} ${rate.padStart(4)} ${amt.padStart(4)}`;
            payload += left(lineTxt);
        }
    }
    payload += fmtLine();
    // Totals
    const totalQty = collections.reduce((s, c) => s + (c.quantity || 0), 0);
    const totalAmt = collections.reduce((s, c) => s + (c.amount || 0), 0);
    const avgRate = totalQty > 0 ? totalAmt / totalQty : 0;
    // Use same values as payment's total if collections empty? fallback to payment total
    const displayQty = collections.length ? totalQty : (0);
    const displayAmt = collections.length ? totalAmt : (p.totalMilkAmount || 0);
    const displayAvg = collections.length ? avgRate : 0;
    payload += twoCol(`${t.totalQty} :`, displayQty.toFixed(2));
    payload += twoCol(`${t.averageRate} :`, displayAvg.toFixed(2));
    payload += twoCol(`${t.totalAmount} :`, displayAmt.toFixed(2));
    payload += fmtLine();
    // Payment Slip section
    payload += center(`${t.paymentSlip} :`, { bold: true });
    payload += twoCol(`${t.lastPayment} :`, (p.previousBalance || 0).toFixed(0));
    // Milk Amount = the same equation the Payment screen shows:
    //   <collection amount of the dates> + <amount typed by the user> = <total>
    // The typed part is not stored separately, so it is derived from the saved total.
    const purchaseAmountValue = totalAmt;
    const savedTotalValue = p.totalMilkAmount || 0;
    const inputAmountValue = Math.max(0, savedTotalValue - purchaseAmountValue);
    const milkAmountValue = savedTotalValue > 0 ? savedTotalValue : purchaseAmountValue;
    payload += twoCol(
        `${t.milkAmount} :`,
        `${purchaseAmountValue.toFixed(0)} + ${inputAmountValue.toFixed(0)} = ${milkAmountValue.toFixed(0)}`,
    );
    // Advance / Total payable exactly like the Payment screen; if an older payment has
    // no stored advance value, the settled advances of the payment are summed instead.
    const settledAdvances: any[] = Array.isArray((p as any).settledAdvances) ? (p as any).settledAdvances : [];
    const advanceFromRows = settledAdvances.reduce(
        (sum, a: any) => sum + (Number(a?.settledAmount) || Number(a?.amount) || 0),
        0,
    );
    const advanceValue = (p.totalAdvanceDeduction || 0) > 0 ? (p.totalAdvanceDeduction || 0) : advanceFromRows;
    const payableValue =
        (p.netPayable || 0) !== 0
            ? (p.netPayable || 0)
            : milkAmountValue - advanceValue + (p.previousBalance || 0);
    payload += twoCol(`${t.advanceProduct} :`, advanceValue.toFixed(0));
    payload += twoCol(`${t.totalPayable} :`, payableValue.toFixed(0));
    payload += twoCol(`${t.paidAmount} :`, (p.amount || 0).toFixed(0));
    payload += fmtLine();
    payload += twoCol(`${t.closingBal} :`, (p.closingBalance || 0).toFixed(0), { bold: true });
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

/** Thermal payload for the farmers list (Farmer tab Print button). */
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
