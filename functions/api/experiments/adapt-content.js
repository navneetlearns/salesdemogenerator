// functions/api/experiments/adapt-content.js
// LLM content adaptation — calls external API

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405);
  }

  try {
    const body = await request.json();
    const { industry, brandName, labels, journeyType } = body;

    // Call LLM API for content adaptation
    const apiKey = env.OPENCODE_API_KEY || '';
    const baseUrl = env.OPENCODE_BASE_URL || 'https://opencode.ai/zen/go/v1';

    if (!apiKey) {
      // If no API key configured, return original labels
      return jsonResponse({ ok: true, labels: labels || {} });
    }

    const systemPrompt = 'You are a content adaptation engine. Rewrite UI labels for the ' +
      (industry || 'general') + ' industry. Brand: ' + (brandName || 'Unknown') + '. ' +
      'Return ONLY a JSON object with the adapted labels. No markdown, no explanation.';

    const llmResponse = await fetch(baseUrl + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(labels || {}) },
        ],
      }),
    });

    const result = await llmResponse.json();

    if (result.choices && result.choices[0] && result.choices[0].message) {
      const content = result.choices[0].message.content;
      // Try to parse JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const adaptedLabels = JSON.parse(jsonMatch[0]);
        return jsonResponse({ ok: true, labels: adaptedLabels });
      }
    }

    // Fallback: return original labels
    return jsonResponse({ ok: true, labels: labels || {} });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
