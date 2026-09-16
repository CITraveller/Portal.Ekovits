export function toCents(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Math.round(value * 100);
  const cleaned = String(value).replace(/[₹,\s]/g, "");
  return Math.round((Number(cleaned) || 0) * 100);
}

export function centsToAmount(cents) {
  return Number(cents || 0) / 100;
}

export function inr(cents) {
  return "₹" + centsToAmount(cents).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function amountInWords(cents) {
  const rupees = Math.floor(Math.abs(Number(cents || 0)) / 100);
  const paise = Math.abs(Number(cents || 0)) % 100;
  const main = numberWords(rupees) || "Zero";
  return paise ? `${main} and ${numberWords(paise)} Paise Only` : `${main} Only`;
}

function numberWords(n) {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = x => x < 20 ? ones[x] : tens[Math.floor(x / 10)] + (x % 10 ? " " + ones[x % 10] : "");
  const three = x => x >= 100 ? ones[Math.floor(x / 100)] + " Hundred" + (x % 100 ? " " + two(x % 100) : "") : two(x);
  let out = "";
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) out += three(crore) + " Crore ";
  if (lakh) out += three(lakh) + " Lakh ";
  if (thousand) out += three(thousand) + " Thousand ";
  if (n) out += three(n);
  return out.trim();
}
