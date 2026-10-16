import { GoogleGenAI } from '@google/genai';

// Helper to get GoogleGenAI client
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

// Fetch Google Translate Burmese TTS audio (high quality, unrestricted globally)
async function fetchGoogleBurmeseTTS(text: string): Promise<{ audioData: string; mimeType: string }> {
  const cleanText = text.trim().slice(0, 250);
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=my&client=tw-ob&q=${encodeURIComponent(cleanText)}`;
  
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'audio/mpeg,audio/*;q=0.9,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Google Burmese TTS failed with status ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return {
    audioData: buffer.toString('base64'),
    mimeType: 'audio/mpeg',
  };
}

export default async function handler(req: any, res: any) {
  // Setup CORS
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
    const { text, apiKey, voiceName = 'Kore', engine = 'auto' } = req.body || {};

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required for TTS' });
    }

    // If explicit Google engine requested, skip Gemini
    if (engine === 'google') {
      try {
        const googleAudio = await fetchGoogleBurmeseTTS(text);
        return res.json({
          success: true,
          audioData: googleAudio.audioData,
          mimeType: googleAudio.mimeType,
          engine: 'google',
          modelUsed: 'google-translate-burmese',
        });
      } catch (err: any) {
        console.warn('Google Burmese TTS error:', err);
        return res.status(500).json({ error: err?.message || 'Google TTS failed' });
      }
    }

    // Try Gemini TTS first if API key is present or configured
    const ai = getAIClient(apiKey);
    let geminiAudioData: string | undefined;
    let geminiMimeType = 'audio/wav';
    let geminiModelUsed = '';
    let geminiError: any = null;

    if (ai && engine !== 'google') {
      const promptText = `Speak the following Burmese text clearly in natural, warm, and authentic Burmese (Myanmar) language:\n\n${text.trim()}`;
      const modelsToTry = [
        'gemini-3.8-flash-lite-tts',
        'gemini-3.8-flash-tts',
        'gemini-2.5-flash-preview-tts',
        'gemini-2.5-flash',
      ];

      for (const model of modelsToTry) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: [
              {
                role: 'user',
                parts: [{ text: promptText }],
              },
            ],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: voiceName || 'Kore' },
                },
              },
            },
          });

          const part = response.candidates?.[0]?.content?.parts?.[0];
          if (part?.inlineData?.data) {
            geminiAudioData = part.inlineData.data;
            geminiMimeType = part.inlineData.mimeType || 'audio/wav';
            geminiModelUsed = model;
            break;
          }
        } catch (err: any) {
          geminiError = err;
          console.warn(`Model ${model} TTS attempt failed:`, err?.message || err);
        }
      }
    }

    if (geminiAudioData) {
      return res.json({
        success: true,
        audioData: geminiAudioData,
        mimeType: geminiMimeType,
        engine: 'gemini',
        modelUsed: geminiModelUsed,
      });
    }

    // If Gemini failed (restricted location, missing key, quota exceeded, 403),
    // automatically fall back to Google Burmese Voice so the user is never left without voice!
    try {
      const fallbackAudio = await fetchGoogleBurmeseTTS(text);
      return res.json({
        success: true,
        audioData: fallbackAudio.audioData,
        mimeType: fallbackAudio.mimeType,
        engine: 'google',
        modelUsed: 'google-translate-burmese-fallback',
        fallbackReason: geminiError?.message || 'Gemini unavailable or restricted location',
      });
    } catch (fallbackErr: any) {
      console.error('All TTS engines failed:', fallbackErr);
      return res.status(500).json({
        error: geminiError?.message || fallbackErr?.message || 'Failed to generate Burmese voice',
      });
    }
  } catch (error: any) {
    console.error('API TTS Handler Error:', error);
    return res.status(500).json({
      error: error?.message || 'Server error generating speech',
    });
  }
}
