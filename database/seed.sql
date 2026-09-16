-- NOTE: next_invoice_number is seeded at 202623 because invoice #202622 has
-- already been issued to a real client (see legacy-data / uploaded reference
-- invoice). If you run scripts/importExcelData.js against real invoice
-- history, it will recompute this automatically from the highest imported
-- invoice number, so this seed value only matters for a brand-new install
-- that skips the legacy import. Adjust it if your true last-issued number
-- is different.
INSERT INTO company_settings (
  id, name, address, contact, email, website, gstin, state, state_code,
  bank_name, account_no, ifsc, branch, signatory, invoice_prefix, next_invoice_number
) VALUES (
  'company',
  'EKOVITS CONSULTING LLP',
  'A/307, Muktanand Nagar,
Hirawada Road,
Kannad, Aurangabad - 431103,
Maharashtra, India',
  '+91-7588800770 / +91-8421640770',
  'hello@ekovits.com',
  'www.ekovits.com',
  '27AAMFE2504P1Z4',
  'Maharashtra',
  '27',
  'Maharashtra Gramin Bank',
  '00100092889',
  'MAHG0005133',
  'Kannad, Chhatrapati Sambhajinagar (Aurangabad), 431101.',
  'Rohan Milind Sangwe',
  '',
  202623
) ON CONFLICT (id) DO NOTHING;

INSERT INTO invoice_number_sequences (id, prefix, next_number)
SELECT 'default', invoice_prefix, next_invoice_number
FROM company_settings
WHERE id = 'company'
ON CONFLICT (id) DO NOTHING;

INSERT INTO employees (id, email, name, role, password_hash, active)
VALUES (
  'emp_support',
  'support@ekovits.com',
  'EKOVITS Support',
  'Employee',
  'pbkdf2_sha256$120000$998e1d5958dedab1d416e1e73a011300$64879d299cd5dc2d367691530a1f3c50b6a2e3a415c2abc9a4f4ff7386edcdc1',
  true
) ON CONFLICT (email) DO UPDATE SET
  name=EXCLUDED.name,
  role=EXCLUDED.role,
  password_hash=EXCLUDED.password_hash,
  active=true,
  updated_at=now();

INSERT INTO customers (
  id, name, billing_address, shipping_address, contact_person, contact_number,
  email, gstin, state, state_code, pan, customer_type, notes, active
) VALUES (
  'cust_sample',
  'SHIKSHAK SAHAKARI BANK LTD',
  'Near Gandhi Sagar, Mahal, Nagpur, 440018.',
  '',
  '',
  '',
  '',
  '',
  'Maharashtra',
  '27',
  '',
  'Business',
  'Sample customer from reference invoice.',
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO hsn_codes (
  id, code, description, gst_rate, cgst_rate, sgst_rate, igst_rate, unit, notes, active
) VALUES (
  'hsn_998713',
  '998713',
  'Outward CGST / Outward SGST',
  18,
  9,
  9,
  18,
  'No.',
  'Sample HSN/SAC from reference invoice.',
  true
) ON CONFLICT (code) DO NOTHING;
