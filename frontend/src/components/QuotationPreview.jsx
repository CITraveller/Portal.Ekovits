import { amountInWords, inr, money } from "../utils/money.js";
import { API_ORIGIN } from "../services/api.js";
import { toRichTextHtml } from "../utils/richText.js";

export function QuotationPreview({ quotation, settings }) {
  const company = quotation.companySnapshot || settings || {};
  const items = quotation.items || [];
  const totals = quotation.totals || {};
  const totalQty = items.reduce((sum, item) => sum + Number(item.qty || 0), 0);

  return (
    <div className="invoice-wrap">
      <div className="invoice-doc quotation-doc">
        {quotation.quotationStatus === "Cancelled" && <div className="cancel-watermark">CANCELLED</div>}
        <table className="tax-invoice">
          <tbody>
            <tr>
              <td colSpan="5" className="header-left">
                {company.logoPath && <img className="logo" src={`${API_ORIGIN}${company.logoPath}`} alt="" />}
                <div className="company">{company.name}</div>
                <div className="company-meta">
                  <b>Address:</b> <span className="pre-line">{company.address}</span><br />
                  <b>Contact:</b> {company.contact}<br />
                  <b>Email:</b> {company.email} <b>Website:</b> {company.website}
                </div>
                <div className="gstin-block"><b>GSTIN:</b> {company.gstin}<br /><b>STATE:</b> {company.state}</div>
              </td>
              <td colSpan="2" className="header-right">
                <div className="title">QUOTATION</div>
                <div className="invno">{quotation.quotationNo}</div>
              </td>
            </tr>
            <tr>
              <td colSpan="5" className="to-cell">
                <b>TO: {quotation.clientName}</b><br />
                <b>Address:</b> <span className="pre-line">{quotation.clientAddress}</span><br />
                <b>State:</b> {quotation.clientState || company.state}<br />
                <b>GSTIN:</b> {quotation.clientGstin || "-"}<br />
                {quotation.subject && <><b>Subject:</b> {quotation.subject}</>}
              </td>
              <td colSpan="2" className="date-cell">
                <b>Date:</b> {formatDate(quotation.quotationDate)}<br />
                <b>Valid Until:</b> {formatDate(quotation.validUntil) || "-"}
              </td>
            </tr>
            <tr className="col-head">
              <th>SR. NO</th><th>DESCRIPTION</th><th>HSN / SAC</th><th>GST%</th><th>QTY</th><th>RATE</th><th>Total Amount</th>
            </tr>
            {items.map(item => (
              <tr key={item.id || item.srNo}>
                <td className="center">{item.srNo}</td>
                <td><div className="rich-print" dangerouslySetInnerHTML={{ __html: toRichTextHtml(item.description) }} /></td>
                <td className="center">{item.hsn}</td>
                <td className="center">{item.gstRate}%</td>
                <td className="center">{item.qty}</td>
                <td className="right">{money(item.rateCents)}</td>
                <td className="right">{money(item.taxableCents)}</td>
              </tr>
            ))}
            <tr className="totals-row"><td colSpan="4"></td><td className="center bold">{totalQty}</td><td></td><td className="right bold">{inr(totals.taxableCents)}</td></tr>
            <tr><td colSpan="5" className="terms-cell"><b>Notes</b><div className="pre-line">{quotation.notes}</div><br /><b>Terms &amp; Conditions</b><div className="pre-line">{quotation.terms}</div></td><td colSpan="2" className="no-pad"><table className="bank-table"><tbody>
              <tr><td>Taxable Value</td><td className="right">{money(totals.taxableCents)}</td></tr>
              <tr><td>CGST</td><td className="right">{money(totals.cgstCents)}</td></tr>
              <tr><td>SGST</td><td className="right">{money(totals.sgstCents)}</td></tr>
              <tr><td>IGST</td><td className="right">{money(totals.igstCents)}</td></tr>
              <tr><td>Total GST</td><td className="right">{money(totals.totalGstCents)}</td></tr>
              <tr className="bold"><td>Grand Total</td><td className="right">{inr(totals.grandTotalCents)}</td></tr>
            </tbody></table></td></tr>
            <tr className="words-row"><td colSpan="7"><div className="words-label">Amount in words</div><div className="bold">Indian Rupees {quotation.amountWords || amountInWords(totals.grandTotalCents)}</div></td></tr>
            <tr>
              <td colSpan="4" className="terms-cell"><b>Regards,</b><br />{company.name}</td>
              <td colSpan="3" className="sign-cell center">
                {company.signaturePath && <img className="sign-img" src={`${API_ORIGIN}${company.signaturePath}`} alt="" />}
                <div>{company.signatory}</div>
                <div className="small-text bold">Authorized Signatory</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function printQuotation() {
  const root = document.getElementById("printRoot");
  root.innerHTML = document.querySelector(".quotation-doc")?.outerHTML || "";
  window.print();
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString("en-IN") : "";
}
