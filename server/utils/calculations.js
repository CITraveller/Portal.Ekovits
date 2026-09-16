import { toCents } from "./money.js";

export function resolvedGstType(companyState, customerState, selected = "auto") {
  if (selected === "intra" || selected === "inter") return selected;
  return String(companyState || "").trim().toLowerCase() === String(customerState || "").trim().toLowerCase()
    ? "intra"
    : "inter";
}

export function normalizeItems(items = []) {
  return items.map((item, index) => {
    const qty = Number(item.qty || 0);
    const rateCents = Number.isFinite(Number(item.rateCents)) ? Number(item.rateCents) : toCents(item.rate);
    return {
      id: item.id,
      srNo: Number(item.srNo || item.sr_no || index + 1),
      description: String(item.description || "").trim(),
      hsn: String(item.hsn || "").trim(),
      gstRate: Number(item.gstRate ?? item.gst_rate ?? 0),
      qty,
      rateCents,
      taxableCents: Math.round(qty * rateCents)
    };
  });
}

export function calculateTotals(items = [], gstType = "intra") {
  const normalized = normalizeItems(items);
  const gstBreakdown = buildGstBreakdown(normalized, gstType);
  const taxableCents = sum(gstBreakdown, g => g.taxableCents);
  const cgstCents = sum(gstBreakdown, g => g.cgstCents);
  const sgstCents = sum(gstBreakdown, g => g.sgstCents);
  const igstCents = sum(gstBreakdown, g => g.igstCents);
  const totalGstCents = cgstCents + sgstCents + igstCents;
  const exactGrand = taxableCents + totalGstCents;
  const roundedGrandCents = Math.round(exactGrand / 100) * 100;
  return {
    items: normalized,
    taxableCents,
    cgstCents,
    sgstCents,
    igstCents,
    totalGstCents,
    roundOffCents: roundedGrandCents - exactGrand,
    grandTotalCents: roundedGrandCents,
    gstBreakdown
  };
}

export function buildGstBreakdown(items, gstType) {
  const groups = new Map();
  items.forEach((item) => {
    const key = `${item.hsn || "Unspecified"}|${Number(item.gstRate || 0)}`;
    const group = groups.get(key) || {
      hsn: item.hsn || "Unspecified",
      gstRate: Number(item.gstRate || 0),
      taxableCents: 0,
      cgstCents: 0,
      sgstCents: 0,
      igstCents: 0
    };
    group.taxableCents += Number(item.taxableCents || 0);
    if (gstType === "intra") {
      group.cgstCents += Math.round(Number(item.taxableCents || 0) * group.gstRate / 2 / 100);
      group.sgstCents += Math.round(Number(item.taxableCents || 0) * group.gstRate / 2 / 100);
    } else {
      group.igstCents += Math.round(Number(item.taxableCents || 0) * group.gstRate / 100);
    }
    groups.set(key, group);
  });
  return [...groups.values()];
}

function sum(arr, fn) {
  return arr.reduce((total, item) => total + (fn(item) || 0), 0);
}
