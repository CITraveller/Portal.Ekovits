import { amountInWords, inr, money } from "../utils/money.js";
import { API_ORIGIN } from "../services/api.js";

export function InvoicePreview({ invoice, settings }) {
  const company = invoice.companySnapshot || settings || {};
  const items = invoice.items || [];
  const totals = invoice.totals || {};
  const isIntra = (invoice.gstType || "intra") === "intra";
  const totalQty = items.reduce((sum, item) => sum + Number(item.qty || 0), 0);
  const hsnRows = summarizeByHsn(items);

  return (
    <div className="invoice-wrap">
      <div className="invoice-doc">
        {invoice.invoiceStatus === "Cancelled" && <div className="cancel-watermark">CANCELLED</div>}
        <table className="tax-invoice">
          <colgroup>
            <col style={{ width: "7%" }} /><col style={{ width: "30%" }} /><col style={{ width: "10%" }} />
            <col style={{ width: "8%" }} /><col style={{ width: "8%" }} /><col style={{ width: "12%" }} /><col style={{ width: "25%" }} />
          </colgroup>
          <tbody>
            <tr>
              <td colSpan="5" className="header-left">
                {company.logoPath && <img className="logo" src={`${API_ORIGIN}${company.logoPath}`} alt="" />}
                <div className="company">{company.name}</div>
                <div className="company-meta">
                  <b>Address:</b> <span className="pre-line">{company.address}</span><br />
                  <b>Contact:</b> {company.contact}<br />
                  <b>Email ID:</b> {company.email} <b>Website:</b> {company.website}
                </div>
                <div className="gstin-block">
                  <b>GSTIN:</b> {company.gstin}<br />
                  <b>STATE:</b> {company.state}
                </div>
              </td>
              <td colSpan="2" className="header-right">
                <div className="title">TAX INVOICE</div>
                <div className="invno">{invoice.invoiceNo}</div>
              </td>
            </tr>
            <tr>
              <td colSpan="5" className="to-cell">
                <b>TO: {invoice.clientName}</b><br />
                <b>Address:</b> <span className="pre-line">{invoice.clientAddress}</span><br />
                <b>State:</b> {invoice.clientState || company.state}<br />
                <b>GSTIN:</b> {invoice.clientGstin || "-"}
              </td>
              <td colSpan="2" className="date-cell">
                <b>Date:</b> {formatDate(invoice.invoiceDate)}
              </td>
            </tr>
            <tr className="col-head">
              <th>SR. NO</th><th>DESCRIPTION</th><th>HSN / SAC</th><th>GST%</th><th>QTY</th><th>RATE</th><th>Amount</th>
            </tr>
            {items.map(item => (
              <tr key={item.id || item.srNo}>
                <td className="center">{item.srNo}</td>
                <td>{item.description}</td>
                <td className="center">{item.hsn}</td>
                <td className="center">{item.gstRate}%</td>
                <td className="center">{item.qty}</td>
                <td className="right">{money(item.rateCents)}</td>
                <td className="right">{money(item.taxableCents)}</td>
              </tr>
            ))}
            <tr className="totals-row">
              <td colSpan="4"></td>
              <td className="center bold">{totalQty} No.</td>
              <td></td>
              <td className="right bold">{inr(totals.grandTotalCents)}</td>
            </tr>
            <tr className="words-row">
              <td colSpan="7">
                <div className="words-label">Amount Chargeable (in words)</div>
                <div className="bold">Indian Rupees {invoice.amountWords || amountInWords(totals.grandTotalCents)}</div>
              </td>
            </tr>
            <tr>
              <td colSpan="7" className="no-pad">
                <table className="hsn-summary">
                  <thead>
                    <tr>
                      <th rowSpan="2">HSN/SAC</th>
                      <th rowSpan="2">Taxable<br />Value</th>
                      {isIntra
                        ? <><th colSpan="2">CGST</th><th colSpan="2">SGST/UTGST</th></>
                        : <th colSpan="2">IGST</th>}
                      <th rowSpan="2">Total<br />Tax Amount</th>
                    </tr>
                    <tr>
                      {isIntra
                        ? <><th>Rate</th><th>Amount</th><th>Rate</th><th>Amount</th></>
                        : <><th>Rate</th><th>Amount</th></>}
                    </tr>
                  </thead>
                  <tbody>
                    {hsnRows.map(row => {
                      const half = Number(row.gstRate || 0) / 2;
                      const cgst = isIntra ? Math.round(row.taxableCents * half / 100) : 0;
                      const igst = !isIntra ? Math.round(row.taxableCents * Number(row.gstRate || 0) / 100) : 0;
                      const rowTax = isIntra ? cgst * 2 : igst;
                      return (
                        <tr key={row.hsn}>
                          <td className="center">{row.hsn}</td>
                          <td className="right">{money(row.taxableCents)}</td>
                          {isIntra
                            ? <><td className="center">{half}%</td><td className="right">{money(cgst)}</td><td className="center">{half}%</td><td className="right">{money(cgst)}</td></>
                            : <><td className="center">{row.gstRate}%</td><td className="right">{money(igst)}</td></>}
                          <td className="right">{money(rowTax)}</td>
                        </tr>
                      );
                    })}
                    <tr className="bold">
                      <td className="center">Total</td>
                      <td className="right">{money(totals.taxableCents)}</td>
                      {isIntra
                        ? <><td></td><td className="right">{money(totals.cgstCents)}</td><td></td><td className="right">{money(totals.sgstCents)}</td></>
                        : <><td></td><td className="right">{money(totals.igstCents)}</td></>}
                      <td className="right">{money(totals.totalGstCents)}</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
            <tr className="tax-words-row">
              <td colSpan="7">
                <b>Tax Amount (in words):</b> Indian Rupees {amountInWords(totals.totalGstCents)}
              </td>
            </tr>
            <tr>
              <td colSpan="4" className="terms-cell">
                <div className="terms-heading bold">Terms &amp; Conditions / Notes</div>
                <div className="pre-line">{invoice.notes}</div>
              </td>
              <td colSpan="3" className="no-pad">
                <table className="bank-table">
                  <tbody>
                    <tr><td colSpan="2" className="bank-header bold center">Company's Bank Details</td></tr>
                    <tr><td className="bank-label">A/c Name :</td><td>{company.name}</td></tr>
                    <tr><td className="bank-label">Bank Name:</td><td>{company.bankName}</td></tr>
                    <tr><td className="bank-label">A/C No:</td><td>{company.accountNo}</td></tr>
                    <tr><td className="bank-label">IFSC Code:</td><td>{company.ifsc}</td></tr>
                    <tr><td className="bank-label">Branch</td><td>{company.branch}</td></tr>
                    <tr><td colSpan="2" className="bank-for bold center">for {company.name}</td></tr>
                    <tr>
                      <td className="stamp-cell center">
                        {company.stampPath && <img className="stamp-img" src={`${API_ORIGIN}${company.stampPath}`} alt="" />}
                      </td>
                      <td className="sign-cell center">
                        {company.signaturePath && <img className="sign-img" src={`${API_ORIGIN}${company.signaturePath}`} alt="" />}
                        <div>{company.signatory}</div>
                        <div className="small-text bold">Authorised Signatory</div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function printInvoice(invoice, settings) {
  const root = document.getElementById("printRoot");
  root.innerHTML = document.querySelector(".invoice-doc")?.outerHTML || "";
  window.print();
}

function summarizeByHsn(items) {
  const groups = new Map();
  items.forEach(item => {
    const hsn = item.hsn || "-";
    const gstRate = Number(item.gstRate || 0);
    const key = `${hsn}|${gstRate}`;
    if (!groups.has(key)) groups.set(key, { hsn, gstRate, taxableCents: 0 });
    groups.get(key).taxableCents += Number(item.taxableCents || 0);
  });
  return [...groups.values()];
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString("en-IN") : "";
}
