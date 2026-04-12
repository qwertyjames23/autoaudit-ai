const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = 'gpt-4o-mini';

const SYSTEM_PROMPT = `You are an expert AI automation consultant. Analyze the business workflow provided and identify concrete automation opportunities.

Return ONLY a valid JSON object — no markdown, no code fences, no explanation outside the JSON.

The JSON must follow this exact schema:
{
  "summary": "2–3 sentence overview of what you found",
  "opportunities": [
    {
      "pain": "Short label for the manual task (e.g. 'Manual order tracking via Facebook Messages')",
      "solution": "Specific automation solution in 1–2 sentences",
      "tools": ["Tool1", "Tool2"],
      "timeSaved": "e.g. 3 hrs/week"
    }
  ],
  "totalTimeSaved": "e.g. 8–12 hrs/week",
  "difficulty": "Low"
}

Rules:
- Return 3 to 5 opportunities. Always find at least 3 even for simple workflows.
- Tools must be real, specific tool names (n8n, Zapier, Make, Airtable, Notion, Slack, Google Sheets, Gmail, Messenger API, Supabase, Shopify, ActiveCampaign, etc.)
- timeSaved must be a specific estimate, not vague
- difficulty must be "Low", "Medium", or "High"
- Make the summary personally address the business owner and sound helpful, not salesy`;

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (!OPENAI_API_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  const { industry, teamSize, workflow, name } = body;

  if (!workflow || workflow.trim().length < 10) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Workflow description is required' }) };
  }

  const userPrompt = `Business owner name: ${name || 'Business Owner'}
Industry: ${industry || 'Unknown'}
Team size: ${teamSize || 'Unknown'}
Workflow description:
${workflow.trim()}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenAI API error:', response.status, errText);
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'AI service unavailable' }) };
    }

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content || '';

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (e) {
      console.error('JSON parse error. Raw:', rawText);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to parse AI response' }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify(parsed) };

  } catch (err) {
    console.error('Function error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
