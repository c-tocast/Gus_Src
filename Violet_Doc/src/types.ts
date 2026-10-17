export type UrgencyLevel = 'Low' | 'Medium' | 'Urgent' | 'Past Due' | 'ASAP' | 'None-Low';

export type EnvironmentalCategory =
  | 'Work'
  | 'College/School'
  | 'Self Growth'
  | 'Home & Family'
  | 'Health & Fitness'
  | 'Finance'
  | 'Social & Relationships'
  | 'Creative'
  | 'Errands & Admin'
  | 'Side Project'
  | 'Travel & Leisure'
  | 'Hobbies & Leisure';

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export interface TaskFrequency {
  enabled: boolean;
  daysOfWeek: DayOfWeek[];
  repeatTime: string; // e.g. "09:00"
  addToStopwatch: boolean;
  stopwatchTargetMinutes?: number;
  isFinalized?: boolean; // When fully completed, routine will no longer recur
  finalizedAt?: string | null;
}

export interface TaskReminder {
  id: string;
  label: string;
  triggerTime: string; // ISO string or human formatted
  type: 'in_app' | 'notification';
  sent: boolean;
}

export interface NoteItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  taskType?: 'regular' | 'frequent'; // Distinction between regular tasks and non-stop frequent activities
  completed: boolean;
  completedAt?: string | null;
  completionHistory?: string[]; // Array of ISO YYYY-MM-DD date strings when marked completed for that day
  moodEmoji?: string; // Emotional mood emoji for frequent tasks (e.g. 😊, 🔥, 🧘, 💪, ⚡, 🎯, 🌱, ❤️)
  urgency: UrgencyLevel;
  createdAt: string; // ISO date
  dueDateTime: string | null;
  emotionalKeywords: string[]; // e.g. ["Exciting", "High Focus", "Routine"]
  environmentalCategory: EnvironmentalCategory;
  intendedTimeMinutes: number; // Planned duration
  actualTimeMinutes: number; // Actual spent time
  notesBullets: NoteItem[]; // Bulleted instructions, warnings, checkable notes
  involvedPeopleIds: string[]; // Person IDs
  followUpFrequency: 'auto' | 'hourly' | 'daily' | 'weekly' | 'none';
  notificationsEnabled: boolean; // Individual task notification toggle
  reminders: TaskReminder[];
  completedPastDue?: boolean; // Flag if task was completed after its due date
  archivedDueDateTime?: string | null; // Archived deadline when converted to frequent activity
  archivedUrgency?: UrgencyLevel; // Archived urgency level when converted to frequent activity
  frequency?: TaskFrequency;
}

export interface Person {
  id: string;
  name: string;
  roleOrRelation: string;
  avatarColor: string;
  email?: string;
  phone?: string;
  notes: string;
  aliases?: string[];
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isOffTopic?: boolean;
  suggestedRephrase?: string | null;
  refiningQuestion?: string | null;
  extractedTaskIds?: string[];
  updatedTaskIds?: string[];
  extractedPeopleIds?: string[];
  isSafetyAlert?: boolean;
  isError?: boolean;
  errorCode?: string;
  errorDetails?: string;
  isHighDemandFallback?: boolean;
  retryPrompt?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  messages: ChatMessage[];
}

export interface SystemNotification {
  id: string;
  taskId?: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'task_reminder' | 'follow_up' | 'system';
}

export interface AppSettings {
  globalNotificationsEnabled: boolean;
  autoFollowUpsEnabled: boolean;
  safetyHelplineBannerEnabled: boolean;
  userName: string;
  notificationStyle: 'android_shade' | 'heads_up' | 'in_app_only';
  notificationFrequency: 'adaptive' | 'regular' | 'silent';
}

export interface DuplicateTaskPair {
  type: 'task';
  id: string;
  newerTask: Task;
  olderTask: Task;
  similarityReason: string;
}

export interface DuplicatePersonPair {
  type: 'person';
  id: string;
  newerPerson: Person;
  olderPerson: Person;
  similarityReason: string;
}

export interface DuplicateTagPair {
  type: 'tag';
  id: string;
  tagCanonical: string; // Newer/formatted tag
  tagDuplicate: string; // Older/duplicate tag
  affectedTaskIds: string[];
  similarityReason: string;
}

export type DuplicateCandidate = DuplicateTaskPair | DuplicatePersonPair | DuplicateTagPair;

export interface AnalyticsChartDataPoint {
  [key: string]: string | number;
}

export interface AnalyticsChartSpec {
  id: string;
  title: string;
  description?: string;
  chartType: 'bar' | 'line' | 'pie' | 'area';
  xAxisKey: string;
  dataKeys: string[];
  dataset: AnalyticsChartDataPoint[];
  sampleDataset?: AnalyticsChartDataPoint[];
  summaryNote?: string;
  sqlQueryDescription?: string;
  isPinned?: boolean;
}

export interface AnalyticsChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  charts?: AnalyticsChartSpec[];
  suggestedFollowUps?: string[];
  isError?: boolean;
  errorCode?: string;
  errorDetails?: string;
  isDeterministicFallback?: boolean;
  retryPrompt?: string;
}

export interface ActiveTimerState {
  taskId: string;
  isRunning: boolean;
  startTimeMs: number | null;
  accumulatedSeconds: number;
  targetSeconds: number;
  completedInStopwatch?: boolean;
}
