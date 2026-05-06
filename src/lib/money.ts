export function dollars(value: number | null | undefined) {
  const numericValue = Number(value ?? 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    useGrouping: true,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number.isFinite(numericValue) ? numericValue : 0);
}

export function numeric(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") {
    return 0;
  }

  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function percentage(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 0
  }).format(value);
}
