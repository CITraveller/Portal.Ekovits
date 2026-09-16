import { query, withTransaction } from "../db/connection.js";

export const defaultSettings = {
  id: "company",
  name: "EKOVITS CONSULTING LLP",
  address: "A/307, Muktanand Nagar,\nHirawada Road,\nKannad, Aurangabad - 431103,\nMaharashtra, India",
  contact: "+91-7588800770 / +91-8421640770",
  email: "hello@ekovits.com",
  website: "www.ekovits.com",
  gstin: "27AAMFE2504P1Z4",
  state: "Maharashtra",
  stateCode: "27",
  bankName: "Maharashtra Gramin Bank",
  accountNo: "00100092889",
  ifsc: "MAHG0005133",
  branch: "Kannad, Chhatrapati Sambhajinagar (Aurangabad), 431101.",
  signatory: "Rohan Milind Sangwe",
  invoicePrefix: "",
  nextInvoiceNumber: 202621,
  logoPath: "",
  stampPath: "",
  signaturePath: ""
};

export async function getSettings(client = null) {
  const runner = client || { query };
  const { rows } = await runner.query(`
    SELECT cs.*, COALESCE(seq.prefix, cs.invoice_prefix) AS sequence_prefix,
      COALESCE(seq.next_number, cs.next_invoice_number) AS sequence_next_number
    FROM company_settings cs
    LEFT JOIN invoice_number_sequences seq ON seq.id = 'default'
    WHERE cs.id = 'company'
  `);
  return rows[0] ? mapSettings(rows[0]) : defaultSettings;
}

export async function updateSettings(input) {
  const existing = await getSettings();
  const next = { ...existing, ...input };
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO company_settings (
        id, name, address, contact, email, website, gstin, state, state_code,
        bank_name, account_no, ifsc, branch, signatory, invoice_prefix,
        next_invoice_number, logo_path, stamp_path, signature_path, updated_at
      ) VALUES (
        'company',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,now()
      )
      ON CONFLICT (id) DO UPDATE SET
        name=EXCLUDED.name,address=EXCLUDED.address,contact=EXCLUDED.contact,email=EXCLUDED.email,
        website=EXCLUDED.website,gstin=EXCLUDED.gstin,state=EXCLUDED.state,state_code=EXCLUDED.state_code,
        bank_name=EXCLUDED.bank_name,account_no=EXCLUDED.account_no,ifsc=EXCLUDED.ifsc,branch=EXCLUDED.branch,
        signatory=EXCLUDED.signatory,invoice_prefix=EXCLUDED.invoice_prefix,
        next_invoice_number=EXCLUDED.next_invoice_number,logo_path=EXCLUDED.logo_path,
        stamp_path=EXCLUDED.stamp_path,signature_path=EXCLUDED.signature_path,updated_at=now()
      RETURNING *`,
      [next.name, next.address, next.contact, next.email, next.website, next.gstin, next.state, next.stateCode,
        next.bankName, next.accountNo, next.ifsc, next.branch, next.signatory, next.invoicePrefix || "",
        Number(next.nextInvoiceNumber || 202621), next.logoPath || "", next.stampPath || "", next.signaturePath || ""]
    );
    await client.query(
      `INSERT INTO invoice_number_sequences (id, prefix, next_number)
       VALUES ('default', $1, $2)
       ON CONFLICT (id) DO UPDATE SET prefix=EXCLUDED.prefix, next_number=EXCLUDED.next_number, updated_at=now()`,
      [next.invoicePrefix || "", Number(next.nextInvoiceNumber || 202621)]
    );
    return getSettings(client);
  });
}

export function mapSettings(row) {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    contact: row.contact || "",
    email: row.email || "",
    website: row.website || "",
    gstin: row.gstin || "",
    state: row.state,
    stateCode: row.state_code,
    bankName: row.bank_name || "",
    accountNo: row.account_no || "",
    ifsc: row.ifsc || "",
    branch: row.branch || "",
    signatory: row.signatory || "",
    invoicePrefix: row.sequence_prefix ?? row.invoice_prefix ?? "",
    nextInvoiceNumber: Number(row.sequence_next_number ?? row.next_invoice_number ?? 202621),
    logoPath: row.logo_path || "",
    stampPath: row.stamp_path || "",
    signaturePath: row.signature_path || ""
  };
}
