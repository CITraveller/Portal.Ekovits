import assert from "node:assert/strict";
import test from "node:test";
import { calculateTotals } from "../utils/calculations.js";
import { amountInWords } from "../utils/money.js";

test("calculates intra-state CGST and SGST using paise", () => {
  const result = calculateTotals([{ description: "Service", hsn: "998713", gstRate: 18, qty: 1, rate: 5400 }], "intra");
  assert.equal(result.taxableCents, 540000);
  assert.equal(result.cgstCents, 48600);
  assert.equal(result.sgstCents, 48600);
  assert.equal(result.igstCents, 0);
  assert.equal(result.grandTotalCents, 637200);
});

test("calculates inter-state IGST", () => {
  const result = calculateTotals([{ description: "Service", hsn: "998713", gstRate: 18, qty: 2, rate: 1000 }], "inter");
  assert.equal(result.taxableCents, 200000);
  assert.equal(result.cgstCents, 0);
  assert.equal(result.sgstCents, 0);
  assert.equal(result.igstCents, 36000);
  assert.equal(result.grandTotalCents, 236000);
});

test("uses Indian numbering words", () => {
  assert.equal(amountInWords(11800000), "One Lakh Eighteen Thousand Only");
});
