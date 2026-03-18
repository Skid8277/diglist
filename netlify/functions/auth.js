const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

exports.handler = async function (event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };

  const { email, redirectTo } = JSON.parse(event.body);
  if (!email) return { statusCode: 400, headers, body: JSON.stringify({ error: "Email required" }) };

  const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN;
  try {
    const redirectUrl = new URL(redirectTo);
    const allowedUrl = new URL(ALLOWED_ORIGIN);
    const isMainOrigin = redirectUrl.origin === allowedUrl.origin;
    const isNetlifyPreview = redirectUrl.hostname.endsWith('.netlify.app');
    if (!isMainOrigin && !isNetlifyPreview) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid redirect URL" }) };
    }
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid redirect URL" }) };
  }

  const res = await fetch(`${SUPABASE_URL}/auth/v1/otp?redirect_to=${encodeURIComponent(redirectTo)}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, create_user: false }),
  });

  if (!res.ok) {
    const err = await res.json();
    return { statusCode: 400, headers, body: JSON.stringify({ error: err.msg || "Supabase error" }) };
  }

  return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
};