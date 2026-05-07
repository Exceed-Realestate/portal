/* ========================================================================
   payment-notify.js — Shared notification + email dispatcher for payment
   approval requests. Mirrors car-notify.js shape so both flows behave the
   same way (mail rows + in-portal bell).

   Routing rules (Phase 1, no signature pad):
     amount ≤ 1000 AED  → approver pool: Mouad, Hira, CEO, admin
                          recipients on decision: requester + Mouad + Hira + CEO (cc)
     amount  > 1000 AED → approver pool: CEO, admin
                          recipients on decision: requester + Mouad + Hira + CEO

     Withdrawn / cancelled by requester → silent (no email).
   ======================================================================== */

import { addDoc, collection, serverTimestamp } from
  "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

export const FINANCE = {
  mouad: 'mouad@exceed-re.ae',
  hira:  'hira@exceed-re.ae',
  ceo:   'teruo@exceed-re.ae'
};

export const SMALL_AMOUNT_AED = 1000;

/* Who is allowed to approve a given payment request. */
export function canApprovePayment(p, role, email) {
  const e = (email || '').toLowerCase();
  if (role === 'admin') return true;
  if (e === FINANCE.mouad || e === FINANCE.hira || e === FINANCE.ceo) {
    if ((p.amount || 0) > SMALL_AMOUNT_AED) {
      return e === FINANCE.ceo;
    }
    return true;
  }
  if (role === 'ceo') return true;
  return false;
}

/* Recipients for a decision email.
   NOTE: Teruo (CEO) temporarily dropped from the small-amount CC list
   (Balraj 2026-05-07 — verifying Hira's inbox first). Re-add by un-commenting
   the marked line below. CEO stays on > 1,000 AED because he's the approver. */
function recipientsFor(p, status) {
  const out = new Set();
  if (p.requesterEmail) out.add(p.requesterEmail.toLowerCase());
  if (status === 'approved' || status === 'declined') {
    out.add(FINANCE.mouad);
    out.add(FINANCE.hira);
    if ((p.amount || 0) > SMALL_AMOUNT_AED) out.add(FINANCE.ceo);
    // out.add(FINANCE.ceo);  // ← re-enable once Hira's inbox is confirmed
  }
  return [...out];
}

/* Recipients for the *initial submission* — who needs to act on it.
   Same temporary CEO-CC removal as above. */
export function submitRecipients(p) {
  const out = new Set();
  out.add(FINANCE.mouad);
  out.add(FINANCE.hira);
  if ((p.amount || 0) > SMALL_AMOUNT_AED) out.add(FINANCE.ceo);
  // else out.add(FINANCE.ceo);  // ← re-enable once Hira's inbox is confirmed
  return [...out];
}

function fmtAmount(p) {
  const n = Number(p.amount || 0);
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' AED';
}
function fmtDate(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('en-GB',
      { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  } catch (_) { return d; }
}
function portalOrigin() {
  return location.origin + location.pathname.replace(/[^/]+$/, '');
}

function statusMeta(status) {
  if (status === 'approved')  return { label: 'Approved',  accent: '#5cc98f' };
  if (status === 'declined')  return { label: 'Declined',  accent: '#ff6b6b' };
  if (status === 'cancelled') return { label: 'Cancelled', accent: '#ff6b6b' };
  if (status === 'submitted') return { label: 'Pending Approval', accent: '#d4b87a' };
  return { label: status, accent: '#d4b87a' };
}

function row(k, v) {
  return v && v !== '—'
    ? `<tr><td style="padding:6px 0;color:#9aa8c2;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;width:140px;vertical-align:top;">${k}</td><td style="padding:6px 0;color:#f1ead8;font-size:14px;">${v}</td></tr>`
    : '';
}

function buildEmailHtml(p, paymentId, status, actorName) {
  const meta = statusMeta(status);
  const isPending = status === 'submitted';
  const detailUrl = `${portalOrigin()}payment-approve.html?id=${paymentId}`;
  const headline = isPending  ? 'Payment Request — Action Required'
                  : status === 'approved'  ? 'Payment Request Approved'
                  : status === 'declined'  ? 'Payment Request Declined'
                  : 'Payment Request Cancelled';

  const lede = isPending
    ? `A new payment request has been submitted by <strong style="color:#f1ead8;">${p.requesterName || 'a team member'}</strong>. Please review and approve or decline.`
    : status === 'approved'
      ? `Your request was approved by <strong style="color:#f1ead8;">${actorName}</strong>.`
      : status === 'declined'
        ? `Your request was declined by <strong style="color:#f1ead8;">${actorName}</strong>.`
        : `This request was cancelled by <strong style="color:#f1ead8;">${actorName}</strong>.`;

  const ctaPrimary = isPending
    ? `<a href="${detailUrl}" style="display:inline-block;margin:4px 6px;padding:12px 22px;background:linear-gradient(135deg,#f1ead8,#d4b87a);color:#0a1f3d;text-decoration:none;border-radius:8px;font-weight:700;font-size:12px;letter-spacing:1.2px;text-transform:uppercase;">Review Request</a>`
    : `<a href="${detailUrl}" style="display:inline-block;margin:4px 6px;padding:12px 22px;background:linear-gradient(135deg,#f1ead8,#d4b87a);color:#0a1f3d;text-decoration:none;border-radius:8px;font-weight:700;font-size:12px;letter-spacing:1.2px;text-transform:uppercase;">View Request</a>`;

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#051428;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;color:#f5f7fb;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-family:Georgia,serif;font-size:18px;letter-spacing:3px;color:#d4b87a;">EXCEED REAL ESTATE</div>
      <div style="font-size:10px;letter-spacing:3px;color:#9aa8c2;text-transform:uppercase;margin-top:6px;">DUBAI · FINANCE</div>
    </div>
    <div style="background:linear-gradient(180deg,#0a1f3d,#102a4f);border:1px solid rgba(255,255,255,0.10);border-radius:14px;padding:24px;">
      <div style="display:inline-block;padding:5px 12px;border-radius:999px;background:${meta.accent}26;color:${meta.accent};border:1px solid ${meta.accent}66;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:14px;">
        ${meta.label}
      </div>
      <h2 style="font-family:Georgia,serif;font-weight:600;font-size:22px;margin:0 0 6px;color:#f1ead8;">${headline}</h2>
      <p style="color:#d4b87a;font-size:18px;font-weight:700;margin:0 0 18px;">${fmtAmount(p)}</p>
      <p style="color:#9aa8c2;font-size:13px;margin:0 0 16px;line-height:1.5;">${lede}</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;border-top:1px solid rgba(255,255,255,0.10);border-bottom:1px solid rgba(255,255,255,0.10);">
        ${row('Requester', `${p.requesterName || ''}${p.requesterEmail ? ' · ' + p.requesterEmail : ''}`)}
        ${row('Amount', fmtAmount(p))}
        ${row('Recipient', p.recipient)}
        ${row('Purpose', p.purpose)}
        ${row('Category', p.category)}
        ${row('Due date', fmtDate(p.dueDate))}
        ${row('Notes', p.notes)}
      </table>
      <div style="margin-top:22px;text-align:center;">
        ${ctaPrimary}
      </div>
    </div>
    <div style="text-align:center;margin-top:18px;color:#9aa8c2;font-size:11px;letter-spacing:1px;">
      Exceed Real Estate · Dubai · automated message
    </div>
  </div>
</body></html>`;
}

function buildEmailText(p, paymentId, status, actorName) {
  const lines = [
    `Payment request ${status.toUpperCase()}`,
    '',
    `Requester: ${p.requesterName || ''} (${p.requesterEmail || ''})`,
    `Amount: ${fmtAmount(p)}`,
    `Recipient: ${p.recipient || '—'}`,
    `Purpose: ${p.purpose || '—'}`,
    `Category: ${p.category || '—'}`,
    `Due date: ${fmtDate(p.dueDate) || '—'}`,
    `Notes: ${p.notes || '—'}`,
  ];
  if (status !== 'submitted' && actorName) {
    lines.push('', `Decision by: ${actorName}`);
  }
  lines.push('', `Open in portal: ${portalOrigin()}payment-approve.html?id=${paymentId}`);
  lines.push('', '— Exceed Real Estate, Dubai');
  return lines.join('\n');
}

/* Main entry — fires emails + in-portal notifications.
   status ∈ 'submitted' | 'approved' | 'declined' | 'cancelled'
   `pdfBase64` (optional) is attached to outbound emails as Payment-Request.pdf */
export async function sendPaymentNotifications(db,
  { payment, paymentId, status, actorName, actorUid, pdfBase64, pdfFilename }) {

  const html = buildEmailHtml(payment, paymentId, status, actorName);
  const text = buildEmailText(payment, paymentId, status, actorName);
  const subject = status === 'submitted'
    ? `[Exceed Finance] Payment request — ${fmtAmount(payment)} (${payment.requesterName || ''})`
    : `[Exceed Finance] Payment ${status} — ${fmtAmount(payment)}`;

  let recipients;
  if (status === 'submitted') {
    recipients = submitRecipients(payment);
  } else if (status === 'cancelled') {
    // requester withdrew → silent (per Balraj's pattern with car bookings)
    recipients = [];
  } else {
    recipients = recipientsFor(payment, status);
  }

  const attachments = pdfBase64
    ? [{
        filename: pdfFilename || `Payment-Request-${paymentId}.pdf`,
        content: pdfBase64,
        encoding: 'base64',
        contentType: 'application/pdf'
      }]
    : null;

  // replyTo points at the requester so when approvers hit "Reply" their
  // response goes to the actual person who submitted the request — even
  // though the email itself is sent through the portal's SMTP account.
  // (True From: <requester> needs domain-verified relay; Gmail SMTP refuses.)
  const replyTo = payment.requesterEmail
    ? `${payment.requesterName || 'Exceed team'} <${payment.requesterEmail}>`
    : undefined;

  const writes = recipients.map(to => {
    const message = { subject, html, text };
    if (attachments) message.attachments = attachments;
    const doc = {
      to,
      message,
      createdAt: serverTimestamp(),
      source: 'payment-' + status,
      paymentId
    };
    if (replyTo) doc.replyTo = replyTo;
    return addDoc(collection(db, 'mail'), doc);
  });

  // In-portal bell: requester-only on approval decisions (mirrors car-notify).
  // Approvers get notified by email + see pending in payment.html dashboard list.
  if (payment.requesterUid && (status === 'approved' || status === 'declined')) {
    const titles = {
      approved: 'Payment request approved',
      declined: 'Payment request declined'
    };
    const bodies = {
      approved: `Your ${fmtAmount(payment)} request was approved by ${actorName}.`,
      declined: `Your ${fmtAmount(payment)} request was declined by ${actorName}.`
    };
    writes.push(addDoc(collection(db, 'notifications'), {
      forUid: payment.requesterUid,
      type: 'payment-decision',
      status,
      title: titles[status],
      body: bodies[status],
      link: `payment-approve.html?id=${paymentId}`,
      paymentId,
      createdAt: serverTimestamp(),
      read: false
    }));
  }

  await Promise.all(writes);
}
