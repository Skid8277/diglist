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

  const { email, token } = JSON.parse(event.body);
  if (!email || !token) return { statusCode: 400, headers, body: JSON.stringify({ error: "Email and code required" }) };

  const res = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, token, type: "email" }),
  });

  const data = await res.json();
  if (!res.ok) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: data.error_description || data.msg || "Invalid or expired code" }) };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ access_token: data.access_token, refresh_token: data.refresh_token }),
  };
};
