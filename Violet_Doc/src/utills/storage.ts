import { Task, Person, ChatMessage, SystemNotification, AppSettings, UrgencyLevel, ChatSession, ActiveTimerState } from '../types';
import { normalizeNoteItems, parsePersonNotes, serializePersonNotes } from './notesHelper';

const STORAGE_KEYS = {
  TASKS: 'ai_planner_tasks_v1',
  PEOPLE: 'ai_planner_people_v1',
  CHAT: 'ai_planner_chat_v1',
  SESSIONS: 'ai_planner_sessions_v1',
  NOTIFICATIONS: 'ai_planner_notifications_v1',
  SETTINGS: 'ai_planner_settings_v1',
  STOPWATCH_TIMERS: 'violet_stopwatch_timers_v1',
};

export const defaultSettings: AppSettings = {
  globalNotificationsEnabled: true,
  autoFollowUpsEnabled: true,
  safetyHelplineBannerEnabled: true,
  userName: 'User',
  notificationStyle: 'android_shade',
  notificationFrequency: 'adaptive',
};

export function getFreshWelcomeMessage(tasks?: Task[], people?: Person[]): ChatMessage[] {
  let currentTasks = tasks;
  if (!currentTasks) {
    currentTasks = loadTasks();
  }

  // Retrieve loop toggle state (0 = Option 1: Celebrate Wins & Playful Tease, 1 = Option 2: Focus on Catching Up)
  let loopIndex = 0;
  try {
    const storedLoop = localStorage.getItem('violet_greeting_loop_counter');
    if (storedLoop) {
      loopIndex = parseInt(storedLoop, 10) || 0;
    }
    localStorage.setItem('violet_greeting_loop_counter', String(loopIndex + 1));
  } catch {
    loopIndex = 0;
  }

  const completedTasks = currentTasks.filter((t) => t.completed);
  const activeTasks = currentTasks.filter((t) => !t.completed);
  const urgentTasks = activeTasks.filter((t) => t.urgency === 'ASAP' || t.urgency === 'Urgent');

  const timestampStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  let greetingContent = '';
  let refiningQ = '';

  if (loopIndex % 2 === 0) {
    // OPTION 1: Celebrate your wins and playfully tease you to set new goals
    if (completedTasks.length > 0) {
      const recentWin = completedTasks[0].title;
      greetingContent = `Hello there! I see you've already conquered ${completedTasks.length} task${
        completedTasks.length === 1 ? '' : 's'
      }, including "${recentWin}". Quite impressive... or are you just trying to make me blush? 😉\n\nNow don't rest on your laurels—what juicy new goal or ambition are we setting next, or are you waiting for my gentle nudge?`;
      refiningQ = 'Ready to set a bold new target with me?';
    } else {
      greetingContent = `Hello! A fresh start with zero tasks completed yet... I do love a blank canvas. 😏\n\nLet's turn that clean slate into a list of accomplishments! What's the first ambitious task we're going to demolish today?`;
      refiningQ = 'What exciting goal shall we log first?';
    }
  } else {
    // OPTION 2: Focus on catching up on your day
    if (urgentTasks.length > 0) {
      greetingContent = `Hey! Time to catch up on your day. You currently have ${activeTasks.length} active task${
        activeTasks.length === 1 ? '' : 's'
      }, and ${urgentTasks.length} urgent item${
        urgentTasks.length === 1 ? '' : 's'
      } demanding attention (like "${urgentTasks[0].title}").\n\nDon't keep me in suspense—how are we progressing on these, and which one are we tackling right now?`;
      refiningQ = 'Shall we catch up on your top priority task now?';
    } else if (activeTasks.length > 0) {
      greetingContent = `Welcome back! Let's do a quick catch-up on your day. You have ${activeTasks.length} task${
        activeTasks.length === 1 ? '' : 's'
      } lined up in your workflow.\n\nHow is your energy feeling today, and what progress have you made so far?`;
      refiningQ = 'Would you like to review or update your active list?';
    } else {
      greetingContent = `Hey there! Your schedule is completely clear right now. Perfect timing for us to catch up on your day and map out what's coming up next.\n\nWhat projects or errands are on your mind?`;
      refiningQ = 'What would you like to plan or review today?';
    }
  }

  return [
    {
      id: `init-msg-${Date.now()}`,
      role: 'assistant',
      content: greetingContent,
      timestamp: timestampStr,
      refiningQuestion: refiningQ,
    },
  ];
}

export function resetAllAppData(): void {
  try {
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
    localStorage.setItem('ai_planner_clean_reset_v2', 'true');
  } catch (e) {
    console.error('Failed to reset app data', e);
  }
}

export function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSessions(sessions: ChatSession[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
  } catch (e) {
    console.error('Failed to save sessions to localStorage', e);
  }
}

export function loadInitialChatState(): { activeMessages: ChatMessage[]; sessions: ChatSession[] } {
  let existingSessions = loadSessions();
  
  try {
    const rawChat = localStorage.getItem(STORAGE_KEYS.CHAT);
    if (rawChat) {
      const prevMessages: ChatMessage[] = JSON.parse(rawChat);
      // Check if previous chat had user interactions
      const hasUserMessages = prevMessages.some((m) => m.role === 'user');
      if (hasUserMessages) {
        // Archive previous session into history
        const firstUserMsg = prevMessages.find((m) => m.role === 'user');
        const sessionTitle = firstUserMsg
          ? firstUserMsg.content.slice(0, 36) + (firstUserMsg.content.length > 36 ? '...' : '')
          : 'Conversation ' + new Date().toLocaleDateString();

        const archivedSession: ChatSession = {
          id: `session-${Date.now()}`,
          title: sessionTitle,
          createdAt: new Date().toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
          messages: prevMessages,
        };

        // Don't duplicate if already archived
        const isDuplicate = existingSessions.some(
          (s) => JSON.stringify(s.messages) === JSON.stringify(prevMessages)
        );
        if (!isDuplicate) {
          existingSessions = [archivedSession, ...existingSessions];
          saveSessions(existingSessions);
        }
      }
    }
  } catch (e) {
    console.error('Error auto-archiving previous chat session:', e);
  }

  // Clear current active chat state for fresh app session opening
  const freshMessages = getFreshWelcomeMessage();
  saveChatMessages(freshMessages);

  return {
    activeMessages: freshMessages,
    sessions: existingSessions,
  };
}

export function normalizeTaskCompletedTags(task: Task): { task: Task; changed: boolean } {
  let changed = false;
  let taskCopy = { ...task };

  const isFinalized = Boolean(taskCopy.frequency?.isFinalized);

  // Frequent activities that are NOT finalized are continuous routines and shouldn't be marked as completed regular tasks.
  // When finalized (Approach 1A), they are fully completed and preserved as completed.
  if (taskCopy.taskType === 'frequent' && taskCopy.completed && !isFinalized) {
    taskCopy.completed = false;
    taskCopy.completedAt = null;
    changed = true;
  }

  const keywords = Array.isArray(taskCopy.emotionalKeywords) ? [...taskCopy.emotionalKeywords] : [];
  const hasCompletedTag = keywords.some((k) => k.toLowerCase() === 'completed');

  if (taskCopy.completed) {
    if (!hasCompletedTag) {
      keywords.push('completed');
      changed = true;
    }
  } else {
    if (hasCompletedTag) {
      const filtered = keywords.filter((k) => k.toLowerCase() !== 'completed');
      if (filtered.length !== keywords.length) {
        keywords.length = 0;
        keywords.push(...filtered);
        changed = true;
      }
    }
  }

  const normalizedTask: Task = {
    ...taskCopy,
    emotionalKeywords: keywords,
    completedAt: taskCopy.completed ? (taskCopy.completedAt || new Date().toISOString()) : null,
  };

  return { task: normalizedTask, changed };
}

export function sanitizeTasks(tasks: Task[]): { sanitized: Task[]; hasChanges: boolean } {
  let hasChanges = false;
  const sanitized = tasks.map((task) => {
    let updatedTask = { ...task };

    // Approach 1A: On-the-Fly Normalization of "completed" tag & completion state
    const { task: tagNormalized, changed: tagChanged } = normalizeTaskCompletedTags(updatedTask);
    if (tagChanged) {
      hasChanges = true;
    }
    updatedTask = tagNormalized;

    const normalizedBullets = normalizeNoteItems(updatedTask.notesBullets);
    if (JSON.stringify(normalizedBullets) !== JSON.stringify(updatedTask.notesBullets)) {
      hasChanges = true;
      updatedTask.notesBullets = normalizedBullets;
    }

    const hasFreq = Boolean(updatedTask.frequency && updatedTask.frequency.enabled);
    if (hasFreq) {
      const needTypeUpdate = updatedTask.taskType !== 'frequent';
      const needDueUpdate = updatedTask.dueDateTime !== null;
      const needUrgencyUpdate = updatedTask.urgency !== 'Low';
      const needArchivingDue = updatedTask.dueDateTime !== null && !updatedTask.archivedDueDateTime;
      const needArchivingUrgency = updatedTask.urgency !== 'Low' && !updatedTask.archivedUrgency;

      if (needTypeUpdate || needDueUpdate || needUrgencyUpdate || needArchivingDue || needArchivingUrgency) {
        hasChanges = true;
        return {
          ...updatedTask,
          taskType: 'frequent' as const,
          archivedDueDateTime: updatedTask.archivedDueDateTime ?? (updatedTask.dueDateTime || null),
          archivedUrgency: updatedTask.archivedUrgency ?? (updatedTask.urgency !== 'Low' ? updatedTask.urgency : undefined),
          dueDateTime: null,
          urgency: 'Low' as const,
          frequency: {
            ...updatedTask.frequency!,
            enabled: true,
            addToStopwatch: updatedTask.frequency?.addToStopwatch ?? true,
            stopwatchTargetMinutes: updatedTask.frequency?.stopwatchTargetMinutes || updatedTask.intendedTimeMinutes || 30,
            isFinalized: updatedTask.frequency?.isFinalized ?? false,
            finalizedAt: updatedTask.frequency?.finalizedAt ?? null,
          },
        };
      }
    } else if (updatedTask.taskType === 'frequent' && (!updatedTask.frequency || !updatedTask.frequency.enabled)) {
      hasChanges = true;
      return {
        ...updatedTask,
        frequency: {
          enabled: true,
          daysOfWeek: updatedTask.frequency?.daysOfWeek || ['Mon', 'Wed', 'Fri'],
          repeatTime: updatedTask.frequency?.repeatTime || '09:00',
          addToStopwatch: updatedTask.frequency?.addToStopwatch ?? true,
          stopwatchTargetMinutes: updatedTask.intendedTimeMinutes || 30,
          isFinalized: updatedTask.frequency?.isFinalized ?? false,
          finalizedAt: updatedTask.frequency?.finalizedAt ?? null,
        },
      };
    } else if (updatedTask.taskType === 'regular' && updatedTask.frequency && !updatedTask.frequency.enabled) {
      hasChanges = true;
      return {
        ...updatedTask,
        frequency: undefined,
      };
    }
    return updatedTask;
  });

  return { sanitized, hasChanges };
}

export function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TASKS);
    if (!raw) return [];
    const parsed: Task[] = JSON.parse(raw);
    const { sanitized, hasChanges } = sanitizeTasks(parsed);

    const rawPeople = localStorage.getItem(STORAGE_KEYS.PEOPLE);
    let finalTasks = sanitized;
    let peopleChanged = false;
    if (rawPeople) {
      const parsedPeople: Person[] = JSON.parse(rawPeople);
      const { idMap } = sanitizePeople(parsedPeople);
      const { sanitizedTasks, tasksChanged } = remapTasksPeopleIds(sanitized, idMap);
      finalTasks = sanitizedTasks;
      peopleChanged = tasksChanged;
    }

    if (hasChanges || peopleChanged) {
      saveTasks(finalTasks);
    }
    return finalTasks;
  } catch {
    return [];
  }
}

export function saveTasks(tasks: Task[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
  } catch (e) {
    console.error('Failed to save tasks to localStorage', e);
  }
}

export function remapTasksPeopleIds(
  tasks: Task[],
  idMap: Record<string, string>
): { sanitizedTasks: Task[]; tasksChanged: boolean } {
  if (!idMap || Object.keys(idMap).length === 0) {
    return { sanitizedTasks: tasks, tasksChanged: false };
  }

  let tasksChanged = false;
  const sanitizedTasks = tasks.map((t) => {
    if (!t.involvedPeopleIds || t.involvedPeopleIds.length === 0) return t;
    const remapped = Array.from(
      new Set(t.involvedPeopleIds.map((id) => idMap[id] || id))
    );
    const hasDiff =
      remapped.length !== t.involvedPeopleIds.length ||
      remapped.some((id, idx) => id !== t.involvedPeopleIds[idx]);
    if (hasDiff) {
      tasksChanged = true;
      return { ...t, involvedPeopleIds: remapped };
    }
    return t;
  });

  return { sanitizedTasks, tasksChanged };
}

export function sanitizePeople(
  people: Person[],
  tasks?: Task[]
): {
  sanitizedPeople: Person[];
  sanitizedTasks?: Task[];
  idMap: Record<string, string>;
  hasChanges: boolean;
} {
  if (!people || people.length === 0) {
    return {
      sanitizedPeople: [],
      sanitizedTasks: tasks,
      idMap: {},
      hasChanges: false,
    };
  }

  const idMap: Record<string, string> = {};
  const clusters: Person[][] = [];

  const isMatch = (p1: Person, p2: Person): boolean => {
    const keys1 = [
      p1.name.trim().toLowerCase(),
      ...(p1.aliases || []).map((a) => a.trim().toLowerCase()),
    ].filter(Boolean);
    const keys2 = [
      p2.name.trim().toLowerCase(),
      ...(p2.aliases || []).map((a) => a.trim().toLowerCase()),
    ].filter(Boolean);

    return keys1.some((k1) => keys2.includes(k1));
  };

  people.forEach((p) => {
    let placed = false;
    for (const cluster of clusters) {
      if (cluster.some((member) => isMatch(member, p))) {
        cluster.push(p);
        placed = true;
        break;
      }
    }
    if (!placed) {
      clusters.push([p]);
    }
  });

  let hasChanges = false;
  const sanitizedPeople: Person[] = [];

  clusters.forEach((cluster) => {
    if (cluster.length === 1) {
      sanitizedPeople.push(cluster[0]);
      return;
    }

    hasChanges = true;
    cluster.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    const canonical = { ...cluster[0] };

    cluster.slice(1).forEach((dup) => {
      idMap[dup.id] = canonical.id;
    });

    const rawNoteLines: string[] = [];
    cluster.forEach((p) => {
      if (p.notes) {
        p.notes.split(/\r?\n/).forEach((line) => {
          const clean = line.replace(/^[•\-\*]\s*/, '').trim();
          if (clean) rawNoteLines.push(clean);
        });
      }
    });

    const uniqueLines: string[] = [];
    const seenLower = new Set<string>();
    rawNoteLines.forEach((line) => {
      const lower = line.toLowerCase();
      if (!seenLower.has(lower)) {
        seenLower.add(lower);
        uniqueLines.push(line);
      }
    });

    canonical.notes =
      uniqueLines.length > 1
        ? uniqueLines.map((l) => `• ${l}`).join('\n')
        : uniqueLines[0] || '';

    const allAliasesSet = new Set<string>();
    const canonicalLowerName = canonical.name.trim().toLowerCase();
    cluster.forEach((p) => {
      if (p.name.trim().toLowerCase() !== canonicalLowerName) {
        allAliasesSet.add(p.name.trim());
      }
      (p.aliases || []).forEach((a) => {
        if (a.trim().toLowerCase() !== canonicalLowerName) {
          allAliasesSet.add(a.trim());
        }
      });
    });
    canonical.aliases = Array.from(allAliasesSet);

    if (
      !canonical.roleOrRelation ||
      ['contact', 'other'].includes(canonical.roleOrRelation.toLowerCase())
    ) {
      const betterRole = cluster.find(
        (p) =>
          p.roleOrRelation &&
          !['contact', 'other'].includes(p.roleOrRelation.toLowerCase())
      );
      if (betterRole) canonical.roleOrRelation = betterRole.roleOrRelation;
    }

    if (!canonical.email) {
      const e = cluster.find((p) => p.email)?.email;
      if (e) canonical.email = e;
    }
    if (!canonical.phone) {
      const ph = cluster.find((p) => p.phone)?.phone;
      if (ph) canonical.phone = ph;
    }

    sanitizedPeople.push(canonical);
  });

  let sanitizedTasks = tasks;
  let tasksChanged = false;
  if (tasks && tasks.length > 0) {
    const remappedResult = remapTasksPeopleIds(tasks, idMap);
    sanitizedTasks = remappedResult.sanitizedTasks;
    tasksChanged = remappedResult.tasksChanged;
  }

  return {
    sanitizedPeople,
    sanitizedTasks,
    idMap,
    hasChanges: hasChanges || tasksChanged,
  };
}

export function loadPeople(): Person[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PEOPLE);
    if (!raw) return [];
    const parsed: Person[] = JSON.parse(raw);
    const { sanitizedPeople, idMap, hasChanges } = sanitizePeople(parsed);
    if (hasChanges) {
      savePeople(sanitizedPeople);
      const rawTasks = localStorage.getItem(STORAGE_KEYS.TASKS);
      if (rawTasks) {
        const parsedTasks: Task[] = JSON.parse(rawTasks);
        const { sanitizedTasks, tasksChanged } = remapTasksPeopleIds(parsedTasks, idMap);
        if (tasksChanged) {
          saveTasks(sanitizedTasks);
        }
      }
    }
    return sanitizedPeople;
  } catch {
    return [];
  }
}

export function savePeople(people: Person[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.PEOPLE, JSON.stringify(people));
  } catch (e) {
    console.error('Failed to save people to localStorage', e);
  }
}

export function loadChatMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CHAT);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Error loading chat messages', e);
  }

  // Default initial message when app launches clean
  return [
    {
      id: 'init-msg-1',
      role: 'assistant',
      content: 'Hello! I am Violet, your AI Productivity & Task Assistant. How can I help you today with your tasks, goals, collaborators, or schedule?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      refiningQuestion: 'What task or project would you like to plan today?',
    },
  ];
}

export function saveChatMessages(messages: ChatMessage[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.CHAT, JSON.stringify(messages));
  } catch (e) {
    console.error('Failed to save chat messages to localStorage', e);
  }
}

export function loadNotifications(): SystemNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveNotifications(notifications: SystemNotification[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
  } catch (e) {
    console.error('Failed to save notifications', e);
  }
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return raw ? JSON.parse(raw) : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: AppSettings) {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings', e);
  }
}

/**
 * Recalculate dynamic urgency based on current date vs task creation or due date
 */
export function calculateDynamicUrgency(task: Task, referenceTimeMs?: number): UrgencyLevel {
  if (!task.dueDateTime) {
    if (task.urgency === 'ASAP') return 'Urgent';
    if (task.urgency === 'None-Low') return 'Low';
    return task.urgency || 'Low';
  }

  const now = referenceTimeMs || new Date().getTime();
  const rawStr = task.dueDateTime.trim();
  let due: number;

  if (/^\d{4}-\d{2}-\d{2}$/.test(rawStr)) {
    // YYYY-MM-DD format (date only): treat as end of day (23:59:59.999) in local browser time
    const [year, month, day] = rawStr.split('-').map(Number);
    due = new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(rawStr)) {
    // YYYY-MM-DDTHH:mm format without offset: parse in local browser time
    const [datePart, timePart] = rawStr.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);
    due = new Date(year, month - 1, day, hours, minutes, 0, 0).getTime();
  } else {
    // Standard ISO string with timezone or general date string
    due = new Date(rawStr).getTime();
  }

  if (isNaN(due)) {
    if (task.urgency === 'ASAP') return 'Urgent';
    if (task.urgency === 'None-Low') return 'Low';
    return task.urgency || 'Low';
  }

  const diffMs = due - now;
  const hoursLeft = diffMs / (1000 * 60 * 60);

  if (hoursLeft < 0) {
    return 'Past Due';
  } else if (hoursLeft <= 24) {
    return 'Urgent';
  } else if (hoursLeft <= 24 * 7) {
    return 'Medium';
  } else {
    return 'Low';
  }
}

// Generate color palette for newly created people profiles
export function getRandomAvatarColor(): string {
  const colors = [
    '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', 
    '#EC4899', '#6366F1', '#14B8A6', '#F97316'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Calculate dynamic elapsed seconds based on start timestamp delta
 */
export function getTimerElapsedSeconds(timer: ActiveTimerState, nowMs = Date.now()): number {
  if (timer.isRunning && timer.startTimeMs) {
    const deltaSecs = Math.floor((nowMs - timer.startTimeMs) / 1000);
    const total = timer.accumulatedSeconds + Math.max(0, deltaSecs);
    return timer.targetSeconds > 0 ? Math.min(timer.targetSeconds, total) : total;
  }
  return timer.accumulatedSeconds;
}

export function loadStopwatchTimers(): Record<string, ActiveTimerState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STOPWATCH_TIMERS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveStopwatchTimers(timers: Record<string, ActiveTimerState>) {
  try {
    localStorage.setItem(STORAGE_KEYS.STOPWATCH_TIMERS, JSON.stringify(timers));
  } catch (e) {
    console.error('Failed to save stopwatch timers', e);
  }
}

/**
 * Sound completion chime using Web Audio API synthesis
 */
export function playCompletionChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Harmonious 3-step completion chime (E5, G5, C6)
    [659.25, 783.99, 1046.50].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0.18, now + idx * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.15);
      osc.stop(now + idx * 0.15 + 0.4);
    });
  } catch (e) {
    console.error('Audio play error:', e);
  }
}

