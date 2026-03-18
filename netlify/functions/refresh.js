exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { refresh_token } = body;
  if (!refresh_token) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing refresh_token' }) };
  }

  const { SUPABASE_URL, SUPABASE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfigured' }) };
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { statusCode: 401, body: JSON.stringify({ error: data.error_description || 'Refresh failed' }) };
    }
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: data.access_token, refresh_token: data.refresh_token }),
    };
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: 'Failed to reach Supabase' }) };
  }
};
