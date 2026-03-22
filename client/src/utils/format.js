export function formatCurrency(value) {
  const num = Number(value || 0);
  return new Intl.NumberFormat("en-SA", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 0
  }).format(num);
}

export function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

export function formatMonth(value) {
  if (!value) return "-";
  const date = new Date(value);
  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric"
  });
}
