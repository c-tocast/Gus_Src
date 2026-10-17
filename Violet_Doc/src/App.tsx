import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  CheckSquare,
  Users,
  BarChart3,
  Bell,
  Wifi,
  Battery,
  Signal,
  Clock,
  Sparkles,
  Timer,
  X,
  LogOut,
  WifiOff,
  RefreshCw,
  User as UserIcon,
} from 'lucide-react';
import { auth, onAuthStateChanged, signOut, User } from './firebase';
import { AuthGate } from './components/AuthGate';
import {
  migrateLocalDataToFirestore,
  subscribeUserTasks,
  subscribeUserPeople,
  subscribeUserSettings,
  subscribeUserSessions,
  subscribeUserChat,
  saveCloudTask,
  deleteCloudTask,
  saveCloudPerson,
  deleteCloudPerson,
  saveCloudSettings,
  saveCloudSession,
  deleteCloudSession,
  saveCloudChat,
  syncAllToCloud,
  clearAllCloudData,
  syncPeopleToFirestore,
  syncTasksToFirestore,
} from './utils/firestoreSync';
import {
  registerServiceWorker,
  getNotificationPermission,
  requestNotificationPermission,
  sendSystemDesktopNotification,
} from './utils/notifications';
import {
  Task,
  Person,
  ChatMessage,
  SystemNotification,
  AppSettings,
  UrgencyLevel,
  ChatSession,
  DayOfWeek,
  ActiveTimerState,
} from './types';
import {
  loadTasks,
  saveTasks,
  sanitizeTasks,
  normalizeTaskCompletedTags,
  loadPeople,
  savePeople,
  sanitizePeople,
  remapTasksPeopleIds,
  saveChatMessages,
  loadInitialChatState,
  saveSessions,
  getFreshWelcomeMessage,
  loadNotifications,
  saveNotifications,
  loadSettings,
  saveSettings,
  resetAllAppData,
  defaultSettings,
  getRandomAvatarColor,
  calculateDynamicUrgency,
  loadStopwatchTimers,
  saveStopwatchTimers,
  getTimerElapsedSeconds,
  playCompletionChime,
} from './utils/storage';
import { classifyError, getLatestCapturedError } from './utils/errorTracker';

import { ChatView } from './components/ChatView';
import { TaskListView } from './components/TaskListView';
import { TaskDetailModal } from './components/TaskDetailModal';
import { PeopleView } from './components/PeopleView';
import { PersonDetailModal } from './components/PersonDetailModal';
import { AnalyticsView } from './components/AnalyticsView';
import { StopwatchView } from './components/StopwatchView';
import { RemindersSettingsView } from './components/RemindersSettingsView';
import { AndroidShadeNotification } from './components/AndroidShadeNotification';
import { MergeDuplicatesModal } from './components/MergeDuplicatesModal';
import {
  findDuplicateCandidates,
  executeTaskMerge,
  executePersonMerge,
  executeTagMerge,
} from './utils/deduplication';

type TabType = 'chat' | 'stopwatch' | 'tasks' | 'people' | 'analytics' | 'settings';

export default function App() {
  // Auth & Cloud Sync States
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState<boolean>(false);

  // Application State initialized from localStorage & depurated for session history
  const [tasks, setTasks] = useState<Task[]>(() => loadTasks());
  const [people, setPeople] = useState<Person[]>(() => loadPeople());
  
  const [chatInit] = useState(() => loadInitialChatState());
  const [sessions, setSessions] = useState<ChatSession[]>(chatInit.sessions);
  const [messages, setMessages] = useState<ChatMessage[]>(chatInit.activeMessages);
  const [currentSessionId, setCurrentSessionId] = useState<string>(`session-${Date.now()}`);

  const [notifications, setNotifications] = useState<SystemNotification[]>(() => loadNotifications());
  // Ensure Crisis Helpline Banner is ALWAYS set as ON by default in fresh app sessions
  const [settings, setSettings] = useState<AppSettings>(() => {
    const loaded = loadSettings();
    return { ...loaded, safetyHelplineBannerEnabled: true };
  });

  // Active background stopwatch timers
  const [stopwatchTimers, setStopwatchTimers] = useState<Record<string, ActiveTimerState>>(() => loadStopwatchTimers());
  const [systemNotifPermission, setSystemNotifPermission] = useState<string>(() =>
    getNotificationPermission()
  );

  useEffect(() => {
    registerServiceWorker();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Firebase Auth Listener & Automatic First-Login Data Migration
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setAuthLoading(false);

      if (user) {
        setIsSyncing(true);
        try {
          await migrateLocalDataToFirestore({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
          });
        } catch (err) {
          console.error('Firestore migration error:', err);
        } finally {
          setIsSyncing(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Real-Time Firestore Synchronization Listeners (Approach 5B - Firestore Dominant Mode)
  useEffect(() => {
    if (!currentUser) return;

    const unsubTasks = subscribeUserTasks(currentUser.uid, (cloudTasks) => {
      setTasks(cloudTasks);
      saveTasks(cloudTasks);
    });

    const unsubPeople = subscribeUserPeople(
      currentUser.uid,
      (cloudPeople) => {
        setPeople(cloudPeople);
        savePeople(cloudPeople);
      },
      tasks
    );

    const unsubSettings = subscribeUserSettings(currentUser.uid, (cloudSettings) => {
      if (cloudSettings) {
        setSettings(cloudSettings);
        saveSettings(cloudSettings);
      }
    });

    const unsubSessions = subscribeUserSessions(currentUser.uid, (cloudSessions) => {
      setSessions(cloudSessions);
      saveSessions(cloudSessions);
    });

    const unsubChat = subscribeUserChat(currentUser.uid, (cloudMessages) => {
      if (cloudMessages && cloudMessages.length > 0) {
        setMessages(cloudMessages);
        saveChatMessages(cloudMessages);
      }
    });

    return () => {
      unsubTasks();
      unsubPeople();
      unsubSettings();
      unsubSessions();
      unsubChat();
    };
  }, [currentUser]);

  // Active tab & modal states
  const [activeTab, setActiveTab] = useState<TabType>('chat');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);
  const [hasActiveSafetyAlert, setHasActiveSafetyAlert] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [duplicateToastInfo, setDuplicateToastInfo] = useState<{
    show: boolean;
    count: number;
    autoMerged: number;
  }>({ show: false, count: 0, autoMerged: 0 });

  // Status bar time & simulated time machine state
  const [simulatedOffsetMs, setSimulatedOffsetMs] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const updateClock = () => {
      const simNow = new Date(Date.now() + simulatedOffsetMs);
      setCurrentTime(
        simNow.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 10000);
    return () => clearInterval(interval);
  }, [simulatedOffsetMs]);

  // Save changes to localStorage & Cloud Firestore
  useEffect(() => {
    saveTasks(tasks);
    if (currentUser) {
      tasks.forEach((t) => saveCloudTask(currentUser.uid, t));
    }
  }, [tasks, currentUser]);

  useEffect(() => {
    savePeople(people);
    if (currentUser) {
      people.forEach((p) => saveCloudPerson(currentUser.uid, p));
    }
  }, [people, currentUser]);

  useEffect(() => {
    saveSessions(sessions);
    if (currentUser) {
      sessions.forEach((s) => saveCloudSession(currentUser.uid, s));
    }
  }, [sessions, currentUser]);

  // Helper to archive active session into sessions array if it contains user messages
  const archiveCurrentSessionIfNeeded = (currentMsgs: ChatMessage[], sessionList: ChatSession[], activeId: string) => {
    const userMsgs = currentMsgs.filter((m) => m.role === 'user');
    if (userMsgs.length === 0) return sessionList;

    const firstUserMsg = userMsgs[0];
    const title = firstUserMsg.content.slice(0, 36) + (firstUserMsg.content.length > 36 ? '...' : '');

    const currentSessionObj: ChatSession = {
      id: activeId,
      title,
      createdAt: new Date().toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      messages: currentMsgs,
    };

    const existingIdx = sessionList.findIndex((s) => s.id === activeId);
    if (existingIdx !== -1) {
      const updated = [...sessionList];
      updated[existingIdx] = currentSessionObj;
      return updated;
    } else {
      return [currentSessionObj, ...sessionList];
    }
  };

  useEffect(() => {
    saveChatMessages(messages);
    if (currentUser) {
      saveCloudChat(currentUser.uid, messages);
    }
    if (messages.some((m) => m.role === 'user')) {
      setSessions((prev) => archiveCurrentSessionIfNeeded(messages, prev, currentSessionId));
    }
  }, [messages, currentSessionId, currentUser]);

  useEffect(() => {
    saveNotifications(notifications);
  }, [notifications]);

  useEffect(() => {
    saveSettings(settings);
    if (currentUser) {
      saveCloudSettings(currentUser.uid, settings);
    }
  }, [settings, currentUser]);

  useEffect(() => {
    saveStopwatchTimers(stopwatchTimers);
  }, [stopwatchTimers]);

  // Background Stopwatch ticker loop & auto-completion trigger
  useEffect(() => {
    const interval = setInterval(() => {
      setStopwatchTimers((prevTimers) => {
        let updated = false;
        const now = Date.now();
        const next = { ...prevTimers };

        Object.keys(next).forEach((taskId) => {
          const tState = next[taskId];
          if (tState && tState.isRunning) {
            const elapsed = getTimerElapsedSeconds(tState, now);
            if (tState.targetSeconds > 0 && elapsed >= tState.targetSeconds) {
              updated = true;
              next[taskId] = {
                ...tState,
                accumulatedSeconds: tState.targetSeconds,
                startTimeMs: null,
                isRunning: false,
                completedInStopwatch: true,
              };

              const taskObj = tasks.find((t) => t.id === taskId);
              if (taskObj) {
                if (!taskObj.completed) {
                  setTasks((prevTasks) =>
                    prevTasks.map((t) =>
                      t.id === taskId
                        ? {
                            ...t,
                            completed: true,
                            completedAt: new Date().toISOString(),
                            actualTimeMinutes: Math.ceil(tState.targetSeconds / 60),
                          }
                        : t
                    )
                  );
                }
                playCompletionChime();
                if (settings.globalNotificationsEnabled) {
                  const notifTitle = '⏱️ Stopwatch Activity Completed!';
                  const notifMsg = `Activity "${taskObj.title}" reached its target duration of ${Math.round(tState.targetSeconds / 60)} minutes.`;
                  const newNotif: SystemNotification = {
                    id: `notif-${Date.now()}`,
                    title: notifTitle,
                    message: notifMsg,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    read: false,
                    type: 'task_reminder',
                    taskId: taskObj.id,
                  };
                  setNotifications((prevNotifs) => [...prevNotifs, newNotif]);
                  sendSystemDesktopNotification(notifTitle, notifMsg, taskObj.id);
                }
              }
            }
          }
        });

        return updated ? next : prevTimers;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [tasks, settings.globalNotificationsEnabled]);

  // Approach 5B: Scheduled Daily Push / System Popup Checker Loop
  const [sentScheduledKeys, setSentScheduledKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!settings.globalNotificationsEnabled) return;

    const interval = setInterval(() => {
      const currentRefTime = Date.now() + simulatedOffsetMs;
      const refDateObj = new Date(currentRefTime);
      const todayStr = refDateObj.toISOString().split('T')[0];

      tasks.forEach((task) => {
        if (!task.notificationsEnabled) return;

        // 1. FREQUENT TASKS: Daily Check-in Notification (only for active recurring routines)
        if (task.taskType === 'frequent' && !task.completed && !task.frequency?.isFinalized) {
          const isDoneToday =
            task.completionHistory?.includes(todayStr) ||
            (task.completed && task.completedAt?.startsWith(todayStr));

          const freqKey = `freq-daily-${task.id}-${todayStr}`;
          if (!isDoneToday && !sentScheduledKeys.has(freqKey)) {
            const title = `🔄 Daily Habit Check-In: ${task.title}`;
            const body = `Have you completed "${task.title}" today? (${task.moodEmoji || '🧘'} Mood driver)`;
            
            triggerNotification(title, body, task.id);
            setSentScheduledKeys((prev) => new Set(prev).add(freqKey));
          }
        }

        // 2. REGULAR TASKS: Due Date Start-of-Day & 30-Minute Warnings
        if (task.taskType !== 'frequent' && task.dueDateTime && !task.completed) {
          const dueTimeMs = new Date(task.dueDateTime).getTime();
          if (isNaN(dueTimeMs)) return;

          const dueDateStr = new Date(dueTimeMs).toISOString().split('T')[0];
          const isDueToday = dueDateStr === todayStr;

          // Start of Day Notification (00:00:01 key)
          const startOfDayKey = `reg-sod-${task.id}-${todayStr}`;
          if (isDueToday && !sentScheduledKeys.has(startOfDayKey)) {
            const title = `📅 Task Due Today: ${task.title}`;
            const body = `Scheduled for today • Urgency: ${task.urgency} (${task.environmentalCategory})`;

            triggerNotification(title, body, task.id);
            setSentScheduledKeys((prev) => new Set(prev).add(startOfDayKey));
          }

          // 30 Minutes Before Due Time Notification
          const msUntilDue = dueTimeMs - currentRefTime;
          const minUntilDue = msUntilDue / (1000 * 60);
          const warn30Key = `reg-30m-${task.id}-${task.dueDateTime}`;

          if (minUntilDue > 0 && minUntilDue <= 30 && !sentScheduledKeys.has(warn30Key)) {
            const title = `⏰ 30 Minutes Warning: ${task.title}`;
            const body = `Task is due in ${Math.ceil(minUntilDue)} minutes! (${task.urgency} urgency)`;

            triggerNotification(title, body, task.id);
            setSentScheduledKeys((prev) => new Set(prev).add(warn30Key));
          }
        }
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [tasks, settings.globalNotificationsEnabled, simulatedOffsetMs, sentScheduledKeys]);

  // Session History Management
  const handleStartNewChat = () => {
    setSessions((prev) => archiveCurrentSessionIfNeeded(messages, prev, currentSessionId));
    const newMsgs = getFreshWelcomeMessage(tasks, people);
    setMessages(newMsgs);
    setCurrentSessionId(`session-${Date.now()}`);
  };

  const handleSelectSession = (selectedSession: ChatSession) => {
    setSessions((prev) => archiveCurrentSessionIfNeeded(messages, prev, currentSessionId));
    setMessages(selectedSession.messages);
    setCurrentSessionId(selectedSession.id);
  };

  const handleDeleteSession = (sessionId: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (currentUser) {
      deleteCloudSession(currentUser.uid, sessionId);
    }
  };

  // Perform background deduplication scan right after user sends message
  const runBackgroundDeduplicationScan = (latestTasks: Task[], latestPeople: Person[]) => {
    const candidates = findDuplicateCandidates(latestTasks, latestPeople);
    if (candidates.length === 0) return;

    let currentTasks = [...latestTasks];
    let currentPeople = [...latestPeople];
    let autoMergedCount = 0;

    candidates.forEach((cand) => {
      if (cand.type === 'tag') {
        currentTasks = executeTagMerge(currentTasks, cand.tagDuplicate, cand.tagCanonical);
        autoMergedCount++;
      } else if (cand.type === 'task') {
        const t1 = cand.olderTask;
        const t2 = cand.newerTask;
        const isExactTitle = t1.title.trim().toLowerCase() === t2.title.trim().toLowerCase();
        const hasUrgencyConflict = t1.urgency !== t2.urgency && t1.urgency && t2.urgency;

        if (isExactTitle && !hasUrgencyConflict) {
          const merged = executeTaskMerge(t1, t2);
          currentTasks = currentTasks
            .filter((t) => t.id !== t1.id)
            .map((t) => (t.id === t2.id ? merged : t));
          autoMergedCount++;
        }
      } else if (cand.type === 'person') {
        const p1 = cand.olderPerson;
        const p2 = cand.newerPerson;
        const isExactName = p1.name.trim().toLowerCase() === p2.name.trim().toLowerCase();

        if (isExactName) {
          const merged = executePersonMerge(p1, p2);
          currentPeople = currentPeople
            .filter((p) => p.id !== p1.id)
            .map((p) => (p.id === p2.id ? merged : p));

          currentTasks = currentTasks.map((t) => {
            if (t.involvedPeopleIds?.includes(p1.id)) {
              return {
                ...t,
                involvedPeopleIds: Array.from(
                  new Set([...t.involvedPeopleIds.filter((id) => id !== p1.id), p2.id])
                ),
              };
            }
            return t;
          });
          autoMergedCount++;
        }
      }
    });

    if (autoMergedCount > 0) {
      setTasks(currentTasks);
      setPeople(currentPeople);
    }

    const remainingCandidates = findDuplicateCandidates(currentTasks, currentPeople);
    if (remainingCandidates.length > 0 || autoMergedCount > 0) {
      setDuplicateToastInfo({
        show: true,
        count: remainingCandidates.length,
        autoMerged: autoMergedCount,
      });
    }
  };

  // Handler to send a chat message to the server API
  const handleSendMessage = async (text: string) => {
    // Approach 5A: Pre-flight Offline Check
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const userMsgId = `usr-${Date.now()}`;
      const timestampStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const newUserMsg: ChatMessage = {
        id: userMsgId,
        role: 'user',
        content: text,
        timestamp: timestampStr,
      };
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'Oops, something happened :C',
        timestamp: timestampStr,
        isError: true,
        errorCode: 'ERR_NETWORK_OFFLINE',
        errorDetails: 'Your device is currently offline.',
      };
      setMessages((prev) => [...prev, newUserMsg, errorMsg]);
      return;
    }

    const userMsgId = `usr-${Date.now()}`;
    const timestampStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newUserMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: text,
      timestamp: timestampStr,
    };

    const updatedMessages = [...messages, newUserMsg];
    setMessages(updatedMessages);
    setIsAiLoading(true);

    // Immediate background duplicate scan right after message send
    setTimeout(() => {
      runBackgroundDeduplicationScan(tasks, people);
    }, 100);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
          userTasks: tasks,
          userPeople: people,
        }),
      });

      if (!response.ok) {
        let errCode = response.status === 429 ? 'ERR_QUOTA_EXCEEDED' : `ERR_HTTP_${response.status}`;
        let details = `HTTP error ${response.status}`;
        if (response.status === 503) {
          errCode = 'ERR_MODEL_HIGH_DEMAND';
          details = 'The AI model is currently experiencing high demand. Automatic retry available.';
        }
        try {
          const errData = await response.json();
          if (errData.errorCode) errCode = errData.errorCode;
          if (errData.errorDetails) details = errData.errorDetails;
        } catch (_) {}

        const errorMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: 'Oops, something happened :C',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isError: true,
          errorCode: errCode,
          errorDetails: details,
          retryPrompt: text,
        };
        setMessages((prev) => [...prev, errorMsg]);
        return;
      }

      const data = await response.json();

      if (data.isError) {
        const errorMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: data.replyText || 'Oops, something happened :C',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isError: true,
          errorCode: data.errorCode || 'ERR_UNKNOWN_WORKFLOW_FAIL',
          errorDetails: data.errorDetails || 'Processing error occurred.',
          retryPrompt: text,
        };
        setMessages((prev) => [...prev, errorMsg]);
        return;
      }

      if (data.isSafetyAlert) {
        setHasActiveSafetyAlert(true);
        // Reset Crisis Helpline Support Banner back to enabled whenever a new safety alert is triggered
        setSettings((prev) => ({ ...prev, safetyHelplineBannerEnabled: true }));
      }

      // Single-pass mutable working state for people & tasks
      let workingPeopleList = [...people];
      let updatedTasksList = [...tasks];

      const resolvePerson = (
        nameOrId: string,
        extraNotes?: string,
        role?: string,
        aliases?: string[]
      ): Person => {
        if (!nameOrId) return null as any;
        const clean = nameOrId.trim().toLowerCase();

        let p = workingPeopleList.find(
          (item) =>
            item.id === nameOrId ||
            item.name.toLowerCase() === clean ||
            item.aliases?.some((a) => a.toLowerCase() === clean)
        );

        if (p) {
          let updatedNotes = p.notes || '';
          if (extraNotes && extraNotes.trim()) {
            const cleanExtra = extraNotes.trim();
            if (!updatedNotes.toLowerCase().includes(cleanExtra.toLowerCase())) {
              updatedNotes = updatedNotes ? `${updatedNotes}\n• ${cleanExtra}` : cleanExtra;
            }
          }

          const mergedAliases = Array.from(
            new Set([...(p.aliases || []), ...(aliases || [])])
          );

          const updatedP: Person = {
            ...p,
            roleOrRelation:
              role && !['contact', 'other'].includes(role.toLowerCase())
                ? role
                : p.roleOrRelation,
            notes: updatedNotes,
            aliases: mergedAliases,
          };

          workingPeopleList = workingPeopleList.map((item) =>
            item.id === p!.id ? updatedP : item
          );
          return updatedP;
        } else {
          const newP: Person = {
            id: `person-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            name: nameOrId.trim(),
            roleOrRelation: role || 'Contact',
            avatarColor: getRandomAvatarColor(),
            notes: extraNotes ? extraNotes.trim() : '',
            aliases: aliases || [],
            createdAt: new Date().toISOString(),
          };
          workingPeopleList.push(newP);
          return newP;
        }
      };

      // 1. Process extracted people profiles from AI response
      const extractedPeopleIds: string[] = [];
      if (data.extractedPeople && Array.isArray(data.extractedPeople)) {
        data.extractedPeople.forEach((extP: any) => {
          if (!extP || !extP.name) return;
          const targetKey = extP.existingPersonId || extP.name;
          const pObj = resolvePerson(targetKey, extP.notes, extP.roleOrRelation, extP.aliases);
          if (pObj) extractedPeopleIds.push(pObj.id);
        });
      }

      // 2. Process extracted tasks
      const createdTaskIds: string[] = [];
      const updatedTaskIds: string[] = [];

      if (data.extractedTasks && Array.isArray(data.extractedTasks) && data.extractedTasks.length > 0) {
        data.extractedTasks.forEach((extTask: any) => {
          const matchedPeopleIds: string[] = [];

          if (Array.isArray(extTask.involvedPeopleIds)) {
            extTask.involvedPeopleIds.forEach((pid: string) => {
              if (pid) {
                const resolvedP = resolvePerson(pid);
                if (resolvedP && !matchedPeopleIds.includes(resolvedP.id)) {
                  matchedPeopleIds.push(resolvedP.id);
                }
              }
            });
          }

          if (Array.isArray(extTask.involvedPeopleNames)) {
            extTask.involvedPeopleNames.forEach((name: string) => {
              if (!name?.trim()) return;
              const resolvedP = resolvePerson(
                name,
                `Added from task "${extTask.title || 'Untitled'}"`
              );
              if (resolvedP && !matchedPeopleIds.includes(resolvedP.id)) {
                matchedPeopleIds.push(resolvedP.id);
              }
            });
          }

          const isUpdate = extTask.action === 'update' && extTask.existingTaskId;
          const existingIdx = isUpdate ? updatedTasksList.findIndex((t) => t.id === extTask.existingTaskId) : -1;

          if (isUpdate && existingIdx !== -1) {
            const existingTask = updatedTasksList[existingIdx];
            const existingBullets = new Set(existingTask.notesBullets || []);
            if (extTask.notesBullets && Array.isArray(extTask.notesBullets)) {
              extTask.notesBullets.forEach((b: string) => existingBullets.add(b));
            }

            const mergedPeopleIds = Array.from(
              new Set([...(existingTask.involvedPeopleIds || []), ...matchedPeopleIds])
            );

            const mergedEmotion = Array.from(
              new Set([...(existingTask.emotionalKeywords || []), ...(extTask.emotionalCategory || [])])
            );

            let extractedFreq = extTask.frequency;
            if (!extractedFreq || !extractedFreq.enabled) {
              const textLower = text.toLowerCase();
              const detectedDays: DayOfWeek[] = [];

              if (/every\s*day|daily|everyday/.test(textLower)) {
                detectedDays.push('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun');
              } else {
                if (/weekday|weekdays/.test(textLower)) detectedDays.push('Mon', 'Tue', 'Wed', 'Thu', 'Fri');
                if (/weekend|weekends/.test(textLower)) detectedDays.push('Sat', 'Sun');
                if (/mon(day)?s?/.test(textLower)) detectedDays.push('Mon');
                if (/tue(sday)?s?|tues/.test(textLower)) detectedDays.push('Tue');
                if (/wed(nesday)?s?/.test(textLower)) detectedDays.push('Wed');
                if (/thu(rsday)?s?|thurs/.test(textLower)) detectedDays.push('Thu');
                if (/fri(day)?s?/.test(textLower)) detectedDays.push('Fri');
                if (/sat(urday)?s?/.test(textLower)) detectedDays.push('Sat');
                if (/sun(day)?s?/.test(textLower)) detectedDays.push('Sun');
              }

              const uniqueDays = Array.from(new Set(detectedDays));
              if (uniqueDays.length > 0) {
                let repeatTime = '09:00';
                const timeMatch = textLower.match(/at\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
                if (timeMatch) {
                  let hour = parseInt(timeMatch[1], 10);
                  const mins = timeMatch[2] ? timeMatch[2] : '00';
                  const ampm = timeMatch[3];
                  if (ampm === 'pm' && hour < 12) hour += 12;
                  if (ampm === 'am' && hour === 12) hour = 0;
                  repeatTime = `${hour.toString().padStart(2, '0')}:${mins}`;
                }

                extractedFreq = {
                  enabled: true,
                  daysOfWeek: uniqueDays,
                  repeatTime,
                  addToStopwatch: true,
                  stopwatchTargetMinutes: extTask.intendedTimeMinutes || 30,
                };
              }
            } else if (extractedFreq && extractedFreq.enabled) {
              extractedFreq = {
                enabled: true,
                daysOfWeek: Array.isArray(extractedFreq.daysOfWeek) && extractedFreq.daysOfWeek.length > 0 ? extractedFreq.daysOfWeek : ['Mon'],
                repeatTime: extractedFreq.repeatTime || '09:00',
                addToStopwatch: true,
                stopwatchTargetMinutes: Number(extractedFreq.stopwatchTargetMinutes) || extTask.intendedTimeMinutes || 30,
              };
            }

            const updatedTaskObj: Task = {
              ...existingTask,
              title: extTask.title || existingTask.title,
              urgency: (extTask.urgency as UrgencyLevel) || existingTask.urgency,
              completed: typeof extTask.completed === 'boolean' ? extTask.completed : existingTask.completed,
              completedAt: extTask.completed ? (existingTask.completedAt || new Date().toISOString()) : (extTask.completed === false ? null : existingTask.completedAt),
              dueDateTime: extTask.dueDateTime !== undefined ? extTask.dueDateTime : existingTask.dueDateTime,
              environmentalCategory: extTask.environmentalCategory || existingTask.environmentalCategory,
              intendedTimeMinutes: extTask.intendedTimeMinutes || existingTask.intendedTimeMinutes,
              actualTimeMinutes: extTask.actualTimeMinutes !== null && extTask.actualTimeMinutes !== undefined ? extTask.actualTimeMinutes : existingTask.actualTimeMinutes,
              notesBullets: Array.from(existingBullets),
              involvedPeopleIds: mergedPeopleIds,
              emotionalKeywords: mergedEmotion.length > 0 ? mergedEmotion : existingTask.emotionalKeywords,
              followUpFrequency: extTask.followUpFrequency || existingTask.followUpFrequency,
              frequency: extractedFreq || existingTask.frequency,
              // Question 3: Non-Destructive preservation of routines & historical logs
              completionHistory: existingTask.completionHistory || [],
              completedPastDue: existingTask.completedPastDue,
              moodEmoji: extTask.moodEmoji || existingTask.moodEmoji,
            };

            updatedTasksList[existingIdx] = updatedTaskObj;
            updatedTaskIds.push(existingTask.id);

            if (settings.globalNotificationsEnabled) {
              triggerNotification(
                `Task Updated on File: ${updatedTaskObj.title}`,
                `Modified details • Urgency: ${updatedTaskObj.urgency}`,
                updatedTaskObj.id
              );
            }
          } else {
            // CREATE NEW TASK
            let extractedFreq = extTask.frequency;
            if (!extractedFreq || !extractedFreq.enabled) {
              const textLower = text.toLowerCase();
              const detectedDays: DayOfWeek[] = [];

              if (/every\s*day|daily|everyday/.test(textLower)) {
                detectedDays.push('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun');
              } else {
                if (/weekday|weekdays/.test(textLower)) detectedDays.push('Mon', 'Tue', 'Wed', 'Thu', 'Fri');
                if (/weekend|weekends/.test(textLower)) detectedDays.push('Sat', 'Sun');
                if (/mon(day)?s?/.test(textLower)) detectedDays.push('Mon');
                if (/tue(sday)?s?|tues/.test(textLower)) detectedDays.push('Tue');
                if (/wed(nesday)?s?/.test(textLower)) detectedDays.push('Wed');
                if (/thu(rsday)?s?|thurs/.test(textLower)) detectedDays.push('Thu');
                if (/fri(day)?s?/.test(textLower)) detectedDays.push('Fri');
                if (/sat(urday)?s?/.test(textLower)) detectedDays.push('Sat');
                if (/sun(day)?s?/.test(textLower)) detectedDays.push('Sun');
              }

              const uniqueDays = Array.from(new Set(detectedDays));
              if (uniqueDays.length > 0) {
                let repeatTime = '09:00';
                const timeMatch = textLower.match(/at\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
                if (timeMatch) {
                  let hour = parseInt(timeMatch[1], 10);
                  const mins = timeMatch[2] ? timeMatch[2] : '00';
                  const ampm = timeMatch[3];
                  if (ampm === 'pm' && hour < 12) hour += 12;
                  if (ampm === 'am' && hour === 12) hour = 0;
                  repeatTime = `${hour.toString().padStart(2, '0')}:${mins}`;
                }

                extractedFreq = {
                  enabled: true,
                  daysOfWeek: uniqueDays,
                  repeatTime,
                  addToStopwatch: true,
                  stopwatchTargetMinutes: extTask.intendedTimeMinutes || 30,
                };
              }
            } else if (extractedFreq && extractedFreq.enabled) {
              extractedFreq = {
                enabled: true,
                daysOfWeek: Array.isArray(extractedFreq.daysOfWeek) && extractedFreq.daysOfWeek.length > 0 ? extractedFreq.daysOfWeek : ['Mon'],
                repeatTime: extractedFreq.repeatTime || '09:00',
                addToStopwatch: true,
                stopwatchTargetMinutes: Number(extractedFreq.stopwatchTargetMinutes) || extTask.intendedTimeMinutes || 30,
              };
            }

            const newTaskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
            const newTaskObj: Task = {
              id: newTaskId,
              title: extTask.title || 'Untitled Task',
              completed: !!extTask.completed,
              urgency: (extTask.urgency as UrgencyLevel) || 'Medium',
              createdAt: new Date().toISOString(),
              dueDateTime: extTask.dueDateTime || null,
              emotionalKeywords: extTask.emotionalCategory || ['Focus'],
              environmentalCategory: extTask.environmentalCategory || 'Work',
              intendedTimeMinutes: extTask.intendedTimeMinutes || 30,
              actualTimeMinutes: extTask.actualTimeMinutes || 0,
              notesBullets: extTask.notesBullets || [],
              involvedPeopleIds: matchedPeopleIds,
              followUpFrequency: extTask.followUpFrequency || 'auto',
              notificationsEnabled: true,
              frequency: extractedFreq || undefined,
              reminders: extTask.reminders || [
                {
                  id: `rem-${Date.now()}`,
                  label: 'Task Reminder',
                  triggerTime: extTask.dueDateTime || 'Today',
                  type: 'notification',
                  sent: false,
                },
              ],
            };

            updatedTasksList.push(newTaskObj);
            createdTaskIds.push(newTaskId);

            if (settings.globalNotificationsEnabled) {
              triggerNotification(
                `Task Logged: ${newTaskObj.title}`,
                `Assigned Urgency: ${newTaskObj.urgency} • ${newTaskObj.environmentalCategory}`,
                newTaskObj.id
              );
            }
          }
        });
      }

      // 3. Final sanitization & auto-heal sync
      const { sanitizedPeople: finalPeople, idMap } = sanitizePeople(
        workingPeopleList,
        updatedTasksList
      );
      const { sanitizedTasks: remappedTasks } = remapTasksPeopleIds(
        updatedTasksList,
        idMap
      );
      const { sanitized: finalTasks } = sanitizeTasks(remappedTasks);

      setPeople(finalPeople);
      savePeople(finalPeople);
      setTasks(finalTasks);
      saveTasks(finalTasks);

      if (currentUser?.uid) {
        syncPeopleToFirestore(currentUser.uid, finalPeople);
        syncTasksToFirestore(currentUser.uid, finalTasks);
      }

      // Append Assistant Message
      const assistantMsg: ChatMessage = {
        id: `ast-${Date.now()}`,
        role: 'assistant',
        content: data.replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isOffTopic: data.isOffTopic,
        isSafetyAlert: data.isSafetyAlert,
        isHighDemandFallback: Boolean(data.isHighDemandFallback),
        suggestedRephrase: data.suggestedRephrase,
        refiningQuestion: data.refiningQuestion,
        extractedTaskIds: createdTaskIds.length > 0 ? createdTaskIds : undefined,
        updatedTaskIds: updatedTaskIds.length > 0 ? updatedTaskIds : undefined,
        extractedPeopleIds: extractedPeopleIds.length > 0 ? extractedPeopleIds : undefined,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Run background deduplication scan on newly updated tasks & people
      setTimeout(() => {
        runBackgroundDeduplicationScan(updatedTasksList, people);
      }, 200);
    } catch (err: any) {
      console.error('AI chat error:', err);
      const captured = getLatestCapturedError();
      const errCode = captured?.errorCode || classifyError(err, 'ERR_UNKNOWN_WORKFLOW_FAIL');
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'Oops, something happened :C',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true,
        errorCode: errCode,
        errorDetails: err?.message || 'Error occurred during request processing.',
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Trigger system notification banner
  const triggerNotification = (title: string, message: string, taskId?: string) => {
    if (!settings.globalNotificationsEnabled) return;
    const newNotif: SystemNotification = {
      id: `notif-${Date.now()}`,
      title,
      message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: false,
      type: 'task_reminder',
      taskId,
    };
    setNotifications((prev) => [...prev, newNotif]);
    sendSystemDesktopNotification(title, message, taskId);
  };

  const handleDismissNotification = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  // Task actions
  const handleToggleTaskComplete = (taskId: string) => {
    const currentRefTime = Date.now() + simulatedOffsetMs;
    let becameCompleted = false;

    setTasks((prev) => {
      const rawUpdated = prev.map((t) => {
        if (t.id !== taskId) return t;
        const nextCompleted = !t.completed;
        becameCompleted = nextCompleted;
        const currentUrgency = calculateDynamicUrgency(t, currentRefTime);
        const isPastDue = currentUrgency === 'Past Due' || (t.dueDateTime && new Date(t.dueDateTime).getTime() < currentRefTime);

        const isRepetitive = t.taskType === 'frequent' || Boolean(t.frequency?.enabled);
        const updatedFrequency = isRepetitive && t.frequency
          ? {
              ...t.frequency,
              isFinalized: nextCompleted,
              finalizedAt: nextCompleted ? new Date(currentRefTime).toISOString() : null,
            }
          : t.frequency;

        const updatedTask = {
          ...t,
          completed: nextCompleted,
          completedAt: nextCompleted ? new Date(currentRefTime).toISOString() : null,
          completedPastDue: nextCompleted ? (isPastDue || Boolean(t.completedPastDue)) : t.completedPastDue,
          frequency: updatedFrequency,
        };
        return normalizeTaskCompletedTags(updatedTask).task;
      });
      return sanitizeTasks(rawUpdated).sanitized;
    });

    // Stopwatch association: stop active timer whenever task is completed / finalized
    if (becameCompleted) {
      setStopwatchTimers((prevTimers) => {
        const timer = prevTimers[taskId];
        if (!timer || !timer.isRunning) return prevTimers;
        const elapsed = getTimerElapsedSeconds(timer);
        return {
          ...prevTimers,
          [taskId]: {
            ...timer,
            isRunning: false,
            startTimeMs: null,
            accumulatedSeconds: elapsed,
          },
        };
      });
    }
  };

  const handleToggleFrequentToday = (taskId: string, dateStr: string) => {
    setTasks((prev) => {
      const updatedList = prev.map((t) => {
        if (t.id !== taskId) return t;
        if (t.frequency?.isFinalized) return t; // Skip finalized routines
        const currentHistory = t.completionHistory || [];
        const isDone = currentHistory.includes(dateStr);
        const newHistory = isDone
          ? currentHistory.filter((d) => d !== dateStr)
          : [...currentHistory, dateStr];

        const updatedTask: Task = {
          ...t,
          completionHistory: newHistory,
          // Frequent activities that are not finalized are continuous routines and remain active (completed: false)
          completed: false,
          completedAt: null,
        };
        return normalizeTaskCompletedTags(updatedTask).task;
      });
      return sanitizeTasks(updatedList).sanitized;
    });
  };

  const handleToggleTaskNotification = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, notificationsEnabled: !t.notificationsEnabled } : t))
    );
  };

  const handleUpdateTask = (updatedTask: Task) => {
    setTasks((prev) => {
      const raw = prev.map((t) => (t.id === updatedTask.id ? updatedTask : t));
      return sanitizeTasks(raw).sanitized;
    });

    // Stopwatch association: stop active timer whenever task is marked fully completed or finalized
    if (updatedTask.completed || updatedTask.frequency?.isFinalized) {
      setStopwatchTimers((prevTimers) => {
        const timer = prevTimers[updatedTask.id];
        if (!timer || !timer.isRunning) return prevTimers;
        const elapsed = getTimerElapsedSeconds(timer);
        return {
          ...prevTimers,
          [updatedTask.id]: {
            ...timer,
            isRunning: false,
            startTimeMs: null,
            accumulatedSeconds: elapsed,
          },
        };
      });
    }
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    if (currentUser) {
      deleteCloudTask(currentUser.uid, taskId);
    }
    setSelectedTask(null);
  };

  const handleAddNewTask = (newTaskData: Partial<Task>) => {
    const hasFreq = Boolean(newTaskData.frequency && newTaskData.frequency.enabled);
    const taskType = hasFreq ? 'frequent' : (newTaskData.taskType || 'regular');
    const newTaskObj: Task = {
      id: `task-${Date.now()}`,
      title: newTaskData.title || 'New Task',
      taskType,
      completed: false,
      urgency: taskType === 'frequent' ? 'Low' : (newTaskData.urgency || 'Medium'),
      createdAt: new Date().toISOString(),
      dueDateTime: taskType === 'frequent' ? null : (newTaskData.dueDateTime || null),
      emotionalKeywords: newTaskData.emotionalKeywords || ['Focus'],
      environmentalCategory: newTaskData.environmentalCategory || 'Work',
      intendedTimeMinutes: newTaskData.intendedTimeMinutes || 30,
      actualTimeMinutes: 0,
      notesBullets: newTaskData.notesBullets || [],
      involvedPeopleIds: newTaskData.involvedPeopleIds || [],
      followUpFrequency: newTaskData.followUpFrequency || 'auto',
      notificationsEnabled: true,
      frequency: hasFreq ? newTaskData.frequency : undefined,
      reminders: [],
    };
    setTasks((prev) => sanitizeTasks([newTaskObj, ...prev]).sanitized);
  };

  // People actions
  const handleUpdatePerson = (updatedPerson: Person) => {
    setPeople((prev) => prev.map((p) => (p.id === updatedPerson.id ? updatedPerson : p)));
  };

  const handleDeletePerson = (personId: string) => {
    setPeople((prev) => prev.filter((p) => p.id !== personId));
    if (currentUser) {
      deleteCloudPerson(currentUser.uid, personId);
    }
    setSelectedPerson(null);
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error('Sign out error:', e);
    }
  };

  const handleManualSync = async () => {
    if (!currentUser) return;
    setIsSyncing(true);
    try {
      await syncAllToCloud(currentUser.uid, {
        tasks,
        people,
        settings,
        sessions,
        messages,
      });
    } catch (e) {
      console.error('Manual sync error:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddNewPerson = (newPersonData: Partial<Person>): Person => {
    const newPersonObj: Person = {
      id: `person-${Date.now()}`,
      name: newPersonData.name || 'New Person',
      roleOrRelation: newPersonData.roleOrRelation || 'Contact',
      avatarColor: newPersonData.avatarColor || getRandomAvatarColor(),
      email: newPersonData.email,
      phone: newPersonData.phone,
      notes: newPersonData.notes || '',
      aliases: newPersonData.aliases || [],
      createdAt: new Date().toISOString(),
    };
    setPeople((prev) => [...prev, newPersonObj]);
    return newPersonObj;
  };

  const handleResetAllData = async () => {
    // 1. Wipe local storage
    resetAllAppData();

    // 2. Perform Atomic Cross-Collection Cloud Data Scrub (Approach 4A & Approach 1B)
    if (currentUser) {
      try {
        setIsSyncing(true);
        await clearAllCloudData(currentUser.uid);
      } catch (err) {
        console.error('Failed to scrub cloud data on reset:', err);
      } finally {
        setIsSyncing(false);
      }
    }

    // 3. Absolute Zero Clean Canvas (Approach 2B)
    const freshWelcome = getFreshWelcomeMessage([], []);
    setTasks([]);
    setPeople([]);
    setSessions([]);
    setMessages(freshWelcome);
    setCurrentSessionId(`session-${Date.now()}`);
    setNotifications([]);
    setSettings(defaultSettings);
    setSelectedTask(null);
    setSelectedPerson(null);
    setHasActiveSafetyAlert(false);
    setActiveTab('chat');
  };

  if (authLoading) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center text-white space-y-4 font-sans">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center animate-pulse shadow-xl shadow-violet-500/30">
          <Sparkles className="w-7 h-7 text-white" />
        </div>
        <p className="text-sm font-semibold text-slate-300">Connecting to Violet Cloud Session...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthGate />;
  }

  return (
    <div className="h-screen h-[100dvh] w-screen bg-slate-50 flex flex-col overflow-hidden font-sans relative">
      {/* App Top Header Bar */}
      <header className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between border-b border-slate-800 shrink-0 z-30 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-md">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold leading-none tracking-tight text-white flex items-center gap-2">
              <span>Violet</span>
              <span className="text-[10px] bg-violet-500/20 text-violet-300 border border-violet-500/30 font-mono px-1.5 py-0.5 rounded-md hidden sm:inline">
                ai-task-violet
              </span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Online / Offline Sync Badge (Approach 5B) */}
          {isOnline ? (
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              title="Click to force cloud sync"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold hover:bg-emerald-500/20 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 text-emerald-400 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Cloud Synced'}</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-semibold">
              <WifiOff className="w-3 h-3 text-amber-400" />
              <span>Offline Mode</span>
            </div>
          )}

          {/* User Account Profile Pill */}
          <div className="relative">
            <button
              onClick={() => setUserDropdownOpen((prev) => !prev)}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700/80 border border-slate-700/80 rounded-full pl-1 pr-2.5 py-1 transition-all cursor-pointer"
            >
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName || 'User'}
                  className="w-6 h-6 rounded-full object-cover border border-violet-400"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-violet-600 text-white font-bold text-xs flex items-center justify-center">
                  {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : 'U'}
                </div>
              )}
              <span className="text-xs font-medium text-slate-200 max-w-[110px] truncate hidden sm:inline">
                {currentUser.displayName || currentUser.email}
              </span>
            </button>

            {userDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-3 z-50 text-slate-200 space-y-2 animate-fade-in">
                <div className="px-2 py-1 border-b border-slate-800 pb-2">
                  <p className="text-xs font-bold text-white truncate">{currentUser.displayName || 'Google User'}</p>
                  <p className="text-[11px] text-slate-400 truncate">{currentUser.email}</p>
                  <p className="text-[10px] text-violet-400 font-mono mt-0.5">ai-task-violet.ai.studio</p>
                </div>
                <button
                  onClick={() => {
                    setUserDropdownOpen(false);
                    setActiveTab('settings');
                  }}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <UserIcon className="w-3.5 h-3.5 text-violet-400" />
                  <span>Account & Settings</span>
                </button>
                <button
                  onClick={() => {
                    setUserDropdownOpen(false);
                    handleSignOut();
                  }}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-rose-300 hover:text-rose-200 hover:bg-rose-500/10 rounded-xl flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-400" />
                  <span>Sign Out of Gmail</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Real-time Android Shade System Notifications */}
      <AndroidShadeNotification
        notifications={notifications}
        onDismiss={handleDismissNotification}
        onOpenTask={(tid) => {
          const found = tasks.find((t) => t.id === tid);
          if (found) setSelectedTask(found);
        }}
      />

      {/* Main App Container */}
      <div className="flex-1 w-full bg-slate-50 overflow-hidden flex flex-col relative">
        {/* Explicit System & Chrome Notification Request Banner (Approach 1A) */}
        {systemNotifPermission === 'default' && (
          <div className="bg-gradient-to-r from-violet-900/95 via-indigo-900/95 to-slate-900/95 text-white px-4 py-2.5 shadow-md flex flex-wrap items-center justify-between text-xs border-b border-violet-700/50 animate-fade-in shrink-0 z-40 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Bell className="w-4 h-4 text-violet-300 animate-pulse shrink-0" />
              <span className="truncate">
                <strong>Enable PC Desktop & Mobile Chrome System Alerts:</strong> Get instant popups even when Violet is minimized.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={async () => {
                  const res = await requestNotificationPermission();
                  setSystemNotifPermission(res);
                  if (res === 'granted') {
                    sendSystemDesktopNotification(
                      '🔔 System Alerts Activated!',
                      'Violet will now send you real-time alerts on PC Desktop and Mobile Chrome.'
                    );
                  }
                }}
                className="bg-violet-500 hover:bg-violet-400 text-white px-3 py-1 rounded-xl font-bold transition-colors shadow-xs cursor-pointer text-[11px]"
              >
                Enable Notifications
              </button>
              <button
                onClick={() => setSystemNotifPermission('dismissed')}
                className="text-violet-300 hover:text-white p-1 rounded-lg cursor-pointer"
                title="Dismiss Banner"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
          {activeTab === 'chat' && (
            <ChatView
              messages={messages}
              onSendMessage={handleSendMessage}
              isLoading={isAiLoading}
              onNavigateToTask={(tid) => {
                const found = tasks.find((t) => t.id === tid);
                if (found) setSelectedTask(found);
              }}
              onNavigateToPerson={(pid) => {
                const found = people.find((p) => p.id === pid);
                if (found) setSelectedPerson(found);
              }}
              tasks={tasks}
              people={people}
              sessions={sessions}
              currentSessionId={currentSessionId}
              onStartNewChat={handleStartNewChat}
              onSelectSession={handleSelectSession}
              onDeleteSession={handleDeleteSession}
              onOpenDuplicatesModal={() => setShowDuplicatesModal(true)}
              hasActiveSafetyAlert={hasActiveSafetyAlert}
              safetyHelplineBannerEnabled={settings.safetyHelplineBannerEnabled}
              duplicateToastInfo={duplicateToastInfo}
              onDismissDuplicateToast={() => setDuplicateToastInfo((prev) => ({ ...prev, show: false }))}
            />
          )}

          <div className={`flex-1 w-full bg-slate-50 overflow-hidden flex flex-col relative ${activeTab === 'stopwatch' ? '' : 'hidden'}`}>
            <StopwatchView
              tasks={tasks}
              people={people}
              onUpdateTask={handleUpdateTask}
              onAddNewTask={handleAddNewTask}
              timers={stopwatchTimers}
              onUpdateTimers={setStopwatchTimers}
              simulatedOffsetMs={simulatedOffsetMs}
            />
          </div>

          {activeTab === 'tasks' && (
            <TaskListView
              tasks={tasks}
              people={people}
              onSelectTask={(task) => setSelectedTask(task)}
              onUpdateTask={handleUpdateTask}
              onToggleComplete={handleToggleTaskComplete}
              onToggleFrequentToday={handleToggleFrequentToday}
              onToggleNotification={handleToggleTaskNotification}
              onAddNewTask={handleAddNewTask}
              onAddNewPerson={handleAddNewPerson}
              simulatedOffsetMs={simulatedOffsetMs}
            />
          )}

          {activeTab === 'people' && (
            <PeopleView
              people={people}
              tasks={tasks}
              onSelectPerson={(person) => setSelectedPerson(person)}
              onUpdatePerson={handleUpdatePerson}
              onAddNewPerson={handleAddNewPerson}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsView
              tasks={tasks}
              people={people}
              stopwatchTimers={stopwatchTimers}
            />
          )}

          {activeTab === 'settings' && (
            <RemindersSettingsView
              settings={settings}
              tasks={tasks}
              notifications={notifications}
              onUpdateSettings={setSettings}
              onTriggerTestNotification={triggerNotification}
              onSendChatMessage={(prompt) => {
                setActiveTab('chat');
                handleSendMessage(prompt);
              }}
              onResetAllData={handleResetAllData}
              onOpenDuplicatesModal={() => setShowDuplicatesModal(true)}
              simulatedOffsetMs={simulatedOffsetMs}
              onFastForwardTime={(addMs) => setSimulatedOffsetMs((prev) => prev + addMs)}
              onResetSimulatedTime={() => setSimulatedOffsetMs(0)}
              currentUser={currentUser}
              onSignOut={handleSignOut}
            />
          )}
        </div>

        {/* Review & Merge Duplicates Modal */}
        {showDuplicatesModal && (
          <MergeDuplicatesModal
            tasks={tasks}
            people={people}
            onClose={() => setShowDuplicatesModal(false)}
            onUpdateTasks={setTasks}
            onUpdatePeople={setPeople}
          />
        )}

        {/* Task Detail Modal */}
        {selectedTask && (
          <TaskDetailModal
            task={selectedTask}
            people={people}
            onClose={() => setSelectedTask(null)}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={handleDeleteTask}
            onAddNewPerson={handleAddNewPerson}
          />
        )}

        {/* Person Detail Modal */}
        {selectedPerson && (
          <PersonDetailModal
            person={selectedPerson}
            tasks={tasks}
            onClose={() => setSelectedPerson(null)}
            onUpdatePerson={handleUpdatePerson}
            onDeletePerson={handleDeletePerson}
            onOpenTask={(tid) => {
              const found = tasks.find((t) => t.id === tid);
              if (found) setSelectedTask(found);
            }}
            onSendChatMessage={(prompt) => {
              setActiveTab('chat');
              handleSendMessage(prompt);
            }}
          />
        )}

        {/* Navigation Bar */}
        <div className="bg-white border-t border-slate-200 px-4 py-2 flex items-center justify-around sm:justify-center sm:gap-10 shrink-0 z-40 shadow-xs">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-3.5 py-1.5 rounded-2xl transition-all cursor-pointer ${
              activeTab === 'chat'
                ? 'text-violet-600 bg-violet-50 font-bold'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            <span className="text-xs">AI Chat</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('stopwatch');
              // Clear completedInStopwatch flag when user opens Stopwatch tab
              setStopwatchTimers((prev) => {
                let hasCompleted = false;
                const next = { ...prev };
                Object.keys(next).forEach((id) => {
                  if (next[id]?.completedInStopwatch) {
                    hasCompleted = true;
                    next[id] = { ...next[id], completedInStopwatch: false };
                  }
                });
                return hasCompleted ? next : prev;
              });
            }}
            className={`flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-3.5 py-1.5 rounded-2xl transition-all cursor-pointer relative ${
              activeTab === 'stopwatch'
                ? 'text-violet-600 bg-violet-50 font-bold'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <Timer className={`w-5 h-5 ${(Object.values(stopwatchTimers) as ActiveTimerState[]).some((t) => t.isRunning) ? 'text-emerald-600 animate-pulse' : ''}`} />
            <span className="text-xs">Stopwatch</span>
            {(Object.values(stopwatchTimers) as ActiveTimerState[]).some((t) => t.isRunning) ? (
              <span className="absolute top-1 right-2 sm:top-1.5 sm:right-1.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            ) : (Object.values(stopwatchTimers) as ActiveTimerState[]).some((t) => t.completedInStopwatch) ? (
              <span className="absolute top-1 right-2 sm:top-1.5 sm:right-1.5 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-bounce"></span>
            ) : tasks.filter((t) => t.frequency?.addToStopwatch && !t.completed).length > 0 ? (
              <span className="absolute top-1 right-2 sm:top-1.5 sm:right-1.5 w-2 h-2 rounded-full bg-amber-500"></span>
            ) : null}
          </button>

          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-3.5 py-1.5 rounded-2xl transition-all cursor-pointer relative ${
              activeTab === 'tasks'
                ? 'text-violet-600 bg-violet-50 font-bold'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <CheckSquare className="w-5 h-5" />
            <span className="text-xs">To-Do</span>
            {tasks.filter((t) => !t.completed).length > 0 && (
              <span className="absolute top-1 right-2 sm:top-1.5 sm:right-1.5 w-2 h-2 rounded-full bg-violet-600"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('people')}
            className={`flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-3.5 py-1.5 rounded-2xl transition-all cursor-pointer ${
              activeTab === 'people'
                ? 'text-violet-600 bg-violet-50 font-bold'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="text-xs">People</span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-3.5 py-1.5 rounded-2xl transition-all cursor-pointer ${
              activeTab === 'analytics'
                ? 'text-violet-600 bg-violet-50 font-bold'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            <span className="text-xs">Analytics</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-3.5 py-1.5 rounded-2xl transition-all cursor-pointer ${
              activeTab === 'settings'
                ? 'text-violet-600 bg-violet-50 font-bold'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <Bell className="w-5 h-5" />
            <span className="text-xs">Reminders</span>
          </button>
        </div>
    </div>
  );
}
