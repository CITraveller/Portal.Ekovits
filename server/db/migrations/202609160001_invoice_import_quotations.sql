ALTER TABLE invoices ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'system';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS imported BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS imported_by TEXT REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS original_document_path TEXT DEFAULT '';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS original_document_name TEXT DEFAULT '';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS deleted_by TEXT REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS deleted_reason TEXT DEFAULT '';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cancelled_by TEXT REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_by TEXT REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS updated_by TEXT REFERENCES employees(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'invoices_source_check'
      AND conrelid = 'invoices'::regclass
  ) THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_source_check CHECK (source IN ('system', 'imported'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_invoices_source ON invoices(source, imported);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(invoice_status, payment_status);

CREATE TABLE IF NOT EXISTS quotation_number_sequences (
  id TEXT PRIMARY KEY DEFAULT 'default',
  prefix TEXT NOT NULL DEFAULT 'EKV-',
  next_number BIGINT NOT NULL DEFAULT 20261 CHECK (next_number > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quotations (
  id TEXT PRIMARY KEY,
  quotation_no TEXT NOT NULL UNIQUE,
  quotation_date DATE NOT NULL,
  valid_until DATE,
  gst_type TEXT NOT NULL CHECK (gst_type IN ('intra', 'inter')),
  gst_override BOOLEAN NOT NULL DEFAULT false,
  reference_no TEXT DEFAULT '',
  subject TEXT DEFAULT '',
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  client_address TEXT NOT NULL,
  client_contact TEXT DEFAULT '',
  client_email TEXT DEFAULT '',
  client_gstin TEXT DEFAULT '',
  client_state TEXT DEFAULT '',
  client_state_code TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  terms TEXT DEFAULT '',
  company_snapshot JSONB NOT NULL,
  taxable_cents BIGINT NOT NULL DEFAULT 0,
  cgst_cents BIGINT NOT NULL DEFAULT 0,
  sgst_cents BIGINT NOT NULL DEFAULT 0,
  igst_cents BIGINT NOT NULL DEFAULT 0,
  total_gst_cents BIGINT NOT NULL DEFAULT 0,
  round_off_cents BIGINT NOT NULL DEFAULT 0,
  grand_total_cents BIGINT NOT NULL DEFAULT 0,
  quotation_status TEXT NOT NULL CHECK (quotation_status IN ('Draft', 'Sent', 'Accepted', 'Rejected', 'Expired', 'Cancelled')) DEFAULT 'Draft',
  revision INTEGER NOT NULL DEFAULT 0,
  cancellation_reason TEXT DEFAULT '',
  cancelled_at TIMESTAMPTZ,
  cancelled_by TEXT REFERENCES employees(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT REFERENCES employees(id) ON DELETE SET NULL,
  deleted_reason TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT REFERENCES employees(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT REFERENCES employees(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_quotations_customer_id ON quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotations_quotation_date ON quotations(quotation_date);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(quotation_status);
CREATE INDEX IF NOT EXISTS idx_quotations_search ON quotations(quotation_no, client_name, client_gstin, quotation_status);

CREATE TABLE IF NOT EXISTS quotation_items (
  id TEXT PRIMARY KEY,
  quotation_id TEXT NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  sr_no INTEGER NOT NULL CHECK (sr_no > 0),
  description TEXT NOT NULL,
  hsn TEXT NOT NULL,
  gst_rate NUMERIC(6,2) NOT NULL CHECK (gst_rate >= 0),
  qty NUMERIC(14,3) NOT NULL CHECK (qty > 0),
  rate_cents BIGINT NOT NULL CHECK (rate_cents >= 0),
  taxable_cents BIGINT NOT NULL CHECK (taxable_cents >= 0)
);

CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation_id ON quotation_items(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_items_hsn ON quotation_items(hsn);

INSERT INTO quotation_number_sequences (id, prefix, next_number)
VALUES ('default', 'EKV-', 20261)
ON CONFLICT (id) DO NOTHING;

UPDATE quotation_number_sequences seq
SET next_number = GREATEST(
  seq.next_number,
  COALESCE((
    SELECT MAX(substring(quotation_no from '([0-9]+)$')::bigint) + 1
    FROM quotations
    WHERE quotation_no ~ '[0-9]+$'
  ), seq.next_number)
)
WHERE seq.id = 'default';
