import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_ADDRESS   = 'onboarding@resend.dev'; // swap to invite@evensteven.app after domain purchase pre-launch
const INVITE_BASE    = 'even-steven-five.vercel.app/invite';

interface InviteEmailPayload {
  to: string;
  inviterName: string;
  groupName: string;
  groupType: string;
  startDate?: string | null;
  endDate?: string | null;
  memberCount: number;
  token: string;
}

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let payload: InviteEmailPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const {
    to,
    inviterName,
    groupName,
    groupType,
    startDate,
    endDate,
    memberCount,
    token,
  } = payload;

  const inviteUrl = `https://${INVITE_BASE}/${token}`;

  const dateRange =
    groupType === 'Trip' && startDate && endDate
      ? `<p style="color:#999;margin:0 0 8px">${formatDate(startDate)} – ${formatDate(endDate)}</p>`
      : '';

  const html = `
<!DOCTYPE html>
<html>
<body style="background:#0b0b0b;font-family:Inter,sans-serif;color:#fff;padding:40px 24px;max-width:480px;margin:auto">
  <h1 style="font-size:24px;margin:0 0 8px;color:#00C896">Even Steven</h1>
  <p style="color:#999;margin:0 0 32px;font-size:14px">Split expenses, stay square.</p>

  <p style="font-size:16px;margin:0 0 4px"><strong>${inviterName}</strong> invited you to join:</p>
  <h2 style="font-size:28px;margin:8px 0 4px">${groupName}</h2>
  <p style="color:#999;margin:0 0 4px;text-transform:capitalize">${groupType}</p>
  ${dateRange}
  <p style="color:#999;margin:0 0 32px;font-size:14px">${memberCount} ${memberCount === 1 ? 'member' : 'members'} already inside</p>

  <a href="${inviteUrl}" style="display:inline-block;background:#00C896;color:#fff;padding:14px 32px;border-radius:100px;font-size:16px;font-weight:600;text-decoration:none">
    Join group
  </a>

  <p style="color:#555;font-size:12px;margin:32px 0 0">
    If the button doesn't work, copy this link:<br>
    <a href="${inviteUrl}" style="color:#00C896">${inviteUrl}</a>
  </p>
  <p style="color:#333;font-size:12px;margin:16px 0 0">
    The link opens the app if installed, or redirects to the App Store / Play Store.
  </p>
</body>
</html>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to,
      subject: `${inviterName} invited you to join ${groupName} on Even Steven`,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    return new Response(JSON.stringify({ error: body }), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ sent: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
