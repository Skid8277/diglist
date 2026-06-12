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

  const { email } = JSON.parse(event.body);
  if (!email) return { statusCode: 400, headers, body: JSON.stringify({ error: "Email required" }) };

  const res = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
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