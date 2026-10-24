export type MilkInput = {
  qty: number;
  fat: number;
  clr: number;
  rate: number;
};

export type MilkResult = {
  snf: number;
  fatKg: number;
  snfKg: number;
  perQuintal: number;
  perFatPoint: number;
  fatRate: number;
  snfRate: number;
  amount: number;
  avgRate: number;
};

const paise = (value: number) => Math.floor(value * 100 + 1e-6) / 100;

export function milkCalc({ qty, fat, clr, rate }: MilkInput): MilkResult {
  const snf = clr / 4 + 0.2 * fat + 0.14;
  const fatKg = (qty * fat) / 100;
  const snfKg = (qty * snf) / 100;

  const perQuintal = rate >= 100 ? rate : rate * 650;
  const fatRate = paise((0.6 * perQuintal) / 6.5);
  const snfRate = paise((0.4 * perQuintal) / 8.5);
  const amount = fatKg * fatRate + snfKg * snfRate;

  return {
    snf,
    fatKg,
    snfKg,
    perQuintal,
    perFatPoint: perQuintal / 650,
    fatRate,
    snfRate,
    amount,
    avgRate: qty > 0 ? amount / qty : 0,
  };
}
