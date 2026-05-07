/* ========================================================================
   car-notify.js — Shared notification + email dispatcher for car bookings.

   Used by:
     book-car.html   — to fire notifications when a booking is cancelled
     car-approve.html — to fire notifications when approved or declined

   Recipients:
     APPROVED  → requester + Shoya + Malik (only if requester reports to him)
     DECLINED  → requester only
     CANCELLED → requester + Shoya + Malik (only if requester reports to him)

   Each recipient gets one row in /mail (Trigger Email extension picks it up).
   The requester also gets a row in /notifications for the in-portal bell.
   ======================================================================== */

import { addDoc, collection, doc, getDoc, serverTimestamp } from
  "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

/* Approval / cancellation recipients (edit if the team changes) */
export const NOTIFY_EMAILS = {
  shoya: 'shoya@exceed-re.ae',
  malik: 'malik@exceed-re.ae'
};
const MALIK_TEAM_SECTIONS = ['dubai-sales'];

/* Mansoor — company driver. Notified via WhatsApp deep link, not email. */
export const DRIVER = {
  name: 'Mansoor',
  phone: '+971566118712'
};

/* ----- Helpers ----- */
function nameKey(s) {
  return (s || '').toString().toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export async function isUnderMalik(db, booking) {
  try {
    const tcSnap = await getDoc(doc(db, 'teamConfig', 'main'));
    if (!tcSnap.exists()) return false;
    const tc = tcSnap.data();
    const reqEmail = (booking.requesterEmail || '').toLowerCase();
    const reqUid   = booking.requesterUid;
    const reqName  = nameKey(booking.requesterName || '');
    for (const section of MALIK_TEAM_SECTIONS) {
      const arr = tc[section];
      if (!Array.isArray(arr)) continue;
      for (const m of arr) {
        if (!m) continue;
        if (nameKey(m.name).includes('malik')) continue; // Malik himself
        if (m.uid && m.uid === reqUid) return true;
        if (m.email && m.email.toLowerCase() === reqEmail) return true;
        if (reqName && nameKey(m.name) === reqName) return true;
      }
    }
    return false;
  } catch (_) { return false; }
}

function fmtRangeStatic(b, lang) {
  const start = new Date(b.startISO);
  const end = new Date(b.endISO);
  const datePart = new Intl.DateTimeFormat(lang === 'ja' ? 'ja-JP' : 'en-GB',
    { year: 'numeric', month: 'short', day: 'numeric', weekday: 'short' }).format(start);
  const timeFmt = new Intl.DateTimeFormat(lang === 'ja' ? 'ja-JP' : 'en-GB',
    { hour: '2-digit', minute: '2-digit' });
  return `${datePart} · ${timeFmt.format(start)} – ${timeFmt.format(end)}`;
}

function carName(b) {
  return b.car === 'phantom' ? 'Rolls-Royce Phantom' : 'Cadillac Escalade';
}

function portalOrigin() {
  return location.origin + location.pathname.replace(/[^/]+$/, '');
}

/* Google Calendar quick-add link for an approved booking */
export function gcalTemplateUrl(b, bookingId) {
  const requester = b.requesterName || 'Team';
  const title = `🚗 ${carName(b)} — booked by ${requester}`;
  const start = new Date(b.startISO);
  const end = new Date(b.endISO);
  const fmt = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const dates = `${fmt(start)}/${fmt(end)}`;
  const details = [
    `Car: ${carName(b)}`,
    `Booked by: ${requester}${b.requesterEmail ? ' (' + b.requesterEmail + ')' : ''}`,
    b.client     ? `Client: ${b.client}` : '',
    b.property   ? `Property: ${b.property}` : '',
    b.leadSource ? `Lead source: ${b.leadSource}` : '',
    b.budget     ? `Budget: ${Number(b.budget).toLocaleString()} AED` : '',
    b.notes      ? `Notes: ${b.notes}` : '',
    '',
    `Booking ref: ${portalOrigin()}car-approve.html?id=${bookingId}`
  ].filter(Boolean).join('\n');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates,
    details,
    location: b.area || ''
  });
  return 'https://calendar.google.com/calendar/render?' + params.toString();
}

/* WhatsApp deep link to message Mansoor (the driver) about a booking */
export function driverWhatsappUrl(b, kind /* 'ready' | 'cancelled' */) {
  const start = new Date(b.startISO);
  const end = new Date(b.endISO);
  const requester = b.requesterName || 'Team';
  const dateStr = start.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
  const lines = [];
  if (kind === 'cancelled') {
    lines.push('🚫 *社用車予約キャンセル / Car booking CANCELLED*', '');
  } else {
    lines.push('🚗 *社用車予約 / Car booking ready*', '');
  }
  lines.push(`*Vehicle:* ${carName(b)}`);
  lines.push(`*Pickup:*  ${dateStr} · ${timeFmt.format(start)}`);
  lines.push(`*Drop:*    ${dateStr} · ${timeFmt.format(end)}`);
  lines.push(`*Booked by:* ${requester}`);
  if (b.area)     lines.push(`*Pickup area:* ${b.area}`);
  if (b.property) lines.push(`*Property:* ${b.property}`);
  if (b.client)   lines.push(`*Client:* ${b.client}`);
  if (b.notes)    lines.push(`*Notes:* ${b.notes}`);
  lines.push('', kind === 'cancelled'
    ? 'This booking has been cancelled. No need to prepare the car.'
    : 'Please prepare the car. Thank you!');
  const phone = DRIVER.phone.replace(/[^\d+]/g, '').replace(/^\+/, '');
  return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`;
}

/* HTML email body for an approve/decline/cancel decision */
function buildEmailHtml(b, bookingId, status, actorName) {
  const isApproved  = status === 'approved';
  const isDeclined  = status === 'declined';
  const isCancelled = status === 'cancelled';
  const accent = isApproved ? '#5cc98f' : '#ff6b6b';
  const statusLabel = isApproved ? 'Approved' : isDeclined ? 'Declined' : 'Cancelled';
  const headline = isApproved ? 'Car Booking Approved'
                  : isDeclined ? 'Car Booking Declined'
                  : 'Car Booking Cancelled';
  const detailUrl = `${portalOrigin()}car-approve.html?id=${bookingId}`;
  const portalCal = `${portalOrigin()}availability.html`;
  const gcalUrl = gcalTemplateUrl({ ...b, __id: bookingId }, bookingId);
  const row = (k, v) => v && v !== '—'
    ? `<tr><td style="padding:6px 0;color:#9aa8c2;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;width:140px;vertical-align:top;">${k}</td><td style="padding:6px 0;color:#f1ead8;font-size:14px;">${v}</td></tr>`
    : '';

  const sentence = isApproved
    ? `Your request for the <strong style="color:#f1ead8;">${carName(b)}</strong> was approved by <strong style="color:#f1ead8;">${actorName}</strong>.`
    : isDeclined
      ? `Your request for the <strong style="color:#f1ead8;">${carName(b)}</strong> was declined by <strong style="color:#f1ead8;">${actorName}</strong>.`
      : `The <strong style="color:#f1ead8;">${carName(b)}</strong> booking for ${fmtRangeStatic(b, 'en')} has been cancelled by <strong style="color:#f1ead8;">${actorName}</strong>.`;

  const ctas = [];
  ctas.push(`<a href="${detailUrl}" style="display:inline-block;margin:4px 6px;padding:12px 22px;background:linear-gradient(135deg,#f1ead8,#d4b87a);color:#0a1f3d;text-decoration:none;border-radius:8px;font-weight:700;font-size:12px;letter-spacing:1.2px;text-transform:uppercase;">View Booking</a>`);
  if (isApproved) {
    ctas.push(`<a href="${gcalUrl}" style="display:inline-block;margin:4px 6px;padding:12px 22px;background:rgba(135,179,157,0.18);color:#87b39d;text-decoration:none;border:1px solid rgba(135,179,157,0.5);border-radius:8px;font-weight:700;font-size:12px;letter-spacing:1.2px;text-transform:uppercase;">📅 Add to Google Calendar</a>`);
  }
  ctas.push(`<a href="${portalCal}" style="display:inline-block;margin:4px 6px;padding:12px 22px;background:transparent;color:#d4b87a;text-decoration:none;border:1px solid #d4b87a;border-radius:8px;font-weight:600;font-size:12px;letter-spacing:1.2px;text-transform:uppercase;">Open Portal Calendar</a>`);

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#051428;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;color:#f5f7fb;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-family:Georgia,serif;font-size:18px;letter-spacing:3px;color:#d4b87a;">EXCEED REAL ESTATE</div>
      <div style="font-size:10px;letter-spacing:3px;color:#9aa8c2;text-transform:uppercase;margin-top:6px;">DUBAI</div>
    </div>
    <div style="background:linear-gradient(180deg,#0a1f3d,#102a4f);border:1px solid rgba(255,255,255,0.10);border-radius:14px;padding:24px;">
      <div style="display:inline-block;padding:5px 12px;border-radius:999px;background:${accent}26;color:${accent};border:1px solid ${accent}66;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:14px;">
        ${statusLabel}
      </div>
      <h2 style="font-family:Georgia,serif;font-weight:600;font-size:22px;margin:0 0 6px;color:#f1ead8;">${headline}</h2>
      <p style="color:#d4b87a;font-size:15px;font-weight:600;margin:0 0 18px;">${fmtRangeStatic(b, 'en')}</p>
      <p style="color:#9aa8c2;font-size:13px;margin:0 0 16px;line-height:1.5;">${sentence}</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;border-top:1px solid rgba(255,255,255,0.10);border-bottom:1px solid rgba(255,255,255,0.10);">
        ${row('Vehicle', carName(b))}
        ${row('When', fmtRangeStatic(b, 'en'))}
        ${row('Property', b.property)}
        ${row('Area', b.area)}
        ${row('Lead source', b.leadSource)}
        ${row('Client', b.client)}
        ${row('Budget (AED)', b.budget ? Number(b.budget).toLocaleString() : '')}
        ${row('Notes', b.notes)}
      </table>
      <div style="margin-top:22px;text-align:center;">
        ${ctas.join('')}
      </div>
    </div>
    <div style="text-align:center;margin-top:18px;color:#9aa8c2;font-size:11px;letter-spacing:1px;">
      Exceed Real Estate · Dubai · automated message
    </div>
  </div>
</body></html>`;
}

/* Plain-text fallback */
function buildEmailText(b, bookingId, status, actorName) {
  const lines = [
    `Car booking ${status.toUpperCase()}`,
    '',
    `${status === 'cancelled' ? 'Cancelled' : 'Decided'} by: ${actorName}`,
    `Vehicle: ${carName(b)}`,
    `When: ${fmtRangeStatic(b, 'en')}`,
    `Property: ${b.property || '—'}`,
    `Area: ${b.area || '—'}`,
    `Lead source: ${b.leadSource || '—'}`,
    `Client: ${b.client || '—'}`,
    `Budget: ${b.budget ? Number(b.budget).toLocaleString() + ' AED' : '—'}`,
    `Notes: ${b.notes || '—'}`
  ];
  if (status === 'approved') {
    lines.push('', `Add to Google Calendar: ${gcalTemplateUrl({ ...b, __id: bookingId }, bookingId)}`);
  }
  lines.push('', '— Exceed Real Estate, Dubai');
  return lines.join('\n');
}

/* Main entry — fires emails + in-portal notification for a booking decision */
export async function sendCarBookingNotifications(db, { booking, bookingId, status, actorName }) {
  const html = buildEmailHtml(booking, bookingId, status, actorName);
  const text = buildEmailText(booking, bookingId, status, actorName);
  const subject = `[Exceed] Car booking ${status} — ${carName(booking)}`;

  // Recipients:
  //   approved / cancelled → requester + Shoya + (Malik if Dubai Sales)
  //   declined            → requester only
  const recipients = [];
  if (booking.requesterEmail) recipients.push(booking.requesterEmail);
  if (status === 'approved' || status === 'cancelled') {
    recipients.push(NOTIFY_EMAILS.shoya);
    if (await isUnderMalik(db, booking)) recipients.push(NOTIFY_EMAILS.malik);
  }
  const uniqueRecipients = [...new Set(recipients.filter(Boolean).map(e => e.toLowerCase()))];

  const writes = uniqueRecipients.map(to =>
    addDoc(collection(db, 'mail'), {
      to,
      message: { subject, html, text },
      createdAt: serverTimestamp(),
      source: 'car-' + status,
      bookingId
    })
  );

  // In-portal notification for the requester
  if (booking.requesterUid) {
    const titles = {
      approved:  `Car booking approved`,
      declined:  `Car booking declined`,
      cancelled: `Car booking cancelled`
    };
    const bodies = {
      approved:  `Your ${carName(booking)} request for ${fmtRangeStatic(booking, 'en')} was approved by ${actorName}.`,
      declined:  `Your ${carName(booking)} request for ${fmtRangeStatic(booking, 'en')} was declined by ${actorName}.`,
      cancelled: `The ${carName(booking)} booking for ${fmtRangeStatic(booking, 'en')} was cancelled by ${actorName}.`
    };
    writes.push(addDoc(collection(db, 'notifications'), {
      forUid: booking.requesterUid,
      type: 'car-booking-decision',
      status,
      title: titles[status],
      body: bodies[status],
      link: `car-approve.html?id=${bookingId}`,
      bookingId,
      createdAt: serverTimestamp(),
      read: false
    }));
  }

  await Promise.all(writes);
}
