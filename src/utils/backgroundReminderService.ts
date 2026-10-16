import { Task } from '../types';
import { playChimeSound, speakBurmeseText } from './audio';

// Singleton state
let isKeepAliveActive = false;
let keepAliveAudio: HTMLAudioElement | null = null;
let wakeLockSentinel: any = null;
let workerInstance: Worker | null = null;
let intervalId: any = null;
let onTaskTriggerCallback: ((task: Task) => void) | null = null;
let tasksProvider: (() => Task[]) | null = null;
let notifiedTasksThisMinute = new Set<string>();

// Generates an inaudible 1-second silent WAV base64 string
function getSilentWavDataUri(): string {
  // 1-second 8000Hz 8-bit mono PCM silent WAV
  const sampleRate = 8000;
  const numSamples = sampleRate;
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  // RIFF identifier
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + numSamples, true); // file length - 8
  view.setUint32(8, 0x57415645, false); // "WAVE"
  // format chunk identifier
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true); // format chunk length
  view.setUint16(20, 1, true); // sample format (raw PCM)
  view.setUint16(22, 1, true); // channel count (1)
  view.setUint32(24, sampleRate, true); // sample rate
  view.setUint32(28, sampleRate, true); // byte rate
  view.setUint16(32, 1, true); // block align
  view.setUint16(34, 8, true); // bits per sample
  // data chunk identifier
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, numSamples, true); // data chunk length

  const silence = new Uint8Array(numSamples);
  silence.fill(128); // 128 is center/silent for 8-bit unsigned PCM

  const combined = new Uint8Array(44 + numSamples);
  combined.set(new Uint8Array(header), 0);
  combined.set(silence, 44);

  let binary = '';
  for (let i = 0; i < combined.length; i++) {
    binary += String.fromCharCode(combined[i]);
  }
  return 'data:audio/wav;base64,' + btoa(binary);
}

/**
 * Request system notification permission (vital for Android lock screen)
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('Notifications not supported in this browser');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return 'denied';
  }
}

/**
 * Request Screen Wake Lock (keeps screen awake when requested)
 */
export async function requestScreenWakeLock(): Promise<boolean> {
  if ('wakeLock' in navigator) {
    try {
      wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
      wakeLockSentinel.addEventListener('release', () => {
        wakeLockSentinel = null;
      });
      return true;
    } catch (err) {
      console.warn('Wake Lock request failed:', err);
      return false;
    }
  }
  return false;
}

export function releaseScreenWakeLock() {
  if (wakeLockSentinel) {
    try {
      wakeLockSentinel.release();
    } catch (e) {
      // ignore
    }
    wakeLockSentinel = null;
  }
}

/**
 * Configure Android MediaSession to show Burmese reminder info on lock screen
 */
export function setupMediaSession(title?: string, message?: string) {
  if (!('mediaSession' in navigator)) return;

  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: title || 'မြန်မာ အသံသတိပေးချက်စနစ် (အသင့်ရှိ)',
      artist: message || 'Android Screen-Off Reminder Active',
      album: 'အသံသတိပေးချက် ဖွင့်ထားသည်',
      artwork: [
        { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
      ],
    });

    navigator.mediaSession.playbackState = 'playing';

    navigator.mediaSession.setActionHandler('play', () => {
      // User tapped play from lock screen
      if (keepAliveAudio) keepAliveAudio.play().catch(() => {});
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      // User tapped pause
      if (keepAliveAudio) keepAliveAudio.pause();
    });

    navigator.mediaSession.setActionHandler('stop', () => {
      if (keepAliveAudio) keepAliveAudio.pause();
    });
  } catch (e) {
    console.warn('MediaSession setup error:', e);
  }
}

/**
 * Start Background Audio Keep-Alive.
 * This instructs Android to grant an audio wake lock (PARTIAL_WAKE_LOCK),
 * preventing Android from suspending timers when the screen is turned off.
 */
export function startAudioKeepAlive(): boolean {
  if (isKeepAliveActive) return true;

  try {
    if (!keepAliveAudio) {
      keepAliveAudio = new Audio(getSilentWavDataUri());
      keepAliveAudio.loop = true;
      keepAliveAudio.volume = 0.01; // inaudible carrier
    }

    const playPromise = keepAliveAudio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          isKeepAliveActive = true;
          setupMediaSession();
          localStorage.setItem('myanmar_screen_off_service', 'enabled');
        })
        .catch((err) => {
          console.warn('Keep-alive audio autoplay restricted (requires user click):', err);
        });
    }
    return true;
  } catch (err) {
    console.error('Failed to start audio keep-alive:', err);
    return false;
  }
}

/**
 * Stop Background Audio Keep-Alive
 */
export function stopAudioKeepAlive() {
  if (keepAliveAudio) {
    try {
      keepAliveAudio.pause();
      keepAliveAudio.currentTime = 0;
    } catch (e) {
      // ignore
    }
  }
  isKeepAliveActive = false;
  releaseScreenWakeLock();
  localStorage.setItem('myanmar_screen_off_service', 'disabled');

  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = 'none';
  }
}

export function isScreenOffServiceActive(): boolean {
  return isKeepAliveActive;
}

/**
 * Triggers full Android device alert:
 * 1. Powerful vibration sequence
 * 2. High-priority Android System Notification (lights up lock screen)
 * 3. Lockscreen MediaSession metadata update with Burmese task details
 * 4. Chime sound & Burmese voice reading
 */
export async function triggerDeviceReminderAlert(
  task: Task,
  options: {
    voiceSpeed?: number;
    voiceName?: string;
    engine?: 'auto' | 'gemini' | 'google' | 'browser';
  } = {}
) {
  const reminderTitle = `အချိန်မီ သတိပေးချက်: ${task.title}`;
  const reminderMessage = task.ttsMessage || `${task.title} ပြုလုပ်ရန် အချိန်တန်ပါပြီ`;

  // 1. Android Vibration pattern: [vibrate 600ms, pause 200ms, vibrate 600ms, pause 200ms, vibrate 1000ms]
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([600, 200, 600, 200, 1000]);
    } catch (e) {
      // ignore
    }
  }

  // 2. Android Lockscreen Media Session display
  setupMediaSession(`သတိပေးချက်: ${task.title}`, reminderMessage);

  // 3. Android System Notification (lights up screen when phone is locked)
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        if (registration && registration.showNotification) {
          registration.showNotification(reminderTitle, {
            body: reminderMessage,
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            vibrate: [600, 200, 600, 200, 1000],
            tag: `reminder-task-${task.id}`,
            requireInteraction: true,
            silent: false,
            data: {
              taskId: task.id,
              title: task.title,
              ttsMessage: reminderMessage,
            },
            actions: [
              { action: 'speak', title: 'အသံပြန်ဖွင့်မည် 🔊' },
              { action: 'done', title: 'ပြီးပါပြီ ✓' },
            ],
          } as any);
        } else {
          new Notification(reminderTitle, {
            body: reminderMessage,
            icon: '/pwa-192x192.png',
          });
        }
      } else {
        new Notification(reminderTitle, {
          body: reminderMessage,
          icon: '/pwa-192x192.png',
        });
      }
    } catch (err) {
      console.warn('Failed to fire system notification:', err);
    }
  }

  // 4. Play alert chime
  try {
    playChimeSound();
  } catch (e) {
    // ignore
  }

  // 5. Speak Burmese voice through the phone speaker
  setTimeout(() => {
    speakBurmeseText(reminderMessage, {
      voiceSpeed: options.voiceSpeed ?? 1.0,
      voiceName: options.voiceName ?? 'Kore',
      engine: options.engine ?? 'auto',
    });
  }, 400);
}

/**
 * Check tasks against the current time (runs every 5 seconds)
 */
function evaluateReminders() {
  if (!tasksProvider || !onTaskTriggerCallback) return;

  const now = new Date();
  const currentHours = String(now.getHours()).padStart(2, '0');
  const currentMins = String(now.getMinutes()).padStart(2, '0');
  const currentTime = `${currentHours}:${currentMins}`;
  const todayDate = now.toISOString().split('T')[0];

  const minuteKey = `${todayDate}_${currentTime}`;

  const tasks = tasksProvider();
  for (const t of tasks) {
    const taskMinuteKey = `${minuteKey}_${t.id}`;
    if (!t.completed && t.date === todayDate && t.time === currentTime) {
      if (!t.notified && !notifiedTasksThisMinute.has(taskMinuteKey)) {
        notifiedTasksThisMinute.add(taskMinuteKey);
        onTaskTriggerCallback(t);
      }
    }
  }

  // Prune keys older than 1 hour to prevent memory bloat
  if (notifiedTasksThisMinute.size > 100) {
    notifiedTasksThisMinute.clear();
  }
}

/**
 * Starts the dual-engine background reminder monitor.
 * Employs a dedicated Web Worker timer to avoid tab throttling,
 * paired with standard interval fallback.
 */
export function startBackgroundReminderEngine(
  getTasks: () => Task[],
  onTrigger: (task: Task) => void
) {
  tasksProvider = getTasks;
  onTaskTriggerCallback = onTrigger;

  // 1. Clear any existing intervals
  if (intervalId) clearInterval(intervalId);
  if (workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
  }

  // 2. Initialize Web Worker for uninterrupted background ticks
  try {
    const workerCode = `
      let timer = null;
      self.onmessage = function(e) {
        if (e.data === 'start') {
          if (timer) clearInterval(timer);
          timer = setInterval(function() {
            self.postMessage('tick');
          }, 5000);
        } else if (e.data === 'stop') {
          if (timer) clearInterval(timer);
          timer = null;
        }
      };
    `;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    workerInstance = new Worker(URL.createObjectURL(blob));
    workerInstance.onmessage = (e) => {
      if (e.data === 'tick') {
        evaluateReminders();
      }
    };
    workerInstance.postMessage('start');
  } catch (err) {
    console.warn('Web Worker timer not available, using interval fallback:', err);
  }

  // 3. Fallback interval in case Worker is restricted
  intervalId = setInterval(evaluateReminders, 5000);

  // Evaluate immediately
  evaluateReminders();
}

/**
 * Test function: Schedules a reminder in 5 seconds so the user can test locking their phone screen!
 */
export function scheduleScreenOffTest(
  onCountdown: (secondsLeft: number) => void,
  onComplete: () => void,
  options: {
    voiceSpeed?: number;
    voiceName?: string;
    engine?: 'auto' | 'gemini' | 'google' | 'browser';
  } = {}
) {
  // Activate audio keep alive immediately so user can turn off screen
  startAudioKeepAlive();
  requestNotificationPermission();

  let seconds = 5;
  onCountdown(seconds);

  const countdownInterval = setInterval(() => {
    seconds--;
    if (seconds > 0) {
      onCountdown(seconds);
    } else {
      clearInterval(countdownInterval);
      onComplete();

      // Trigger test reminder
      const testTask: Task = {
        id: 999999,
        title: 'Screen ပိတ်ပြီး စမ်းသပ်မှု အောင်မြင်ပါသည်',
        date: new Date().toISOString().split('T')[0],
        time: '00:00',
        category: 'ကိုယ်ရေးကိုယ်တာ',
        priority: 'high',
        completed: false,
        completedAt: null,
        notified: true,
        ttsMessage: 'ဖုန်း Screen ပိတ်ထားသော်လည်း မြန်မာအသံသတိပေးချက် ကောင်းမွန်စွာ အလုပ်လုပ်နေပါပြီ။',
      };

      triggerDeviceReminderAlert(testTask, options);
    }
  }, 1000);
}
