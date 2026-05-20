/* ========================================================================
   payment-notify.js — Shared notification + email dispatcher for payment
   approval requests. Mirrors car-notify.js shape so both flows behave the
   same way (mail rows + in-portal bell + WhatsApp deep links).

   Sequential routing — Mouad always acts first, regardless of amount.

     status 'submitted'      → Mouad reviews + signs.
     If amount ≤ 1,000 AED   → Mouad approves → status 'approved' (done).
     If amount  > 1,000 AED  → Mouad approves → status 'mouad-approved' →
                               Teruo (CEO) reviews + signs → 'approved' (done).
     Decline at any step     → status 'declined' (final).
     Withdrawn by requester  → status 'cancelled' (silent).

   Final-decision recipients (approved / declined): requester + Mouad + Hira
   (+ Teruo on > 1,000 AED tier since he is the second approver).
   ======================================================================== */

import { addDoc, collection, serverTimestamp } from
  "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

export const FINANCE = {
  mouad: 'mouad@exceed-re.ae',
  hira:  'hira@exceed-re.ae',
  ceo:   'teruo@exceed-re.ae'
};

/* WhatsApp numbers for the two approvers — used by the "Send to Mouad" /
   "Send to Teruo" buttons. Format: +<digits>, no spaces. */
export const APPROVER_WA = {
  mouad: '+971585438317',
  teruo: '+971507438754'
};

export const SMALL_AMOUNT_AED = 1000;

/* Payment-email kill-switch — Balraj wants payment emails to come from a
   dedicated finance address, not the portal's general SMTP sender. Until
   that mailbox is set up, skip writing to /mail. The in-portal bell +
   Firestore /payments record still work normally. Flip back to false to
   re-enable email dispatch. */
const SKIP_EMAIL = true;

/* Who is allowed to act on a payment request RIGHT NOW.
   Sequential gate: status determines which approver is active. */
export function canApprovePayment(p, role, email) {
  const e = (email || '').toLowerCase();
  if (role === 'admin') return true;
  const status = p.status || 'submitted';
  if (status === 'submitted') {
    // Initial review always belongs to Mouad (regardless of amount).
    return e === FINANCE.mouad;
  }
  if (status === 'mouad-approved') {
    // Awaiting CEO co-sign for >1,000 AED requests.
    return e === FINANCE.ceo;
  }
  return false;
}

/* Which approver is up next for this payment.
   Returns 'mouad', 'teruo', or null (no further approver needed). */
export function nextApprover(p) {
  const status = p.status || 'submitted';
  if (status === 'submitted') return 'mouad';
  if (status === 'mouad-approved') return 'teruo';
  return null;
}

/* Compute the next status after the current approver clicks Approve.
   Mouad on ≤1k → 'approved'.  Mouad on >1k → 'mouad-approved'.
   Teruo on  >1k → 'approved'. */
export function nextStatusAfterApproval(p, approverEmail) {
  const e = (approverEmail || '').toLowerCase();
  const status = p.status || 'submitted';
  if (status === 'submitted' && e === FINANCE.mouad) {
    return (p.amount || 0) > SMALL_AMOUNT_AED ? 'mouad-approved' : 'approved';
  }
  if (status === 'mouad-approved' && e === FINANCE.ceo) {
    return 'approved';
  }
  // Admin override approves outright.
  return 'approved';
}

/* Recipients for the FINAL decision email (approved / declined).
   Mouad + Hira always get the final paperwork; Teruo also when he was the
   second approver. */
function recipientsFor(p, status) {
  const out = new Set();
  if (p.requesterEmail) out.add(p.requesterEmail.toLowerCase());
  if (status === 'approved' || status === 'declined') {
    out.add(FINANCE.mouad);
    out.add(FINANCE.hira);
    if ((p.amount || 0) > SMALL_AMOUNT_AED) out.add(FINANCE.ceo);
  }
  return [...out];
}

/* Recipients for the initial-submission notification (who acts next).
   Sequential model: ONLY Mouad on a fresh submission. */
export function submitRecipients(p) {
  return [FINANCE.mouad];
}

/* Recipients for the Mouad→CEO hand-off (status = 'mouad-approved').
   Only Teruo needs to act; cc Hira for visibility. */
export function mouadApprovedRecipients() {
  return [FINANCE.ceo, FINANCE.hira];
}

/* WhatsApp deep-link to the named approver with a pre-filled message.
   `target` is 'mouad' | 'teruo'. */
export function whatsappApprovalUrl(target, p, paymentId) {
  const phone = (APPROVER_WA[target] || '').replace(/[^\d+]/g, '').replace(/^\+/, '');
  if (!phone) return '';
  const url = `${portalOrigin()}payment-approve.html?id=${paymentId}`;
  const requester = p.requesterName || p.requesterEmail || 'A team member';
  const isCeo = target === 'teruo';
  const lines = isCeo
    ? [
        '💰 *Payment Approval — CEO co-sign needed*', '',
        `*Amount:* ${fmtAmount(p)}`,
        `*Purpose:* ${p.purpose || '—'}`,
        `*Pay to:* ${p.recipient || '—'}`,
        `*Requester:* ${requester}`,
        `*Due:* ${fmtDate(p.dueDate) || '—'}`,
        '',
        `Mouad has already approved and signed. Please review, sign, and approve:`,
        url
      ]
    : [
        '💰 *Payment Approval Request*', '',
        `*Amount:* ${fmtAmount(p)}`,
        `*Purpose:* ${p.purpose || '—'}`,
        `*Pay to:* ${p.recipient || '—'}`,
        `*Requester:* ${requester}`,
        `*Due:* ${fmtDate(p.dueDate) || '—'}`,
        '',
        '👉 Review, sign, and approve:',
        url
      ];
  return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`;
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
  if (status === 'approved')        return { label: 'Approved',  accent: '#5cc98f' };
  if (status === 'declined')        return { label: 'Declined',  accent: '#ff6b6b' };
  if (status === 'cancelled')       return { label: 'Cancelled', accent: '#ff6b6b' };
  if (status === 'submitted')       return { label: 'Pending — Mouad review', accent: '#d4b87a' };
  if (status === 'mouad-approved')  return { label: 'Pending — CEO co-sign', accent: '#d4b87a' };
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
  const isMouadApproved = status === 'mouad-approved';
  const headline = isPending          ? 'Payment Request — Mouad review'
                  : isMouadApproved   ? 'Payment Request — CEO co-sign needed'
                  : status === 'approved'  ? 'Payment Request Approved'
                  : status === 'declined'  ? 'Payment Request Declined'
                  : 'Payment Request Cancelled';

  const lede = isPending
    ? `A new payment request has been submitted by <strong style="color:#f1ead8;">${p.requesterName || 'a team member'}</strong>. Please review, sign and approve.`
    : isMouadApproved
      ? `Mouad has reviewed and signed. <strong style="color:#f1ead8;">${actorName}</strong> approved as first signatory. CEO co-sign is the last step.`
      : status === 'approved'
        ? `Your request was approved and fully signed off by <strong style="color:#f1ead8;">${actorName}</strong>.`
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
    : status === 'mouad-approved'
      ? `[Exceed Finance] CEO co-sign needed — ${fmtAmount(payment)}`
      : `[Exceed Finance] Payment ${status} — ${fmtAmount(payment)}`;

  let recipients;
  if (status === 'submitted') {
    recipients = submitRecipients(payment);
  } else if (status === 'mouad-approved') {
    // Hand-off: Teruo acts next, Hira gets visibility.
    recipients = mouadApprovedRecipients();
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

  // Skip emails entirely while SKIP_EMAIL is true. The /payments doc and
  // in-portal bell still fire — only the outbound mail queue is bypassed.
  const writes = SKIP_EMAIL ? [] : recipients.map(to => {
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
  // Now also fires on 'mouad-approved' so the requester sees their request has
  // cleared the first gate and is awaiting CEO co-sign.
  if (payment.requesterUid
      && (status === 'approved' || status === 'declined' || status === 'mouad-approved')) {
    const titles = {
      approved:        'Payment request approved',
      declined:        'Payment request declined',
      'mouad-approved': 'Mouad approved — awaiting CEO co-sign'
    };
    const bodies = {
      approved:         `Your ${fmtAmount(payment)} request was fully approved by ${actorName}.`,
      declined:         `Your ${fmtAmount(payment)} request was declined by ${actorName}.`,
      'mouad-approved': `${actorName} signed off — Teruo's CEO co-sign is the last step.`
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
