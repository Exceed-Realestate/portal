/* ========================================================================
   payment-pdf.js — shared PDF generator for the payment-approval flow.
   Used by both payment.html (preview + submit) and payment-approve.html
   (re-download). All company-letterhead constants live in one place
   so they're easy to update.

   Loads jsPDF from window.jspdf — caller must include the UMD script:
     <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
   ======================================================================== */

/* Company letterhead — edit here, applies to every payment PDF.
   Phone / address are placeholders until Balraj confirms the
   trade-license details. */
export const COMPANY = {
  name:    'Exceed Real Estate L.L.C',
  tagline: 'Dubai · Finance · Payment Request',
  email:   'info@exceed-re.ae',
  phone:   '+971 4 000 0000',
  website: 'exceed.estate',
  address: 'Dubai, United Arab Emirates',
  logoUrl: 'logo.jpg'
};

const SMALL_AMOUNT_AED = 1000;

/* Logo cache — fetched once per page load, then reused. */
let _logoDataUrlPromise = null;
function loadLogoDataUrl() {
  if (_logoDataUrlPromise) return _logoDataUrlPromise;
  _logoDataUrlPromise = (async () => {
    try {
      const r = await fetch(COMPANY.logoUrl, { cache: 'force-cache' });
      if (!r.ok) return null;
      const blob = await r.blob();
      return await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = reject;
        fr.readAsDataURL(blob);
      });
    } catch (_) { return null; }
  })();
  return _logoDataUrlPromise;
}

function fmtAmount(v) {
  const n = Number(v || 0);
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' AED';
}
function fmtDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-GB',
      { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  } catch (_) { return d; }
}

/* Async — returns base64 (no data: prefix) ready for jsPDF / Trigger Email. */
export async function buildPaymentPdfBase64(p, paymentId) {
  if (!(window.jspdf && window.jspdf.jsPDF)) {
    throw new Error('jsPDF not loaded');
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  /* ===== Letterhead band ===== */
  doc.setFillColor(10, 31, 61);
  doc.rect(0, 0, pageW, 110, 'F');

  // Try to render the company logo top-left. If the fetch failed, fall
  // back to text-only branding (still legible).
  const logo = await loadLogoDataUrl();
  let textX = 40;
  if (logo) {
    try {
      // 56×56 pt fits the 110-pt header band with breathing room.
      doc.addImage(logo, 'JPEG', 40, 28, 56, 56);
      textX = 110;
    } catch (_) { /* unsupported format → fall through to text */ }
  }
  doc.setTextColor(212, 184, 122);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(COMPANY.name.toUpperCase(), textX, 50);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(241, 234, 216);
  doc.text(COMPANY.tagline, textX, 70);
  doc.setFontSize(9);
  doc.setTextColor(154, 168, 194);
  doc.text(`Reference: ${paymentId}`, textX, 90);

  /* ===== Title + status ===== */
  doc.setTextColor(10, 31, 61);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Payment Request', 40, 150);

  const submitted = p.createdAtMs
    ? new Date(p.createdAtMs)
    : new Date();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(`Submitted: ${submitted.toLocaleString('en-GB',
    { dateStyle: 'medium', timeStyle: 'short' })}`, 40, 168);

  const status = (p.status || 'submitted').toUpperCase();
  const accent = status === 'APPROVED' ? [92, 201, 143]
              : status === 'DECLINED' ? [255, 107, 107]
              : status === 'CANCELLED' ? [180, 180, 190]
              : [212, 184, 122];
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.roundedRect(40, 184, 170, 22, 4, 4, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  const statusLabel = status === 'SUBMITTED' ? 'PENDING APPROVAL' : status;
  doc.text(statusLabel, 50, 199);

  /* ===== Big amount ===== */
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(10, 31, 61);
  doc.text(fmtAmount(p.amount), 40, 250);

  /* ===== Field rows ===== */
  const rows = [
    ['Requester',      p.requesterName || '—'],
    ['Email',          p.requesterEmail || '—'],
    ['Pay to',         p.recipient || '—'],
    ['Purpose',        p.purpose || '—'],
    ['Category',       p.category || '—'],
    ['Due date',       fmtDate(p.dueDate)],
    ['Notes',          p.notes || '—'],
    ['Approval tier',  (p.amount || 0) > SMALL_AMOUNT_AED
        ? '> 1,000 AED · CEO approval required'
        : '≤ 1,000 AED · Mouad / Hira (CEO cc)']
  ];
  let y = 290;
  doc.setFontSize(9);
  for (const [k, v] of rows) {
    doc.setTextColor(154, 168, 194);
    doc.setFont('helvetica', 'normal');
    doc.text(k.toUpperCase(), 40, y);
    doc.setTextColor(10, 31, 61);
    doc.setFont('helvetica', 'bold');
    const lines = doc.splitTextToSize(String(v), pageW - 200);
    doc.text(lines, 200, y);
    y += Math.max(20, lines.length * 12 + 8);
  }

  /* ===== Approved by / Requested by signature block ===== */
  y += 14;
  doc.setDrawColor(212, 184, 122);
  doc.setLineWidth(0.6);
  doc.line(40, y, pageW - 40, y);
  y += 20;

  doc.setTextColor(10, 31, 61);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('SIGNATURES', 40, y);
  y += 18;

  // Two-column layout: Requested by (left) | Approved by (right)
  const colW = (pageW - 80) / 2;
  const leftX  = 40;
  const rightX = 40 + colW + 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(154, 168, 194);
  doc.text('REQUESTED BY', leftX, y);
  doc.text('APPROVED BY',  rightX, y);
  y += 28;

  doc.setLineWidth(0.5);
  doc.setDrawColor(120, 120, 120);
  doc.line(leftX,  y, leftX  + colW - 10, y);
  doc.line(rightX, y, rightX + colW - 10, y);
  y += 12;
  doc.setTextColor(10, 31, 61);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(p.requesterName || '', leftX, y);
  if (p.decisionBy) doc.text(p.decisionBy, rightX, y);

  // Date + signature lines
  y += 22;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text('Date',      leftX, y);
  doc.text('Date',      rightX, y);
  doc.text('Signature', leftX  + 80, y);
  doc.text('Signature', rightX + 80, y);
  y += 6;
  doc.setDrawColor(160, 160, 160);
  doc.line(leftX,        y + 12, leftX  + 70,        y + 12);
  doc.line(rightX,       y + 12, rightX + 70,        y + 12);
  doc.line(leftX  + 80,  y + 12, leftX  + colW - 10, y + 12);
  doc.line(rightX + 80,  y + 12, rightX + colW - 10, y + 12);

  // Pre-fill requester date with submission date
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(submitted.toLocaleDateString('en-GB'), leftX, y + 8);
  if (p.decisionAt) {
    try { doc.text(new Date(p.decisionAt).toLocaleDateString('en-GB'), rightX, y + 8); }
    catch (_) {}
  }

  /* ===== Footer letterhead band ===== */
  const footerH = 60;
  const footerY = pageH - footerH;
  doc.setFillColor(10, 31, 61);
  doc.rect(0, footerY, pageW, footerH, 'F');

  doc.setTextColor(212, 184, 122);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(COMPANY.name.toUpperCase(), 40, footerY + 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(241, 234, 216);
  const line1Parts = [];
  if (COMPANY.email) line1Parts.push(COMPANY.email);
  if (COMPANY.phone) line1Parts.push(COMPANY.phone);
  if (COMPANY.website) line1Parts.push(COMPANY.website);
  doc.text(line1Parts.join('  ·  '), 40, footerY + 38);
  if (COMPANY.address) {
    doc.setTextColor(154, 168, 194);
    doc.text(COMPANY.address, 40, footerY + 52);
  }

  // Right-aligned: ref + auto-generated note
  doc.setFontSize(7.5);
  doc.setTextColor(154, 168, 194);
  doc.text(`Ref ${paymentId}  ·  Generated by Exceed Portal`,
    pageW - 40, footerY + 52, { align: 'right' });

  return doc.output('datauristring').split(',')[1] || '';
}

/* Helper for callers that want a Blob URL — opens or downloads a fresh PDF. */
export async function downloadPaymentPdf(p, paymentId, filename) {
  const b64 = await buildPaymentPdfBase64(p, paymentId);
  const blob = new Blob(
    [Uint8Array.from(atob(b64), c => c.charCodeAt(0))],
    { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `Payment-Request-${paymentId}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 30 * 1000);
  return b64;
}
