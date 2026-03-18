const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

exports.handler = async function (event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };

  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: "Unauthenticated" }) };
  }
  const userToken = authHeader.replace("Bearer ", "");

  const base = `${SUPABASE_URL}/rest/v1/items`;
  const sbHeaders = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${userToken}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };

  try {
    if (event.httpMethod === "GET") {
      const res = await fetch(`${base}?order=updated_at.desc`, { headers: sbHeaders });
      if (!res.ok) return { statusCode: res.status, headers, body: JSON.stringify({ error: 'Supabase error' }) };
      const data = await res.json();
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

if (event.httpMethod === "POST") {
  const body = JSON.parse(event.body);

  // Decode user_id from JWT with validation
  let user_id;
  try {
    const parts = userToken.split('.');
    if (parts.length !== 3) throw new Error('Invalid token structure');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    if (!payload.sub) throw new Error('Missing sub claim');
    user_id = payload.sub;
  } catch (e) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid token' }) };
  }

  const res = await fetch(base, {
    method: "POST",
    headers: { ...sbHeaders, Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ ...body, user_id }),
  });
  const data = await res.json();
  return { statusCode: 200, headers, body: JSON.stringify(data) };
}

    if (event.httpMethod === "DELETE") {
      const { id } = JSON.parse(event.body);
      const res = await fetch(`${base}?id=eq.${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: sbHeaders,
      });
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};