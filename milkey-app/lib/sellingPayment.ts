// Existing selling payments without a saved effect were calculated as deductions.
export const sellingAdvanceSigned = (payment: { advanceApplied?: number; advanceEffect?: 'add' | 'subtract' }): number => {
    const amount = Number(payment.advanceApplied) || 0;
    return payment.advanceEffect === 'add' ? amount : -amount;
};

export const formatSellingAdvance = (payment: { advanceApplied?: number; advanceEffect?: 'add' | 'subtract' }, decimals = 0): string => {
    const amount = sellingAdvanceSigned(payment);
    return `${amount > 0 ? '+' : ''}${amount.toFixed(decimals)}`;
};
