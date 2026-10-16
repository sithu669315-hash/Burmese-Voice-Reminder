import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  Download,
  Upload,
  Gauge,
  RotateCcw,
  Volume2,
  Lock,
  Globe,
  Eye,
  EyeOff,
  Sparkles,
  Check,
  AlertTriangle,
  BellRing,
  Smartphone,
  CheckCircle,
  Bell,
  HelpCircle,
  Play,
} from 'lucide-react';
import { Task } from '../types';
import { speakBurmeseText } from '../utils/audio';
import { PWAInstallButton } from './PWAInstallButton';
import {
  startAudioKeepAlive,
  stopAudioKeepAlive,
  isScreenOffServiceActive,
  requestNotificationPermission,
  scheduleScreenOffTest,
  requestScreenWakeLock,
  releaseScreenWakeLock,
} from '../utils/backgroundReminderService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  voiceSpeed: number;
  setVoiceSpeed: (speed: number) => void;
  voiceName: string;
  setVoiceName: (name: string) => void;
  tasks: Task[];
  onRestoreTasks: (tasks: Task[]) => void;
  onResetDefaults: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  voiceSpeed,
  setVoiceSpeed,
  voiceName,
  setVoiceName,
  tasks,
  onRestoreTasks,
  onResetDefaults,
}) => {
  const [saveMessage, setSaveMessage] = useState('');
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [activeEngineUsed, setActiveEngineUsed] = useState<string>('');

  // Screen-Off Service State
  const [isScreenOffEnabled, setIsScreenOffEnabled] = useState<boolean>(() => {
    return localStorage.getItem('myanmar_screen_off_service') !== 'disabled';
  });
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });
  const [testCountdown, setTestCountdown] = useState<number | null>(null);
  const [isWakeLockActive, setIsWakeLockActive] = useState<boolean>(false);
  const [showAndroidGuide, setShowAndroidGuide] = useState<boolean>(false);

  // Voice engine selection: auto | google | gemini | browser
  const [voiceEngine, setVoiceEngine] = useState<'auto' | 'google' | 'gemini' | 'browser'>(() => {
    return (localStorage.getItem('myanmar_voice_engine') as any) || 'auto';
  });

  // Custom Gemini API key (optional, stored in localStorage)
  const [customApiKey, setCustomApiKey] = useState<string>(() => {
    return localStorage.getItem('myanmar_gemini_key') || '';
  });
  const [showKey, setShowKey] = useState(false);
  const [isKeySaved, setIsKeySaved] = useState(false);

  useEffect(() => {
    localStorage.setItem('myanmar_voice_engine', voiceEngine);
  }, [voiceEngine]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleScreenOff = (enable: boolean) => {
    setIsScreenOffEnabled(enable);
    if (enable) {
      startAudioKeepAlive();
      requestNotificationPermission().then(setNotificationPermission);
      setSaveMessage('ဖုန်း Screen ပိတ်ထားချိန် အသံသတိပေးစနစ်ကို ဖွင့်လိုက်ပါပြီ');
    } else {
      stopAudioKeepAlive();
      setSaveMessage('Screen ပိတ်ထားချိန် သတိပေးစနစ်ကို ပိတ်လိုက်ပါပြီ');
    }
    setTimeout(() => setSaveMessage(''), 3000);
  };

  const handleRequestPermission = async () => {
    const perm = await requestNotificationPermission();
    setNotificationPermission(perm);
    if (perm === 'granted') {
      setSaveMessage('Android Notification ခွင့်ပြုချက် ရရှိပါပြီ');
    } else {
      setSaveMessage('Notification ခွင့်ပြုချက် မရရှိပါ (Browser ဆက်တင်တွင် စစ်ဆေးပါ)');
    }
    setTimeout(() => setSaveMessage(''), 3000);
  };

  const handleToggleWakeLock = async () => {
    if (isWakeLockActive) {
      releaseScreenWakeLock();
      setIsWakeLockActive(false);
    } else {
      const success = await requestScreenWakeLock();
      setIsWakeLockActive(success);
      if (success) {
        setSaveMessage('ဖုန်းမျက်နှာပြင် မမှိတ်စေရန် Wake Lock ဖွင့်ထားပါသည်');
        setTimeout(() => setSaveMessage(''), 3000);
      }
    }
  };

  const handleRunScreenOffTest = () => {
    setTestCountdown(5);
    scheduleScreenOffTest(
      (secondsLeft) => {
        setTestCountdown(secondsLeft);
      },
      () => {
        setTestCountdown(null);
        setSaveMessage('စမ်းသပ်မှု ပြီးမြောက်ပါပြီ! စပီကာနှင့် မျက်နှာပြင်တွင် စစ်ဆေးပါ');
        setTimeout(() => setSaveMessage(''), 4000);
      },
      {
        voiceSpeed,
        voiceName,
        engine: voiceEngine,
      }
    );
  };

  const handleSaveApiKey = () => {
    const trimmed = customApiKey.trim();
    if (trimmed) {
      localStorage.setItem('myanmar_gemini_key', trimmed);
    } else {
      localStorage.removeItem('myanmar_gemini_key');
    }
    setIsKeySaved(true);
    setSaveMessage('Gemini API Key ကို သိမ်းဆည်းလိုက်ပါပြီ');
    setTimeout(() => {
      setIsKeySaved(false);
      setSaveMessage('');
    }, 3000);
  };

  const handleTestKeyVoice = async () => {
    setIsTestingVoice(true);
    setActiveEngineUsed('');
    setSaveMessage('အသံ ထွက်ပေါ်နေပါသည်...');

    const testPhrase =
      voiceEngine === 'google'
        ? 'မင်္ဂလာပါ။ Google Burmese Voice မြန်မာအသံစနစ် ကောင်းမွန်စွာ အလုပ်လုပ်နေပါပြီ။'
        : 'မင်္ဂလာပါ။ Gemini AI မြန်မာအသံစနစ် ကောင်းမွန်စွာ အလုပ်လုပ်နေပါပြီ။';

    await speakBurmeseText(testPhrase, {
      voiceSpeed,
      voiceName,
      engine: voiceEngine,
      apiKey: customApiKey.trim() || undefined,
      onStart: () => setIsTestingVoice(true),
      onSuccess: (engine) => {
        setActiveEngineUsed(engine);
        if (engine === 'gemini') {
          setSaveMessage('စမ်းသပ်မှု အောင်မြင်ပါသည် (Gemini AI Voice ဖြင့် အသံထွက်နေပါသည်)');
        } else if (engine === 'google') {
          setSaveMessage('စမ်းသပ်မှု အောင်မြင်ပါသည် (Google Burmese Voice ဖြင့် အသံထွက်နေပါသည်)');
        } else {
          setSaveMessage('စမ်းသပ်မှု အောင်မြင်ပါသည် (Browser Speech ဖြင့် အသံထွက်နေပါသည်)');
        }
      },
      onError: (err) => {
        setSaveMessage(`အသံစမ်းသပ်မှု အသိပေးချက်: ${err}`);
      },
      onEnd: () => {
        setIsTestingVoice(false);
        setTimeout(() => setSaveMessage(''), 5000);
      },
    });
  };

  const handleBackup = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(tasks, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `myanmar_tasks_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          onRestoreTasks(parsed);
          setSaveMessage('Data ပြန်လည် ထည့်သွင်းပြီးပါပြီ!');
          setTimeout(() => setSaveMessage(''), 3000);
        } else {
          alert('ဖိုင်ဖော်မတ် မမှန်ကန်ပါ။ Task JSON ဖိုင်သာ ထည့်သွင်းပါ။');
        }
      } catch (err) {
        alert('JSON ဖိုင် ဖတ်ရှုရာတွင် အမှားဖြစ်ပေါ်ပါသည်');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-md">
      <div className="relative w-full max-w-xl rounded-3xl glass-surface p-6 sm:p-7 border border-white/80 dark:border-white/10 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-white/10">
          <div>
            <h3 className="text-base font-bold text-[#172033] dark:text-white burmese-text">
              အက်ပ် ဆက်တင်များနှင့် စီမံခန့်ခွဲမှု
            </h3>
            <p className="text-[11px] text-[#64748B] dark:text-slate-400">
              Android Screen-Off Reminders, Voice Engine & Backup Settings
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {saveMessage && (
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2 burmese-text animate-fadeIn">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>{saveMessage}</span>
          </div>
        )}

        <div className="space-y-4">
          {/* PWA In-App Install Card */}
          <PWAInstallButton variant="banner" />

          {/* 1. Android Screen-Off Voice Reminder Service (KEY FEATURE) */}
          <div className="p-4 rounded-2xl glass-card space-y-3 border border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <BellRing className="w-4.5 h-4.5 animate-pulse" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-100 burmese-text block">
                    Android Screen-Off အသံသတိပေးချက်စနစ်
                  </label>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    Reminders work even when phone screen is locked & off
                  </span>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isScreenOffEnabled}
                  onChange={(e) => handleToggleScreenOff(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            <p className="text-[11px] text-slate-600 dark:text-slate-300 burmese-text leading-relaxed">
              ဖုန်းမျက်နှာပြင် ပိတ်ထားသော်လည်း Background Audio Keep-Alive စနစ်ဖြင့် CPU အိပ်မပျော်စေဘဲ အချိန်ကျရောက်ပါက ဖုန်းစပီကာမှ မြန်မာလို အသံထွက် သတိပေးပြီး ဖုန်းတုန်ခါမှုနှင့် အသိပေးချက် (Notification) ပေးပါမည်။
            </p>

            {/* Notification Permission & Screen Lock Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <div className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block">Notification ခွင့်ပြုချက်</span>
                  <span className="text-xs font-semibold burmese-text flex items-center gap-1">
                    {notificationPermission === 'granted' ? (
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> ခွင့်ပြုထားပြီး
                      </span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <Bell className="w-3.5 h-3.5" /> ခွင့်ပြုရန် လိုအပ်သည်
                      </span>
                    )}
                  </span>
                </div>
                {notificationPermission !== 'granted' && (
                  <button
                    onClick={handleRequestPermission}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-semibold hover:bg-emerald-700 transition burmese-text"
                  >
                    ခွင့်ပြုမည်
                  </button>
                )}
              </div>

              {/* Wake Lock Toggle */}
              <div className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block">မျက်နှာပြင် အမြဲလင်းထားခြင်း</span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 burmese-text">
                    {isWakeLockActive ? 'Screen Awake ဖွင့်ထားသည်' : 'Screen Awake ပိတ်ထားသည်'}
                  </span>
                </div>
                <button
                  onClick={handleToggleWakeLock}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition burmese-text ${
                    isWakeLockActive
                      ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {isWakeLockActive ? 'ပိတ်မည်' : 'ဖွင့်မည်'}
                </button>
              </div>
            </div>

            {/* Test Screen-Off Button & Countdown Mode */}
            <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
              <div className="text-[11px] text-slate-600 dark:text-slate-400 burmese-text">
                {testCountdown !== null ? (
                  <span className="text-rose-500 font-bold animate-pulse flex items-center gap-1">
                    <span>ဖုန်း Power ခလုတ် နှိပ်၍ Screen ပိတ်ထားပါ:</span>
                    <span className="tabular-nums text-sm font-black">{testCountdown}</span> စက္ကန့်
                  </span>
                ) : (
                  <span>ဖုန်း Screen ပိတ်ပြီး ၅ စက္ကန့်အတွင်း အသံထွက် စမ်းသပ်နိုင်သည်</span>
                )}
              </div>

              <button
                type="button"
                onClick={handleRunScreenOffTest}
                disabled={testCountdown !== null}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-semibold shadow-md active:scale-95 transition flex items-center justify-center gap-1.5 burmese-text shrink-0 disabled:opacity-50"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>
                  {testCountdown !== null
                    ? `စမ်းသပ်နေသည် (${testCountdown}s)`
                    : 'Screen ပိတ်ပြီး စမ်းသပ်ရန်'}
                </span>
              </button>
            </div>

            {/* Android Battery optimization tip button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowAndroidGuide(!showAndroidGuide)}
                className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium hover:underline flex items-center gap-1 burmese-text"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Android ဖုန်းများတွင် အသံသတိပေးချက် မပျက်ကွက်စေရန် လမ်းညွှန်</span>
              </button>

              {showAndroidGuide && (
                <div className="mt-2 p-3 rounded-xl bg-white/70 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 space-y-1.5 burmese-text animate-fadeIn">
                  <p className="font-bold text-slate-800 dark:text-white">Android ဖုန်း ဆက်တင်များ ပြင်ဆင်ရန် အကြံပြုချက်:</p>
                  <p>၁။ ဖုန်း Settings &gt; Apps &gt; Chrome (သို့) ဤ App သို့ သွားပါ။</p>
                  <p>၂။ Battery အောက်ရှိ <strong>"Unrestricted (ကန့်သတ်ချက်မရှိ)"</strong> သို့မဟုတ် <strong>"Don't Optimize"</strong> ကို ရွေးချယ်ပါ။</p>
                  <p>၃။ Notifications တွင် အသံနှင့် တုန်ခါမှု (Sound & Vibrate) ခွင့်ပြုထားကြောင်း သေချာပါစေ။</p>
                  <p>၄။ App ကို ပင်မမျက်နှာပြင်တွင် Install ပြုလုပ်ထားပါက ပိုမိုမြန်ဆန်တိကျစွာ အလုပ်လုပ်ပါမည်။</p>
                </div>
              )}
            </div>
          </div>

          {/* 2. Voice Engine Selector (Key feature for Restricted Locations & Vercel) */}
          <div className="p-4 rounded-2xl glass-card space-y-3 border border-[#5B7CFA]/30 bg-blue-50/20 dark:bg-blue-950/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#5B7CFA]" />
                <label className="text-xs font-bold text-slate-800 dark:text-slate-100 burmese-text">
                  မြန်မာအသံစနစ် ရွေးချယ်မှု (Burmese Voice Engine)
                </label>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-[#5B7CFA] font-bold">
                {voiceEngine === 'google'
                  ? 'ကန့်သတ်ချက်မရှိ (Unrestricted)'
                  : voiceEngine === 'gemini'
                  ? 'Gemini AI Voice'
                  : 'Auto Multi-Tier'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setVoiceEngine('auto')}
                className={`p-2.5 rounded-xl border text-left transition text-xs burmese-text flex flex-col justify-between ${
                  voiceEngine === 'auto'
                    ? 'border-[#5B7CFA] bg-white/90 dark:bg-slate-800/90 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between font-bold text-slate-800 dark:text-white mb-1">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    အလိုအလျောက် (Auto)
                  </span>
                  {voiceEngine === 'auto' && <Check className="w-3.5 h-3.5 text-[#5B7CFA]" />}
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Gemini AI ကို ဦးစွာသုံးပြီး အဆင်မပြေပါက Google မြန်မာအသံသို့ အလိုအလျောက် ပြောင်းလဲပေးသည်။
                </p>
              </button>

              <button
                type="button"
                onClick={() => setVoiceEngine('google')}
                className={`p-2.5 rounded-xl border text-left transition text-xs burmese-text flex flex-col justify-between ${
                  voiceEngine === 'google'
                    ? 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between font-bold text-emerald-700 dark:text-emerald-300 mb-1">
                  <span className="flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                    Google Burmese Voice
                  </span>
                  {voiceEngine === 'google' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                </div>
                <p className="text-[10px] text-emerald-800 dark:text-emerald-400 font-medium">
                  မြန်မာနိုင်ငံနှင့် နေရာဒေသအားလုံးတွင် API Key မလိုဘဲ ၁၀၀% ကြည်လင်စွာ အလုပ်လုပ်ပါသည်။
                </p>
              </button>

              <button
                type="button"
                onClick={() => setVoiceEngine('gemini')}
                className={`p-2.5 rounded-xl border text-left transition text-xs burmese-text flex flex-col justify-between ${
                  voiceEngine === 'gemini'
                    ? 'border-[#5B7CFA] bg-white/90 dark:bg-slate-800/90 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between font-bold text-slate-800 dark:text-white mb-1">
                  <span>Gemini AI Studio</span>
                  {voiceEngine === 'gemini' && <Check className="w-3.5 h-3.5 text-[#5B7CFA]" />}
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Google Gemini 2.5 Flash Speech Generation ဖြင့် သဘာဝကျသော လူသားအသံ။
                </p>
              </button>

              <button
                type="button"
                onClick={() => setVoiceEngine('browser')}
                className={`p-2.5 rounded-xl border text-left transition text-xs burmese-text flex flex-col justify-between ${
                  voiceEngine === 'browser'
                    ? 'border-[#5B7CFA] bg-white/90 dark:bg-slate-800/90 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between font-bold text-slate-800 dark:text-white mb-1">
                  <span>Web Speech API</span>
                  {voiceEngine === 'browser' && <Check className="w-3.5 h-3.5 text-[#5B7CFA]" />}
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  ဖုန်း (သို့) ကွန်ပျူတာအတွင်း ပါဝင်သော စက်စနစ်သုံး Speech Synthesis။
                </p>
              </button>
            </div>
          </div>

          {/* 3. Custom Gemini API Key & Location Help */}
          <div className="p-4 rounded-2xl glass-card space-y-3 border border-white/70 dark:border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 burmese-text">
                  စိတ်ကြိုက် Gemini API Key (Vercel နှင့် နေရာဒေသ သတိပြုရန်)
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 burmese-text leading-relaxed">
              Vercel တွင် Deploy ပြုလုပ်ထားပါက Vercel Environment Variables တွင် ထည့်သွင်းနိုင်သလို ဤနေရာတွင်လည်း ထည့်သွင်းအသုံးပြုနိုင်ပါသည်။
            </p>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value)}
                  placeholder="AIzaSy... (Gemini API Key ထည့်ရန်)"
                  className="w-full pl-3 pr-9 py-2 text-xs rounded-xl glass-input text-slate-900 dark:text-white placeholder:text-slate-400 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              <button
                type="button"
                onClick={handleSaveApiKey}
                className="px-3.5 py-2 rounded-xl bg-[#5B7CFA] hover:bg-[#4E70F8] text-white text-xs font-semibold transition shrink-0 burmese-text flex items-center gap-1 shadow-sm"
              >
                {isKeySaved ? <Check className="w-3.5 h-3.5" /> : null}
                <span>သိမ်းမည်</span>
              </button>
            </div>
          </div>

          {/* 4. Voice Speed & Persona */}
          <div className="p-4 rounded-2xl glass-card space-y-3 border border-white/70 dark:border-white/10">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1 burmese-text">
                အသံရွေးချယ်မှု (Voice Persona)
              </label>
              <select
                value={voiceName}
                onChange={(e) => setVoiceName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl glass-input text-slate-800 dark:text-slate-100 outline-none"
              >
                <option value="Kore">Kore (အမျိုးသမီး ကြည်လင်သောအသံ - အကြံပြုထားသည်)</option>
                <option value="Puck">Puck (သွက်လက်သော အသံ)</option>
                <option value="Zephyr">Zephyr (နူးညံ့ညင်သာသောအသံ)</option>
                <option value="Fenrir">Fenrir (အမျိုးသား ခံ့ညားသောအသံ)</option>
                <option value="Charon">Charon (တည်ငြိမ်သောအသံ)</option>
              </select>
            </div>

            <div className="pt-1">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Gauge className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 burmese-text">
                    အသံပြောကြားနှုန်း (Speech Speed)
                  </span>
                </div>
                <span className="text-xs font-bold text-[#5B7CFA] dark:text-blue-400 tabular-nums">
                  {voiceSpeed}x
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[0.75, 0.9, 1.0, 1.25].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => setVoiceSpeed(speed)}
                    className={`py-1.5 text-xs font-semibold rounded-xl border transition-all tabular-nums ${
                      voiceSpeed === speed
                        ? 'bg-[#5B7CFA] text-white border-[#5B7CFA] shadow-sm'
                        : 'glass-input text-slate-600 dark:text-slate-300 hover:border-[#5B7CFA]/40'
                    }`}
                  >
                    {speed === 0.75
                      ? '၀.၇၅x (နှေး)'
                      : speed === 0.9
                      ? '၀.၉x (ပုံမှန်)'
                      : speed === 1.0
                      ? '၁.၀x'
                      : '၁.၂၅x (မြန်)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Test Voice Button */}
            <div className="pt-2 flex items-center justify-between border-t border-slate-200/50 dark:border-white/5">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 burmese-text">
                {activeEngineUsed
                  ? `လက်ရှိသုံးနေသော စနစ်: ${
                      activeEngineUsed === 'gemini'
                        ? 'Gemini AI Voice'
                        : activeEngineUsed === 'google'
                        ? 'Google Burmese Voice'
                        : 'Browser Speech'
                    }`
                  : 'ရွေးချယ်ထားသော စနစ်ဖြင့် အသံထွက် စမ်းသပ်ပါ'}
              </span>
              <button
                type="button"
                onClick={handleTestKeyVoice}
                disabled={isTestingVoice}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#5B7CFA] to-[#4361EE] hover:from-[#4E70F8] hover:to-[#3A56DF] text-white text-xs font-semibold transition flex items-center gap-1.5 burmese-text disabled:opacity-50 shadow-md shadow-[#5B7CFA]/20"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>{isTestingVoice ? 'အသံစမ်းနေသည်...' : 'အသံစမ်းသပ်မည်'}</span>
              </button>
            </div>
          </div>

          {/* 5. Data Backup & Restore */}
          <div className="p-4 rounded-2xl glass-card space-y-2 border border-white/70 dark:border-white/10">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block burmese-text">
              ဒေတာ သိမ်းဆည်းခြင်းနှင့် ပြန်လည်ယူခြင်း (Backup & Restore)
            </span>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={handleBackup}
                className="py-2.5 px-3 rounded-xl bg-white/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#5B7CFA] text-slate-700 dark:text-slate-200 text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-sm burmese-text"
              >
                <Download className="w-3.5 h-3.5 text-[#5B7CFA]" />
                <span>Backup ထုတ်ယူမည်</span>
              </button>

              <label className="py-2.5 px-3 rounded-xl bg-white/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#5B7CFA] text-slate-700 dark:text-slate-200 text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer burmese-text">
                <Upload className="w-3.5 h-3.5 text-emerald-500" />
                <span>Restore တင်သွင်းမည်</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleRestoreFile}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Reset Demo Data & Close */}
          <div className="pt-2 flex justify-between items-center text-xs">
            <button
              onClick={() => {
                if (window.confirm('မူလနမူနာ Task များကို ပြန်လည်သတ်မှတ်လိုပါသလား?')) {
                  onResetDefaults();
                  setSaveMessage('နမူနာ ဒေတာများ ပြန်လည်ထည့်သွင်းပြီးပါပြီ');
                  setTimeout(() => setSaveMessage(''), 3000);
                }
              }}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-1.5 burmese-text transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>နမူနာဒေတာများ ပြန်ယူမည်</span>
            </button>

            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-[#5B7CFA] text-white font-semibold burmese-text shadow-md shadow-[#5B7CFA]/25"
            >
              ပြီးပါပြီ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
