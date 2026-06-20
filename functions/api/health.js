// functions/api/health.js
// Health check endpoint — returns JSON status

export default {
  async fetch(request, env, ctx) {
    return new Response(
      JSON.stringify({ status: 'ok', version: '1.0.0', mode: 'static' }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  },
};
