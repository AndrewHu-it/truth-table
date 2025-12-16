const LOG_CLAMP = 40; // prevents exp() overflow

export const B_MIN = 0.01;
export const B_MAX = 1e6;
export const SHARES_MAX = 1e6;
export const Q_MAX = 1e6;
export const B_STATIC = 25; // fixed liquidity parameter for all markets

function logSumExp(a: number, b: number) {
  const m = Math.max(a, b);
  return m + Math.log(Math.exp(a - m) + Math.exp(b - m));
}

export function lmsrCost(qYes: number, qNo: number, b: number) {
  return b * logSumExp(qYes / b, qNo / b);
}

export function yesPrice(qYes: number, qNo: number, b: number) {
  const diff = (qNo - qYes) / b; // logistic form to avoid huge exponents
  if (diff > LOG_CLAMP) return 0;
  if (diff < -LOG_CLAMP) return 1;
  return 1 / (1 + Math.exp(diff));
}
