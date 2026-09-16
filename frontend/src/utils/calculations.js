import { toCents } from "./money.js";

export function resolvedGstType(companyState, customerState, selected = "auto") {
  if (selected === "intra" || selected === "inter") return selected;
  return String(companyState || "").trim().toLowerCase() === String(customerState || "").trim().toLowerCase() ? "intra" : "inter";
}

export function calculateTotals(items, gstType) {
  let taxableCents = 0;
  let cgstCents = 0;
  let sgstCents = 0;
  let igstCents = 0;
  items.forEach(item => {
    const lineTaxable = Math.round(Number(item.qty || 0) * toCents(item.rate || 0));
    taxableCents += lineTaxable;
    const rate = Number(item.gstRate || 0);
    if (gstType === "intra") {
      cgstCents += Math.round(lineTaxable * rate / 2 / 100);
      sgstCents += Math.round(lineTaxable * rate / 2 / 100);
    } else {
      igstCents += Math.round(lineTaxable * rate / 100);
    }
  });
  const totalGstCents = cgstCents + sgstCents + igstCents;
  const exactGrand = taxableCents + totalGstCents;
  const grandTotalCents = Math.round(exactGrand / 100) * 100;
  return { taxableCents, cgstCents, sgstCents, igstCents, totalGstCents, roundOffCents: grandTotalCents - exactGrand, grandTotalCents };
}
