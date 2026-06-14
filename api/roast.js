export const config = { runtime: 'edge' };

export default async function handler(req) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers
    });
  }

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY is not set');
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500, headers
      });
    }

    const { team1, team2, intensity, t1moment, t2moment } = await req.json();

    if (!team1 || !team2 || team1 === team2) {
      return new Response(JSON.stringify({ error: 'Invalid teams' }), {
        status: 400, headers
      });
    }

    const intensityMap = {
      spicy: "mildly savage — sharp wit, football knowledge, funny references. Punchy but not cruel.",
      nuclear: "absolutely ruthless — no mercy, maximum savage, historical trauma weaponised, dark comedy. Go hard.",
      diplomatic: "backhanded compliments only — technically polite, every sentence is a perfectly hidden insult."
    };

    const prompt = `You are the world's greatest football roast comedian. Create a brutal rivalry roast between ${team1} and ${team2} football fans.

Context:
- ${team1}: known for ${t1moment}
- ${team2}: known for ${t2moment}

Intensity: ${intensityMap[intensity] || intensityMap.spicy}

RULES:
- Use REAL historical moments, real years, real scorelines, real players
- Both fanbases get destroyed equally — do NOT favour either side
- Keep it funny, not hateful — punching at football culture, not people
- Roast paragraphs: 4-5 sentences each, punchy
- Player cameo: a famous player from either nation reacting sarcastically
- Verdict: 1-2 devastating sentences that mock both equally

RESPOND ONLY IN THIS EXACT JSON FORMAT (no extra text, no markdown):
{
  "roast1": "roast of ${team1} fans here",
  "roast2": "roast of ${team2} fans here",
  "verdict": "savage verdict mocking both",
  "cameo_player": "famous player name",
  "cameo_nation": "${team1} or ${team2}",
  "cameo_flag": "flag emoji",
  "cameo_quote": "1-2 sentence sarcastic reaction from that player's perspective"
}`;

    console.log(`Roast request: ${team1} vs ${team2}, intensity: ${intensity}`);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`Anthropic API error ${response.status}: ${errBody}`);
      return new Response(JSON.stringify({
        error: 'AI generation failed',
        status: response.status,
        detail: errBody
      }), { status: 502, headers });
    }

    const data = await response.json();
    const raw = data.content?.[0]?.text || '';

    if (!raw) {
      console.error('Empty response from Anthropic:', JSON.stringify(data));
      return new Response(JSON.stringify({ error: 'Empty AI response' }), {
        status: 502, headers
      });
    }

    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return new Response(JSON.stringify(parsed), { status: 200, headers });

  } catch (err) {
    console.error('Roast API error:', err.message, err.stack);
    return new Response(JSON.stringify({
      error: 'Generation failed',
      detail: err.message
    }), { status: 500, headers });
  }
}
