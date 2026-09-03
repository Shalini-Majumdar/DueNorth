const inr = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 0,
});

const inr2 = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(value, { decimals = false } = {}) {
  const n = Number(value) || 0;
  return `Rs ${(decimals ? inr2 : inr).format(n)}`;
}

export function formatNumber(value) {
  return new Intl.NumberFormat("en-IN").format(Number(value) || 0);
}

export function formatPercent(value, digits = 1) {
  return `${(Number(value) || 0).toFixed(digits)}%`;
}
