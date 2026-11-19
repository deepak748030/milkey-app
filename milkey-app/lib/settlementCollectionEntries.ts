import type { Payment } from './milkeyApi';

export interface SettlementCollectionEntry {
    id: string;
    date?: string;
    shift?: string;
    quantity?: number;
    fat?: number;
    snf?: number;
    rate?: number;
    bonusAmount?: number;
    amount?: number;
}

// Only use rows actually saved on this payment. Do not substitute other entries
// merely because they fall in the same date range.
export function settlementCollectionEntries(payment: Payment) {
    const snapshot = Array.isArray(payment.collectionSnapshots);
    const source: unknown[] = snapshot ? payment.collectionSnapshots! : (payment.settledCollections || []);
    const objects = source.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object');
    const number = (value: unknown): number | undefined => {
        if (value == null || value === '' || !Number.isFinite(Number(value))) return undefined;
        return Number(value);
    };
    const rows: SettlementCollectionEntry[] = objects.map((row, index) => ({
        id: String(row.id || row._id || index),
        date: typeof row.date === 'string' ? row.date : undefined,
        shift: typeof row.shift === 'string' ? row.shift : undefined,
        quantity: number(row.quantity), fat: number(row.fat), snf: number(row.snf),
        rate: number(row.rate), bonusAmount: number(row.bonusAmount), amount: number(row.amount),
    }));
    const total = (field: 'quantity' | 'amount' | 'bonusAmount'): number | null => {
        if ((!snapshot && rows.length === 0) || rows.length !== source.length || rows.some(row => row[field] == null)) return null;
        return rows.reduce((sum, row) => sum + row[field]!, 0);
    };
    return { snapshot, rows, quantity: total('quantity'), amount: total('amount'), bonus: total('bonusAmount') };
}
