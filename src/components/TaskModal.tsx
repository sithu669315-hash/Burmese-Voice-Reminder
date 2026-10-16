import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Sparkles, MessageSquare, BellRing, Smartphone } from 'lucide-react';
import { Task, TaskCategory, TaskPriority } from '../types';
import { startAudioKeepAlive, requestNotificationPermission } from '../utils/backgroundReminderService';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (taskData: Omit<Task, 'id' | 'completed' | 'completedAt' | 'notified'>, editingId?: number) => void;
  initialTask?: Task | null;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialTask,
}) => {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [category, setCategory] = useState<TaskCategory>('အလုပ်');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [ttsMessage, setTtsMessage] = useState('');
  const [screenOffAlert, setScreenOffAlert] = useState<boolean>(true);

  const quickPresets = [
    { title: 'နံနက် ရေသောက်ရန်', category: 'ကျန်းမာရေး' as TaskCategory, time: '08:00' },
    { title: 'အလုပ် အစည်းအဝေး', category: 'အလုပ်' as TaskCategory, time: '10:00' },
    { title: 'နေ့လယ်စာ စားရန်', category: 'ကိုယ်ရေးကိုယ်တာ' as TaskCategory, time: '12:30' },
    { title: 'စာဖတ်ရန်နှင့် လေ့လာရန်', category: 'ပညာရေး' as TaskCategory, time: '15:00' },
    { title: 'လေ့ကျင့်ခန်း လုပ်ရန်', category: 'ကျန်းမာရေး' as TaskCategory, time: '17:30' },
    { title: 'ဆေးသောက်ရန်', category: 'ကျန်းမာရေး' as TaskCategory, time: '20:00' },
  ];

  useEffect(() => {
    if (initialTask) {
      setTitle(initialTask.title);
      setDate(initialTask.date);
      setTime(initialTask.time);
      setCategory(initialTask.category as TaskCategory);
      setPriority(initialTask.priority);
      setTtsMessage(initialTask.ttsMessage || '');
    } else {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMins = String(now.getMinutes()).padStart(2, '0');
      setTitle('');
      setDate(today);
      setTime(`${currentHours}:${currentMins}`);
      setCategory('အလုပ်');
      setPriority('medium');
      setTtsMessage('');
    }
  }, [initialTask, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (screenOffAlert) {
      // Arm Android background audio keep-alive and notification service
      startAudioKeepAlive();
      requestNotificationPermission();
    }

    onSave(
      {
        title: title.trim(),
        date: date || new Date().toISOString().split('T')[0],
        time: time || '12:00',
        category,
        priority,
        ttsMessage: ttsMessage.trim() || `${title.trim()} ပြုလုပ်ရန် အချိန်တန်ပါပြီ`,
      },
      initialTask ? initialTask.id : undefined
    );

    onClose();
  };

  const handleApplyPreset = (preset: typeof quickPresets[0]) => {
    setTitle(preset.title);
    setCategory(preset.category);
    setTime(preset.time);
    setTtsMessage(`${preset.title} ပြုလုပ်ရန် အချိန်တန်ပါပြီ`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md transition-all">
      <div className="relative w-full max-w-lg rounded-3xl glass-surface p-6 sm:p-7 border border-white/80 dark:border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200/60 dark:border-white/10">
          <div>
            <h3 className="text-base font-bold text-[#172033] dark:text-white burmese-text">
              {initialTask ? 'Task ပြင်ဆင်ရန်' : 'Task အသစ် ဖန်တီးမည်'}
            </h3>
            <p className="text-[11px] text-[#64748B] dark:text-slate-400">
              {initialTask ? 'Update task details & Burmese voice' : 'Set reminder time, category & Burmese voice'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Quick Presets */}
          {!initialTask && (
            <div>
              <span className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 block mb-1.5 burmese-text">
                အသုံးများသော ပုံစံများ (Quick Presets)
              </span>
              <div className="flex flex-wrap gap-1.5">
                {quickPresets.map((preset) => (
                  <button
                    key={preset.title}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className="px-2.5 py-1 rounded-xl text-[11px] glass-card border border-white/80 dark:border-white/10 hover:border-[#5B7CFA] text-slate-700 dark:text-slate-200 transition active:scale-95 burmese-text"
                  >
                    {preset.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="text-[11px] font-semibold text-[#172033] dark:text-slate-200 block mb-1 burmese-text">
              ခေါင်းစဉ် (Title) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ဥပမာ: အလုပ်အစည်းအဝေး တက်ရန်"
              className="w-full px-3.5 py-2.5 text-xs rounded-xl glass-input text-[#172033] dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5B7CFA]/30 focus:border-[#5B7CFA] transition burmese-text"
            />
          </div>

          {/* Date & Time Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-[#172033] dark:text-slate-200 block mb-1 burmese-text flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#5B7CFA]" />
                <span>ရက်စွဲ (Date)</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl glass-input text-[#172033] dark:text-white outline-none focus:ring-1 focus:ring-[#5B7CFA]"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#172033] dark:text-slate-200 block mb-1 burmese-text flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#5B7CFA]" />
                <span>အချိန် (Time)</span>
              </label>
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl glass-input text-[#172033] dark:text-white outline-none focus:ring-1 focus:ring-[#5B7CFA]"
              />
            </div>
          </div>

          {/* Category & Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-[#172033] dark:text-slate-200 block mb-1 burmese-text">
                ကဏ္ဍ (Category)
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TaskCategory)}
                className="w-full px-3 py-2 text-xs rounded-xl glass-input text-[#172033] dark:text-white outline-none focus:ring-1 focus:ring-[#5B7CFA] burmese-text"
              >
                <option value="အလုပ်">အလုပ်</option>
                <option value="ကိုယ်ရေးကိုယ်တာ">ကိုယ်ရေးကိုယ်တာ</option>
                <option value="ကျန်းမာရေး">ကျန်းမာရေး</option>
                <option value="ပညာရေး">ပညာရေး</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#172033] dark:text-slate-200 block mb-1 burmese-text">
                ဦးစားပေး (Priority)
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 text-xs rounded-xl glass-input text-[#172033] dark:text-white outline-none focus:ring-1 focus:ring-[#5B7CFA] burmese-text"
              >
                <option value="low">ပုံမှန် (Low)</option>
                <option value="medium">အလယ်အလတ် (Medium)</option>
                <option value="high">အရေးကြီး (High)</option>
              </select>
            </div>
          </div>

          {/* Burmese TTS Message */}
          <div>
            <label className="text-[11px] font-semibold text-[#172033] dark:text-slate-200 block mb-1 burmese-text flex items-center gap-1.5">
              <MessageSquare className="w-3 h-3 text-amber-500" />
              <span>အသံသတိပေး စာသား (Burmese Voice TTS Message)</span>
            </label>
            <textarea
              rows={2}
              value={ttsMessage}
              onChange={(e) => setTtsMessage(e.target.value)}
              placeholder="သတ်မှတ်ချိန်တွင် အသံဖြင့် ပြောကြားပေးမည့် မြန်မာစာသား..."
              className="w-full px-3.5 py-2 text-xs rounded-xl glass-input text-[#172033] dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5B7CFA]/30 focus:border-[#5B7CFA] transition burmese-text"
            />
            <p className="text-[10px] text-slate-400 mt-1 burmese-text">
              မဖြည့်ပါက ခေါင်းစဉ်အတိုင်း အလိုအလျောက် သတိပေးပါမည်။
            </p>
          </div>

          {/* Android Screen-Off Voice Reminder Feature Toggle Card */}
          <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-blue-500/10 to-indigo-500/10 border border-emerald-500/20 dark:border-emerald-500/30 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                <BellRing className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 burmese-text">
                  <span>ဖုန်း Screen ပိတ်ထားချိန် အသံသတိပေးမည်</span>
                  <Smartphone className="w-3.5 h-3.5 text-blue-500" />
                </span>
                <p className="text-[10px] text-slate-600 dark:text-slate-300 mt-0.5 burmese-text leading-relaxed">
                  အချိန်ကျရောက်ပါက Android ဖုန်းမျက်နှာပြင် ပိတ်ထားသော်လည်း စပီကာမှ မြန်မာလို အသံထွက် သတိပေးပြီး ဖုန်းတုန်ခါမှုနှင့် အသိပေးချက် (Notification) ပေးပါမည်။
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
              <input
                type="checkbox"
                checked={screenOffAlert}
                onChange={(e) => setScreenOffAlert(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200/60 dark:border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition burmese-text"
            >
              ပယ်ဖျက်မည်
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#5B7CFA] to-[#4361EE] hover:from-[#4E70F8] hover:to-[#3A56DF] text-white text-xs font-semibold shadow-md shadow-[#5B7CFA]/25 active:scale-95 transition burmese-text flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{initialTask ? 'ပြင်ဆင်ချက် သိမ်းမည်' : 'Task သိမ်းဆည်းမည်'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
