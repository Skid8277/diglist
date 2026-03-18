const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

exports.handler = async function (event) {
  const headers = {
    "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };

  let email, message;
  try {
    ({ email, message } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid request body" }) };
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Valid email required" }) };
  }

  // Check for duplicate pending request
  const checkRes = await fetch(
    `${SUPABASE_URL}/rest/v1/access_requests?email=eq.${encodeURIComponent(email)}&status=eq.pending&select=id`,
    { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, "Content-Type": "application/json" } }
  );
  if (checkRes.ok) {
    const existing = await checkRes.json();
    if (existing.length > 0) {
      return { statusCode: 409, headers, body: JSON.stringify({ error: "A request for this email is already pending" }) };
    }
  }

  // Insert request (use service key to bypass RLS on server-side function)
  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/access_requests`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ email, message: message || null, status: "pending" }),
  });

  if (!insertRes.ok) {
    const errBody = await insertRes.json().catch(() => ({}));
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Failed to save request", detail: errBody, status: insertRes.status }) };
  }

  const [request] = await insertRes.json();

  // Notify admin via Resend
  if (RESEND_API_KEY && ADMIN_EMAIL) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: ADMIN_EMAIL,
        subject: `New diglist access request from ${email}`,
        html: `
          <p><strong>${email}</strong> has requested access to diglist.</p>
          ${message ? `<p><strong>Message:</strong> ${message}</p>` : ""}
          <p>Log in to diglist to approve or reject this request.</p>
        `,
      }),
    });
  }

  return { statusCode: 200, headers, body: JSON.stringify({ ok: true, id: request.id }) };
};
