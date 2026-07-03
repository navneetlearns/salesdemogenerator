// functions/api/health.js
// Health endpoint — returns JSON status (not the SPA fallback HTML).
// Fixes MIGRATION-2: /api/health was falling through to index.html.

export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  return new Response(JSON.stringify({
    status: 'ok',
    version: '1.0.0',
    mode: 'static',
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}