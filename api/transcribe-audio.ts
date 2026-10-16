import { GoogleGenAI } from '@google/genai';

function getAIClient(customKey?: string) {
  const keyToUse =
    (customKey && typeof customKey === 'string' && customKey.trim()) ||
    process.env.GEMINI_API_KEY;

  if (!keyToUse) return null;

  return new GoogleGenAI({
    apiKey: keyToUse,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const {
      audioBase64,
      mimeType = 'audio/webm',
      today = new Date().toISOString().split('T')[0],
      apiKey,
    } = req.body || {};

    if (!audioBase64) {
      return res.status(400).json({ error: 'Audio data is required' });
    }

    const ai = getAIClient(apiKey);
    if (!ai) {
      return res.status(400).json({ error: 'Gemini API Key is not configured on server' });
    }

    const prompt = `The user recorded an audio voice note in Burmese to add a daily task reminder.
Today's local date is: ${today}.

1. Listen to the audio and transcribe the spoken words accurately into clean Myanmar Unicode script.
2. Extract the task details (title, date, time, category, priority, and ttsMessage).

Return ONLY a valid JSON object matching this schema:
{
  "transcript": "Exact transcription in Myanmar Unicode script",
  "task": {
    "title": "Clean, concise Burmese task title",
    "date": "YYYY-MM-DD",
    "time": "HH:mm",
    "category": "အလုပ်" or "ကိုယ်ရေးကိုယ်တာ" or "ကျန်းမာရေး" or "ပညာရေး",
    "priority": "high" or "medium" or "low",
    "ttsMessage": "Burmese spoken reminder sentence"
  }
}`;

    const audioPart = {
      inlineData: {
        data: audioBase64,
        mimeType: mimeType.split(';')[0] || 'audio/webm',
      },
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: { parts: [audioPart, { text: prompt }] },
      config: {
        responseMimeType: 'application/json',
      },
    });

    const rawJson = response.text?.trim() || '';
    const parsed = JSON.parse(rawJson);

    return res.json({
      success: true,
      transcript: parsed.transcript || '',
      task: parsed.task || null,
    });
  } catch (error: any) {
    console.error('Audio transcription error on Vercel function:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to transcribe audio with Gemini',
    });
  }
}
