const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

function verifyAdmin(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const userToken = authHeader.replace("Bearer ", "");
  try {
    const parts = userToken.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return payload.email === ADMIN_EMAIL ? payload.email : null;
  } catch { return null; }
}

exports.handler = async function (event) {
  const headers = {
    "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };

  const admin = verifyAdmin(event);
  if (!admin) return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden" }) };

  // GET — list pending requests
  if (event.httpMethod === "GET") {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/access_requests?status=eq.pending&order=created_at.asc&select=id,email,message,created_at`,
      { headers: { apikey: SUPABASE_SERVICE_KEY, "Content-Type": "application/json" } }
    );
    if (!res.ok) return { statusCode: 500, headers, body: JSON.stringify({ error: "Failed to fetch requests" }) };
    return { statusCode: 200, headers, body: JSON.stringify(await res.json()) };
  }

  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };

  let requestId, action;
  try {
    ({ requestId, action } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid request body" }) };
  }

  if (!requestId || !['approved', 'rejected'].includes(action)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "requestId and action (approved|rejected) required" }) };
  }

  // Fetch the request
  const fetchRes = await fetch(
    `${SUPABASE_URL}/rest/v1/access_requests?id=eq.${requestId}&select=email,status`,
    { headers: { apikey: SUPABASE_SERVICE_KEY, "Content-Type": "application/json" } }
  );
  if (!fetchRes.ok) return { statusCode: 500, headers, body: JSON.stringify({ error: "Failed to fetch request" }) };
  const [request] = await fetchRes.json();
  if (!request) return { statusCode: 404, headers, body: JSON.stringify({ error: "Request not found" }) };
  if (request.status !== 'pending') return { statusCode: 409, headers, body: JSON.stringify({ error: "Request already processed" }) };

  // Update status
  await fetch(`${SUPABASE_URL}/rest/v1/access_requests?id=eq.${requestId}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ status: action }),
  });

  // If approved, create user via Supabase Admin API + notify via Resend
  if (action === 'approved') {
    const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: request.email, email_confirm: true }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      const err = (() => { try { return JSON.parse(errText); } catch { return { message: errText }; } })();
      if (!err.message?.toLowerCase().includes('already')) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: "Failed to create user", detail: err.message }) };
      }
    }

    const siteUrl = process.env.ALLOWED_ORIGIN || 'https://diglist.net';
    await fetch('https://api.resend.com/emails', {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM,
        to: request.email,
        subject: "You're in — diglist access approved",
        html: `<p>Your request to join diglist has been approved.</p><p>Head to <a href="${siteUrl}">${siteUrl}</a> and enter your email to receive a magic link.</p>`,
      }),
    });
  }

  return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
};
