// functions/api/experiments/save-content.js
// Save adapted content overrides to KV

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204 });
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method Not Allowed' }, 405);
    }

    try {
      const body = await request.json();
      const { sessionId, overrides } = body;

      // Store overrides in KV with session key
      const key = 'overrides/' + (sessionId || 'default');
      await env.SHARES.put(key, JSON.stringify(overrides || {}), { expirationTtl: 86400 });

      return jsonResponse({ ok: true });
    } catch (err) {
      return jsonResponse({ error: err.message }, 500);
    }
  },
};

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
