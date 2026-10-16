/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Task, NavItemKey, TaskPriority } from './types';
import { getInitialTasks } from './utils/defaults';
import { playChimeSound, speakBurmeseText } from './utils/audio';
import { heuristicParseBurmeseTask } from './utils/taskParser';
import {
  startBackgroundReminderEngine,
  triggerDeviceReminderAlert,
  startAudioKeepAlive,
  isScreenOffServiceActive,
} from './utils/backgroundReminderService';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { WelcomeBanner } from './components/WelcomeBanner';
import { StatsGrid } from './components/StatsGrid';
import { TaskList } from './components/TaskList';
import { RecordsView } from './components/RecordsView';
import { TaskModal } from './components/TaskModal';
import { VoiceCenterModal } from './components/VoiceCenterModal';
import { SettingsModal } from './components/SettingsModal';
import { NotificationToast, ToastData } from './components/NotificationToast';

export default function App() {
  // 1. Core State
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem('myanmar_tasks');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Storage read failed:', e);
    }
    return getInitialTasks();
  });

  const [voiceSpeed, setVoiceSpeed] = useState<number>(() => {
    const saved = localStorage.getItem('myanmar_voice_speed');
    return saved ? parseFloat(saved) : 0.9;
  });

  const [voiceName, setVoiceName] = useState<string>(() => {
    return localStorage.getItem('myanmar_voice_name') || 'Kore';
  });

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return (
      localStorage.getItem('myanmar_dark_mode') === 'true' ||
      window.matchMedia('(prefers-color-scheme: dark)').matches
    );
  });

  // Navigation & Filtering
  const [activeNav, setActiveNav] = useState<NavItemKey>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriority>('all');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Audio & Notification State
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingTaskId, setSpeakingTaskId] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem('myanmar_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('myanmar_voice_speed', voiceSpeed.toString());
  }, [voiceSpeed]);

  useEffect(() => {
    localStorage.setItem('myanmar_voice_name', voiceName);
  }, [voiceName]);

  useEffect(() => {
    localStorage.setItem('myanmar_dark_mode', isDarkMode ? 'true' : 'false');
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Offline / Online listeners
  useEffect(() => {
    const handleOffline = () => {
      setToast({
        id: Date.now().toString(),
        title: 'Offline Mode (အင်တာနက်မရှိပါ)',
        message: 'အင်တာနက်လိုင်း မရှိသော်လည်း ဒေတာများနှင့် Web Speech အသံသတိပေးချက်များကို ပုံမှန်အတိုင်း အသုံးပြုနိုင်ပါသည်။',
        type: 'info',
      });
    };

    window.addEventListener('offline', handleOffline);
    return () => window.removeEventListener('offline', handleOffline);
  }, []);

  // Handlers
  const handleToggleTask = useCallback((id: number) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const newStatus = !t.completed;
          return {
            ...t,
            completed: newStatus,
            completedAt: newStatus ? new Date().toISOString() : null,
          };
        }
        return t;
      })
    );
  }, []);

  // Screen-off service tracking state
  const [isScreenOffActive, setIsScreenOffActive] = useState<boolean>(() => {
    return localStorage.getItem('myanmar_screen_off_service') !== 'disabled';
  });

  // Enable Android Audio Keep-Alive on first user gesture if screen-off mode is enabled
  useEffect(() => {
    const isServiceEnabled = localStorage.getItem('myanmar_screen_off_service') !== 'disabled';
    if (isServiceEnabled) {
      const handleUserGesture = () => {
        startAudioKeepAlive();
        setIsScreenOffActive(true);
        window.removeEventListener('click', handleUserGesture);
        window.removeEventListener('touchstart', handleUserGesture);
      };
      window.addEventListener('click', handleUserGesture, { once: true });
      window.addEventListener('touchstart', handleUserGesture, { once: true });
      return () => {
        window.removeEventListener('click', handleUserGesture);
        window.removeEventListener('touchstart', handleUserGesture);
      };
    }
  }, []);

  // Background Reminder Engine: Web Worker accurate timer + Android Lockscreen Notifications & Audio Alert
  useEffect(() => {
    startBackgroundReminderEngine(
      () => tasks,
      (triggeredTask) => {
        const engine = (localStorage.getItem('myanmar_voice_engine') as any) || 'auto';

        // Trigger device notification, vibration, media player, and Burmese voice alert
        triggerDeviceReminderAlert(triggeredTask, {
          voiceSpeed,
          voiceName,
          engine,
        });

        setToast({
          id: Date.now().toString(),
          title: `အချိန်မီ သတိပေးချက်: ${triggeredTask.title}`,
          message: triggeredTask.ttsMessage || `${triggeredTask.title} ပြုလုပ်ရန် အချိန်တန်ပါပြီ`,
          taskId: triggeredTask.id,
          type: 'reminder',
        });

        // Mark task as notified
        setTasks((prev) =>
          prev.map((t) => (t.id === triggeredTask.id ? { ...t, notified: true } : t))
        );
      }
    );
  }, [tasks, voiceSpeed, voiceName]);

  // Service Worker lock screen action listeners ('speak' or 'done')
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handleSWMessage = (event: MessageEvent) => {
        if (event.data?.type === 'SPEAK_TASK') {
          const taskId = event.data?.taskData?.taskId;
          const task = tasks.find((t) => t.id === taskId);
          if (task) {
            speakBurmeseText(task.ttsMessage || task.title, { voiceSpeed, voiceName });
          }
        } else if (event.data?.type === 'COMPLETE_TASK') {
          handleToggleTask(event.data?.taskId);
        }
      };
      navigator.serviceWorker.addEventListener('message', handleSWMessage);
      return () => navigator.serviceWorker.removeEventListener('message', handleSWMessage);
    }
  }, [tasks, voiceSpeed, voiceName, handleToggleTask]);

  const handleDeleteTask = useCallback((id: number) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setToast({
      id: Date.now().toString(),
      title: 'ဖျက်ပြီးပါပြီ',
      message: 'လုပ်ဆောင်ဖွယ် Task ကို ဖျက်ပစ်ပြီးပါပြီ',
      type: 'info',
    });
  }, []);

  const handleSaveTask = (
    data: Omit<Task, 'id' | 'completed' | 'completedAt' | 'notified'>,
    editingId?: number
  ) => {
    if (editingId) {
      setTasks((prev) =>
        prev.map((t) => (t.id === editingId ? { ...t, ...data } : t))
      );
      setToast({
        id: Date.now().toString(),
        title: 'ပြင်ဆင်ပြီးပါပြီ',
        message: `${data.title} ကို ပြင်ဆင်သိမ်းဆည်းလိုက်ပါပြီ`,
        type: 'success',
      });
    } else {
      const newTask: Task = {
        id: Date.now(),
        ...data,
        completed: false,
        completedAt: null,
        notified: false,
      };
      setTasks((prev) => [newTask, ...prev]);
      setToast({
        id: Date.now().toString(),
        title: 'Task အသစ် ထည့်ပြီးပါပြီ',
        message: `${data.title} ကို အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ`,
        taskId: newTask.id,
        type: 'success',
      });
    }
  };

  const handleAddNaturalTask = async (input: string) => {
    const today = new Date().toISOString().split('T')[0];

    try {
      const res = await fetch('/api/parse-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input, today }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.task) {
          handleSaveTask(data.task);
          return;
        }
      }
    } catch (e) {
      console.warn('API parse task error, using local fallback:', e);
    }

    // Local Burmese heuristic parser (works in all restricted locations and offline)
    const parsed = heuristicParseBurmeseTask(input, today);
    handleSaveTask(parsed);
  };

  const handleSpeakTTS = (text: string, taskId: number) => {
    setIsSpeaking(true);
    setSpeakingTaskId(taskId);

    speakBurmeseText(text, {
      voiceSpeed,
      voiceName,
      onStart: () => {
        setIsSpeaking(true);
        setSpeakingTaskId(taskId);
      },
      onSuccess: (engine) => {
        if (engine === 'gemini') {
          setToast({
            id: Date.now().toString(),
            title: 'Gemini AI Voice',
            message: 'Gemini အသံစနစ်ဖြင့် မြန်မာဘာသာဖြင့် သတိပေးနေပါသည်',
            type: 'info',
          });
        }
      },
      onError: (err) => {
        setToast({
          id: Date.now().toString(),
          title: 'အသံသတိပေးချက် သတိပြုရန်',
          message: err,
          type: 'info',
        });
      },
      onEnd: () => {
        setIsSpeaking(false);
        setSpeakingTaskId(null);
      },
    });
  };

  const handleTestVoice = () => {
    handleSpeakTTS('မင်္ဂလာပါ။ မြန်မာ အသံဖြင့် သတိပေးချက် စနစ် အဆင်သင့် ဖြစ်ပါပြီ။', -1);
  };

  // Filtered Tasks for main view
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Nav specific override
      if (activeNav === 'completed' && !task.completed) return false;
      if (activeNav === 'tasks' && task.completed) return false;

      // Status filter
      if (statusFilter === 'pending' && task.completed) return false;
      if (statusFilter === 'completed' && !task.completed) return false;

      // Category filter
      if (categoryFilter !== 'all' && task.category !== categoryFilter) return false;

      // Priority filter
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(query);
        const matchesCategory = task.category.toLowerCase().includes(query);
        const matchesTTS = (task.ttsMessage || '').toLowerCase().includes(query);
        if (!matchesTitle && !matchesCategory && !matchesTTS) return false;
      }

      return true;
    });
  }, [tasks, activeNav, statusFilter, categoryFilter, priorityFilter, searchQuery]);

  return (
    <div className="min-h-screen bg-[#F4F7FC] dark:bg-[#0B0F19] text-[#172033] dark:text-[#F1F5F9] flex flex-col transition-colors duration-200 relative selection:bg-[#5B7CFA]/20 selection:text-[#5B7CFA]">
      {/* Restrained Glassmorphic Ambient Gradient Mesh in Background */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-[#5B7CFA]/10 dark:bg-[#5B7CFA]/5 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="fixed bottom-10 right-10 w-96 h-96 bg-[#A78BFA]/10 dark:bg-[#A78BFA]/5 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-[#67D5E8]/8 dark:bg-[#67D5E8]/3 rounded-full blur-[140px] pointer-events-none -z-10" />

      {/* Main Layout: Sidebar + Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-screen">
        {/* Sidebar */}
        <Sidebar
          activeNav={activeNav}
          setActiveNav={setActiveNav}
          tasks={tasks}
          onOpenAddModal={() => {
            setEditingTask(null);
            setIsAddModalOpen(true);
          }}
          onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
        />

        {/* Content Body Area */}
        <div className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-8">
          {/* Top Header */}
          <Header
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onOpenAddModal={() => {
              setEditingTask(null);
              setIsAddModalOpen(true);
            }}
            onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
            onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
            onTestVoice={handleTestVoice}
            isSpeaking={isSpeaking}
            isDarkMode={isDarkMode}
            toggleDarkMode={() => setIsDarkMode((prev) => !prev)}
            isScreenOffActive={isScreenOffActive}
          />

          {/* Main View Switcher */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            {activeNav === 'records' || activeNav === 'calendar' || activeNav === 'history' ? (
              <RecordsView
                tasks={tasks}
                onToggleTask={handleToggleTask}
                onSpeakTTS={handleSpeakTTS}
                speakingTaskId={speakingTaskId}
                onOpenAddModalWithDate={(dateStr) => {
                  setEditingTask({
                    id: 0,
                    title: '',
                    date: dateStr,
                    time: '09:00',
                    category: 'အလုပ်',
                    priority: 'medium',
                    ttsMessage: '',
                    completed: false,
                    completedAt: null,
                  });
                  setIsAddModalOpen(true);
                }}
              />
            ) : activeNav === 'settings' ? (
              <div className="max-w-2xl mx-auto">
                <div className="p-6 rounded-3xl glass-surface border border-white/70 dark:border-white/10 space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-[#172033] dark:text-white burmese-text">
                      အက်ပ် ဆက်တင်များနှင့် စနစ်ပြင်ဆင်မှုများ
                    </h3>
                    <p className="text-xs text-[#64748B] dark:text-slate-400">
                      Configure Burmese Speech & Backup
                    </p>
                  </div>

                  <div className="space-y-4">
                    <button
                      onClick={() => setIsSettingsModalOpen(true)}
                      className="w-full py-3 px-4 rounded-2xl bg-[#5B7CFA] hover:bg-[#4E70F8] text-white font-semibold text-xs transition shadow-md shadow-[#5B7CFA]/20 burmese-text"
                    >
                      ဆက်တင်များ ပေါ့ပ်အပ် ဖွင့်မည်
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Dashboard / Tasks / Completed View */
              <>
                {/* Welcome Banner */}
                {activeNav === 'dashboard' && (
                  <WelcomeBanner
                    tasks={tasks}
                    onAddNaturalTask={handleAddNaturalTask}
                    onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
                  />
                )}

                {/* Real Statistics Grid */}
                <StatsGrid tasks={tasks} />

                {/* Section Title */}
                <div className="flex items-center justify-between pt-2">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-[#172033] dark:text-white burmese-text">
                      {activeNav === 'completed'
                        ? 'ပြီးစီးခဲ့သော လုပ်ငန်းတာဝန်များ (Completed Tasks)'
                        : activeNav === 'tasks'
                        ? 'လုပ်ဆောင်ရန် ကျန်ရှိသော Tasks (Pending Tasks)'
                        : 'ယနေ့နှင့် လာမည့် လုပ်ဆောင်ဖွယ်များ (Daily Tasks)'}
                    </h3>
                    <p className="text-[11px] text-[#64748B] dark:text-slate-400 burmese-text">
                      စုစုပေါင်း {filteredTasks.length} ခု တွေ့ရှိပါသည်
                    </p>
                  </div>
                </div>

                {/* Tasks List Container */}
                <TaskList
                  tasks={filteredTasks}
                  statusFilter={statusFilter}
                  setStatusFilter={setStatusFilter}
                  categoryFilter={categoryFilter}
                  setCategoryFilter={setCategoryFilter}
                  priorityFilter={priorityFilter}
                  setPriorityFilter={setPriorityFilter}
                  onToggleTask={handleToggleTask}
                  onEditTask={(task) => {
                    setEditingTask(task);
                    setIsAddModalOpen(true);
                  }}
                  onDeleteTask={handleDeleteTask}
                  onSpeakTTS={handleSpeakTTS}
                  speakingTaskId={speakingTaskId}
                  onOpenAddModal={() => {
                    setEditingTask(null);
                    setIsAddModalOpen(true);
                  }}
                />
              </>
            )}
          </main>
        </div>
      </div>

      {/* Modals & Popups */}
      <TaskModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingTask(null);
        }}
        onSave={handleSaveTask}
        initialTask={editingTask}
      />

      <VoiceCenterModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        onAddTask={(taskData) => handleSaveTask(taskData)}
        voiceSpeed={voiceSpeed}
        setVoiceSpeed={setVoiceSpeed}
        voiceName={voiceName}
        setVoiceName={setVoiceName}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        voiceSpeed={voiceSpeed}
        setVoiceSpeed={setVoiceSpeed}
        voiceName={voiceName}
        setVoiceName={setVoiceName}
        tasks={tasks}
        onRestoreTasks={(newTasks) => setTasks(newTasks)}
        onResetDefaults={() => setTasks(getInitialTasks())}
      />

      {/* Floating Notification Toast */}
      <NotificationToast
        toast={toast}
        onDismiss={() => setToast(null)}
        onCompleteTask={handleToggleTask}
      />
    </div>
  );
}
