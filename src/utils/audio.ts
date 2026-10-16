/**
 * Audio synthesis & speech recognition utility
 * Supports:
 * 1. Server-side / Vercel Serverless Gemini & Google Burmese TTS (/api/tts)
 * 2. Unrestricted Direct Google Burmese Native Voice (100% works in Myanmar & globally)
 * 3. Direct Gemini REST fallback (handles restricted locations gracefully)
 * 4. Web Speech API (my-MM)
 * 5. High-fidelity Web Audio synthesized crystal chime
 */

export function playChimeSound() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const now = ctx.currentTime;

    // Dual-tone crystal glass ping
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.8);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(987.77, now + 0.12);
    gain2.gain.setValueAtTime(0.18, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 1.2);
  } catch (e) {
    console.warn('AudioContext chime error:', e);
  }
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function pcmToWav(pcmData: Int16Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + pcmData.length * 2);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcmData.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono channel
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // Byte rate
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // Bits per sample
  writeString(view, 36, 'data');
  view.setUint32(40, pcmData.length * 2, true);

  let offset = 44;
  for (let i = 0; i < pcmData.length; i++, offset += 2) {
    view.setInt16(offset, pcmData[i], true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Converts audio base64 data to a playable audio Blob.
 * Correctly distinguishes between MP3/MPEG, RIFF WAV headers, and raw PCM.
 */
function createPlayableBlob(audioData: string, mimeType?: string): Blob {
  const binaryString = window.atob(audioData);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // 1. If MIME type is MP3 or MPEG audio (e.g. from Google Burmese Voice)
  if (mimeType?.includes('mpeg') || mimeType?.includes('mp3')) {
    return new Blob([bytes], { type: 'audio/mpeg' });
  }

  // 2. Check if first 4 bytes are 'RIFF' (0x52, 0x49, 0x46, 0x46)
  const isRiff =
    len >= 4 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46;

  if (isRiff) {
    return new Blob([bytes], { type: 'audio/wav' });
  }

  // 3. Raw PCM: determine sample rate from mimeType if available (default 24000)
  const sampleRateMatch = (mimeType || '').match(/rate=(\d+)/);
  const sampleRate = sampleRateMatch ? parseInt(sampleRateMatch[1], 10) : 24000;

  const pcm16 = new Int16Array(bytes.buffer);
  return pcmToWav(pcm16, sampleRate);
}

export interface SpeakOptions {
  apiKey?: string;
  voiceSpeed?: number;
  voiceName?: string;
  engine?: 'auto' | 'gemini' | 'google' | 'browser';
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (errMessage: string) => void;
  onSuccess?: (engine: 'gemini' | 'google' | 'browser') => void;
}

export async function speakBurmeseText(text: string, options: SpeakOptions = {}): Promise<boolean> {
  const {
    apiKey,
    voiceSpeed = 0.9,
    voiceName = 'Kore',
    engine = 'auto',
    onStart,
    onEnd,
    onError,
    onSuccess,
  } = options;

  if (onStart) onStart();

  const userSelectedEngine =
    engine !== 'auto'
      ? engine
      : (localStorage.getItem('myanmar_voice_engine') as 'auto' | 'gemini' | 'google' | 'browser') ||
        'auto';

  // If user explicitly chose browser speech
  if (userSelectedEngine === 'browser') {
    fallbackWebSpeech(text, voiceSpeed, onEnd, onError, onSuccess);
    return true;
  }

  // 1. Try server/Vercel endpoint first (/api/tts)
  // This endpoint works on local Express server AND on Vercel Serverless Functions!
  // It handles Gemini in allowed cloud regions, and automatically falls back to Google Burmese Voice
  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        apiKey: apiKey?.trim() || localStorage.getItem('myanmar_gemini_key')?.trim() || undefined,
        voiceName,
        engine: userSelectedEngine,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.audioData) {
        const audioBlob = createPlayableBlob(data.audioData, data.mimeType);
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);

        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          if (onEnd) onEnd();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          // If audio element failed, try direct Google TTS
          playDirectGoogleTTS(text, voiceSpeed, onEnd, onError, onSuccess);
        };

        await audio.play();
        if (onSuccess) onSuccess(data.engine === 'gemini' ? 'gemini' : 'google');
        return true;
      }
    } else {
      console.warn('Server/Vercel /api/tts returned non-ok:', res.status);
    }
  } catch (serverErr) {
    console.warn('Server/Vercel /api/tts request error:', serverErr);
  }

  // 2. Direct Google Burmese Voice fallback (Client-side, 0 latency, unrestricted globally)
  const playedGoogle = await playDirectGoogleTTS(text, voiceSpeed, onEnd, onError, onSuccess);
  if (playedGoogle) return true;

  // 3. Direct Gemini REST API fallback if client has custom key and is not in restricted location
  const trimmedKey =
    apiKey?.trim() || localStorage.getItem('myanmar_gemini_key')?.trim() || '';

  if (trimmedKey && userSelectedEngine !== 'google') {
    try {
      const models = [
        'gemini-3.8-flash-lite-tts',
        'gemini-3.8-flash-tts',
        'gemini-2.5-flash-preview-tts',
        'gemini-2.5-flash',
      ];

      for (const model of models) {
        try {
          const directUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${trimmedKey}`;
          const directRes = await fetch(directUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `Speak the following Burmese text clearly in natural, warm, and authentic Burmese (Myanmar) language:\n\n${text}`,
                    },
                  ],
                },
              ],
              generationConfig: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: voiceName || 'Kore' },
                  },
                },
              },
            }),
          });

          if (directRes.ok) {
            const result = await directRes.json();
            const part = result?.candidates?.[0]?.content?.parts?.[0];
            const audioData = part?.inlineData?.data;
            const mimeType = part?.inlineData?.mimeType;

            if (audioData) {
              const audioBlob = createPlayableBlob(audioData, mimeType);
              const audioUrl = URL.createObjectURL(audioBlob);
              const audio = new Audio(audioUrl);

              audio.onended = () => {
                URL.revokeObjectURL(audioUrl);
                if (onEnd) onEnd();
              };
              audio.onerror = () => {
                URL.revokeObjectURL(audioUrl);
                fallbackWebSpeech(text, voiceSpeed, onEnd, onError, onSuccess);
              };

              await audio.play();
              if (onSuccess) onSuccess('gemini');
              return true;
            }
          } else {
            const errBody = await directRes.json().catch(() => null);
            // If location restricted (403), stop querying Google Generative Language directly from this IP
            if (
              directRes.status === 403 ||
              errBody?.error?.message?.toLowerCase().includes('location')
            ) {
              console.warn(
                'Gemini direct API restricted in user location. Switching to fallback voices.'
              );
              break;
            }
          }
        } catch (mErr) {
          console.warn(`Direct call to ${model} failed:`, mErr);
        }
      }
    } catch (directErr) {
      console.warn('Direct Gemini TTS call failed:', directErr);
    }
  }

  // 4. Web Speech API fallback
  fallbackWebSpeech(text, voiceSpeed, onEnd, onError, onSuccess);
  return false;
}

/**
 * Direct client-side playback of Google Burmese Voice.
 * Works across all browsers and devices without any API key or regional restrictions.
 */
async function playDirectGoogleTTS(
  text: string,
  _speed: number,
  onEnd?: () => void,
  onError?: (err: string) => void,
  onSuccess?: (engine: 'gemini' | 'google' | 'browser') => void
): Promise<boolean> {
  try {
    const cleanText = text.trim().slice(0, 200);
    const audioUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=my&client=tw-ob&q=${encodeURIComponent(
      cleanText
    )}`;

    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.src = audioUrl;

    return await new Promise<boolean>((resolve) => {
      let resolved = false;

      const cleanup = () => {
        audio.onended = null;
        audio.onerror = null;
      };

      audio.onended = () => {
        cleanup();
        if (onEnd) onEnd();
      };

      audio.oncanplaythrough = async () => {
        if (!resolved) {
          resolved = true;
          try {
            await audio.play();
            if (onSuccess) onSuccess('google');
            resolve(true);
          } catch (playErr) {
            cleanup();
            resolve(false);
          }
        }
      };

      audio.onerror = () => {
        cleanup();
        if (!resolved) {
          resolved = true;
          resolve(false);
        }
      };

      // Timeout safety: if audio doesn't start in 3.5s, resolve false to move to Web Speech
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(false);
        }
      }, 3500);

      audio.load();
    });
  } catch (err) {
    console.warn('Direct Google TTS invocation error:', err);
    return false;
  }
}

function fallbackWebSpeech(
  text: string,
  voiceSpeed: number,
  onEnd?: () => void,
  onError?: (err: string) => void,
  onSuccess?: (engine: 'gemini' | 'google' | 'browser') => void
) {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'my-MM';
      utterance.rate = voiceSpeed;

      const voices = window.speechSynthesis.getVoices();
      const burmeseVoice = voices.find(
        (v) =>
          v.lang.toLowerCase().includes('my') ||
          v.lang.toLowerCase().includes('burmese') ||
          v.name.toLowerCase().includes('burmese')
      );
      if (burmeseVoice) {
        utterance.voice = burmeseVoice;
      }

      utterance.onend = () => {
        if (onEnd) onEnd();
      };
      utterance.onerror = (e) => {
        console.warn('SpeechSynthesis error:', e);
        playChimeSound();
        if (onError) onError('Browser speech error; chime played.');
        if (onEnd) onEnd();
      };

      window.speechSynthesis.speak(utterance);
      if (onSuccess) onSuccess('browser');
      return;
    } catch (err: any) {
      console.warn('SpeechSynthesis invocation error:', err);
    }
  }

  // Final fallback: play crystal glass chime so user never misses reminder
  playChimeSound();
  if (onError) onError('အသံထုတ်ပေးရန် အရန် Chime သံကို အသုံးပြုပါသည်');
  if (onEnd) onEnd();
}
