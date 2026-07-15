// Rate Chart helpers (client-only, view reference).
// Formula (locked, matches user's physical chart):
//   FatRate = Rate * 0.08
//   SnfRate = Rate * 0.053333333
//   Cell(FAT, SNF) = FAT * FatRate + SNF * SnfRate

export const FAT_RATIO = 0.08;
export const SNF_RATIO = 0.053333333;

export function deriveRates(rate: number): { fatRate: number; snfRate: number } {
    const r = Number.isFinite(rate) && rate > 0 ? rate : 0;
    return { fatRate: r * FAT_RATIO, snfRate: r * SNF_RATIO };
}

export function computeCell(fat: number, snf: number, fatRate: number, snfRate: number): number {
    return fat * fatRate + snf * snfRate;
}

export interface BuildChartInput {
    rate: number;
    fatMin: number;
    fatMax: number;
    snfMin: number;
    snfMax: number;
    step: number;
}

export interface ChartRow {
    fat: number;
    cells: number[]; // aligned with snfValues
}

export interface BuiltChart {
    fatValues: number[];
    snfValues: number[];
    rows: ChartRow[];
    fatRate: number;
    snfRate: number;
}

function range(min: number, max: number, step: number): number[] {
    const out: number[] = [];
    if (step <= 0 || max < min) return out;
    // guard against runaway ranges
    const maxCount = 400;
    const count = Math.min(Math.floor((max - min) / step) + 1, maxCount);
    for (let i = 0; i < count; i++) {
        out.push(Math.round((min + i * step) * 1000) / 1000);
    }
    return out;
}

export function buildChart(input: BuildChartInput): BuiltChart {
    const { fatRate, snfRate } = deriveRates(input.rate);
    const fatValues = range(input.fatMin, input.fatMax, input.step);
    const snfValues = range(input.snfMin, input.snfMax, input.step);
    const rows: ChartRow[] = fatValues.map((fat) => ({
        fat,
        cells: snfValues.map((snf) => computeCell(fat, snf, fatRate, snfRate)),
    }));
    return { fatValues, snfValues, rows, fatRate, snfRate };
}
