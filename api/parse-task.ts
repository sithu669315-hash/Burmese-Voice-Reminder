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

function heuristicParseBurmeseTask(input: string, today: string) {
  let title = input.trim();
  let date = today;
  let time = '12:00';
  let category = 'ကိုယ်ရေးကိုယ်တာ';
  let priority: 'high' | 'medium' | 'low' = 'medium';

  const lower = input.toLowerCase();

  // Date detection
  if (lower.includes('မနက်ဖြန်') || lower.includes('နောက်နေ့')) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    date = d.toISOString().split('T')[0];
  } else if (lower.includes('သဘက်ခါ')) {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    date = d.toISOString().split('T')[0];
  }

  // Time detection
  if (lower.includes('မနက် ၆') || lower.includes('၆ နာရီခွဲ')) time = '06:00';
  else if (lower.includes('မနက် ၇') || lower.includes('၇ နာရီ')) time = '07:00';
  else if (lower.includes('မနက် ၈') || lower.includes('၈ နာရီ')) time = '08:00';
  else if (lower.includes('မနက် ၉') || lower.includes('၉ နာရီ')) time = '09:00';
  else if (lower.includes('မနက် ၁၀') || lower.includes('၁၀ နာရီ')) time = '10:00';
  else if (lower.includes('မနက် ၁၁') || lower.includes('၁၁ နာရီ')) time = '11:00';
  else if (lower.includes('နေ့လယ် ၁၂') || lower.includes('၁၂ နာရီ')) time = '12:00';
  else if (lower.includes('မွန်းလွဲ ၁') || lower.includes('၁ နာရီ')) time = '13:00';
  else if (lower.includes('မွန်းလွဲ ၂') || lower.includes('၂ နာရီ')) time = '14:00';
  else if (lower.includes('မွန်းလွဲ ၃') || lower.includes('၃ နာရီ')) time = '15:00';
  else if (lower.includes('ညနေ ၄') || lower.includes('၄ နာရီ')) time = '16:00';
  else if (lower.includes('ညနေ ၅') || lower.includes('၅ နာရီ')) time = '17:00';
  else if (lower.includes('ည ၇') || lower.includes('၇ နာရီ')) time = '19:00';
  else if (lower.includes('ည ၈') || lower.includes('၈ နာရီ')) time = '20:00';
  else if (lower.includes('ည ၉') || lower.includes('၉ နာရီ')) time = '21:00';

  // Category detection
  if (
    lower.includes('အလုပ်') ||
    lower.includes('ရုံး') ||
    lower.includes('အစည်းအဝေး') ||
    lower.includes('ပရောဂျက်')
  ) {
    category = 'အလုပ်';
  } else if (
    lower.includes('ဆေး') ||
    lower.includes('ရေသောက်') ||
    lower.includes('ကျန်းမာ') ||
    lower.includes('လေ့ကျင့်ခန်း') ||
    lower.includes('လမ်းလျှောက်')
  ) {
    category = 'ကျန်းမာရေး';
  } else if (
    lower.includes('စာအုပ်') ||
    lower.includes('စာဖတ်') ||
    lower.includes('သင်တန်း') ||
    lower.includes('ကျောင်း') ||
    lower.includes('လေ့လာ')
  ) {
    category = 'ပညာရေး';
  }

  // Priority detection
  if (lower.includes('အရေးကြီး') || lower.includes('အရေးပေါ်') || lower.includes('မဖြစ်မနေ')) {
    priority = 'high';
  }

  return {
    title: title || 'အသံဖြင့် ထည့်သွင်းထားသော တာဝန်',
    date,
    time,
    category,
    priority,
    ttsMessage: `${title || 'တာဝန်'} ပြုလုပ်ရန် အချိန်ကျရောက်ပါပြီ`,
  };
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
    const { text, today = new Date().toISOString().split('T')[0], apiKey } = req.body || {};

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required to parse task' });
    }

    const ai = getAIClient(apiKey);

    if (ai) {
      try {
        const prompt = `You are an expert multilingual AI assistant for a Burmese Daily Reminder App.
The user spoke or entered this Burmese voice task: "${text.trim()}".
Today's local date is: ${today}.

Extract and schedule the task accurately.
Return ONLY a valid JSON object with NO surrounding markdown backticks:
{
  "title": "Clean, concise task title in Burmese script (e.g. 'ရုံးအစည်းအဝေး တက်ရောက်ရန်', 'ရေသောက်ရန်', 'ဆေးသောက်ရန်')",
  "date": "YYYY-MM-DD (e.g. today '${today}', or tomorrow if user said 'မနက်ဖြန်'/'နောက်နေ့', or specific date)",
  "time": "HH:mm in 24-hour format (e.g. '09:00', '14:30', '17:00', '20:00'; default to '12:00' if no time mentioned)",
  "category": "Exactly one of: 'အလုပ်' | 'ကိုယ်ရေးကိုယ်တာ' | 'ကျန်းမာရေး' | 'ပညာရေး'",
  "priority": "Exactly one of: 'high' | 'medium' | 'low'",
  "ttsMessage": "A natural, polite Burmese reminder sentence to speak aloud when the alarm triggers"
}`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        });

        const rawJson = response.text?.trim() || '';
        const parsed = JSON.parse(rawJson);

        if (parsed.title) {
          return res.json({
            success: true,
            source: 'gemini',
            task: {
              title: parsed.title,
              date: parsed.date || today,
              time: parsed.time || '12:00',
              category: parsed.category || 'ကိုယ်ရေးကိုယ်တာ',
              priority: parsed.priority || 'medium',
              ttsMessage: parsed.ttsMessage || `${parsed.title} ပြုလုပ်ရန် အချိန်တန်ပါပြီ`,
            },
          });
        }
      } catch (aiErr) {
        console.warn('Gemini parse error on Vercel function, using heuristic fallback:', aiErr);
      }
    }

    // Heuristic Fallback (Always succeeds even in restricted location or without key)
    const fallback = heuristicParseBurmeseTask(text, today);
    return res.json({
      success: true,
      source: 'heuristic',
      task: fallback,
    });
  } catch (error: any) {
    console.error('Task parse error on Vercel function:', error);
    return res.status(500).json({ error: error?.message || 'Failed to parse task' });
  }
}
