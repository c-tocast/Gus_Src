import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize Gemini Client lazily or safely with process.env.GEMINI_API_KEY
const getAiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is missing.');
  }
  return new GoogleGenAI({ apiKey });
};

// Check if error is due to upstream 503 high demand or capacity spike
function isCapacityOrDemandError(err: any): boolean {
  if (!err) return false;
  const errStr = String(err?.message || err?.error || err || '').toLowerCase();
  const status = err?.status || err?.statusCode || err?.response?.status;
  return (
    status === 503 ||
    status === 429 ||
    errStr.includes('503') ||
    errStr.includes('high demand') ||
    errStr.includes('spikes in demand') ||
    errStr.includes('unavailable') ||
    errStr.includes('resource_exhausted') ||
    errStr.includes('quota') ||
    errStr.includes('rate limit') ||
    errStr.includes('overloaded')
  );
}

// Question 1: Automatic Cascade & Exponential Backoff Retries with Jitter
async function generateContentWithCascadeAndRetry(
  ai: GoogleGenAI,
  requestPayload: any,
  cascadeModels = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.1-flash-lite']
): Promise<{ response: any; modelUsed: string }> {
  let lastError: any = null;

  for (const model of cascadeModels) {
    // Up to 2 attempts per model tier with exponential backoff & jitter
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          ...requestPayload,
          model,
        });
        return { response, modelUsed: model };
      } catch (err: any) {
        lastError = err;
        console.warn(`[GeminiCascade] Model ${model} attempt ${attempt + 1} failed:`, err?.message || err);

        if (!isCapacityOrDemandError(err) || attempt === 1) {
          // Break inner loop to try next model in cascade
          break;
        }

        // Exponential backoff: 800ms, 1600ms + random jitter up to 250ms
        const delay = 800 * Math.pow(2, attempt) + Math.floor(Math.random() * 250);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// Approach 1B: Heuristic Fallback Extractor when AI models are unavailable
function extractFallbackTaskFromPrompt(
  promptText: string,
  userTasks: any[] = [],
  userPeople: any[] = []
) {
  const pLower = (promptText || '').toLowerCase();

  // 1. Urgency Detection
  let urgency: 'ASAP' | 'Urgent' | 'Medium' | 'Low' = 'Medium';
  if (/asap|immediately|right now|urgent|critical|emergency/.test(pLower)) {
    urgency = 'ASAP';
  } else if (/today|tomorrow|this week|soon|tonight/.test(pLower)) {
    urgency = 'Urgent';
  } else if (/low priority|someday|eventually|whenever|no rush/.test(pLower)) {
    urgency = 'Low';
  }

  // 2. Environmental Category Detection
  let environmentalCategory = 'Work';
  if (/gym|workout|run|health|fitness|doctor|medicine|stretch|walk|diet|water/.test(pLower)) {
    environmentalCategory = 'Health & Fitness';
  } else if (/money|bill|bank|pay|tax|budget|invest|crypto|salary|finance/.test(pLower)) {
    environmentalCategory = 'Finance';
  } else if (/clean|groceries|laundry|cook|dinner|home|mom|dad|family|house/.test(pLower)) {
    environmentalCategory = 'Home & Family';
  } else if (/class|study|exam|homework|quiz|college|lecture|school|course/.test(pLower)) {
    environmentalCategory = 'College/School';
  } else if (/book|read|meditate|journal|grow|mindset|habits|learn/.test(pLower)) {
    environmentalCategory = 'Self Growth';
  } else if (/code|app|project|build|prototype|repo|side project/.test(pLower)) {
    environmentalCategory = 'Side Project';
  }

  // 3. Frequency & Routine Detection
  let frequency: any = null;
  const days: string[] = [];
  if (/daily|every\s*day|everyday/.test(pLower)) {
    days.push('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun');
  } else {
    if (/weekday|weekdays/.test(pLower)) days.push('Mon', 'Tue', 'Wed', 'Thu', 'Fri');
    if (/weekend|weekends/.test(pLower)) days.push('Sat', 'Sun');
    if (/mon(day)?s?/.test(pLower)) days.push('Mon');
    if (/tue(sday)?s?|tues/.test(pLower)) days.push('Tue');
    if (/wed(nesday)?s?/.test(pLower)) days.push('Wed');
    if (/thu(rsday)?s?|thurs/.test(pLower)) days.push('Thu');
    if (/fri(day)?s?/.test(pLower)) days.push('Fri');
    if (/sat(urday)?s?/.test(pLower)) days.push('Sat');
    if (/sun(day)?s?/.test(pLower)) days.push('Sun');
  }

  if (days.length > 0) {
    let repeatTime = '09:00';
    const timeMatch = pLower.match(/at\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    if (timeMatch) {
      let hour = parseInt(timeMatch[1], 10);
      const mins = timeMatch[2] ? timeMatch[2] : '00';
      const ampm = timeMatch[3];
      if (ampm === 'pm' && hour < 12) hour += 12;
      if (ampm === 'am' && hour === 12) hour = 0;
      repeatTime = `${hour.toString().padStart(2, '0')}:${mins}`;
    }

    frequency = {
      enabled: true,
      daysOfWeek: Array.from(new Set(days)),
      repeatTime,
      addToStopwatch: true,
      stopwatchTargetMinutes: 30,
    };
  }

  // 4. Match People Mentions
  const matchedPeopleNames: string[] = [];
  if (Array.isArray(userPeople)) {
    userPeople.forEach((p) => {
      if (p && p.name && pLower.includes(p.name.trim().toLowerCase())) {
        matchedPeopleNames.push(p.name);
      }
    });
  }

  // 5. Clean Title
  let title = promptText
    .replace(/^(please\s+|can you\s+|help me\s+|i need to\s+|i have to\s+|violet,?\s*)/i, '')
    .trim();
  if (title.length > 70) {
    title = title.slice(0, 70) + '...';
  }
  if (!title) title = 'Quick Action Item';

  const isFrequent = Boolean(frequency && frequency.enabled);

  return {
    isOffTopic: false,
    isSafetyAlert: false,
    isHighDemandFallback: true,
    replyText: `I've safely saved "${title}". AI servers are currently handling peak traffic, so I utilized our offline safeguard extractor to ensure your records remain intact.`,
    suggestedRephrase: null,
    refiningQuestion: 'Would you like to refine the deadline or assign this to someone?',
    extractedTasks: [
      {
        action: 'create',
        existingTaskId: null,
        title: title.charAt(0).toUpperCase() + title.slice(1),
        taskType: isFrequent ? 'frequent' : 'regular',
        moodEmoji: isFrequent ? '⚡' : null,
        urgency: isFrequent ? 'Low' : urgency,
        emotionalCategory: ['SafeCapture', isFrequent ? 'Routine' : 'Action'],
        environmentalCategory,
        intendedTimeMinutes: 30,
        actualTimeMinutes: null,
        notesBullets: [`Saved via offline safeguard during high demand: "${promptText}"`],
        involvedPeopleNames: matchedPeopleNames,
        followUpFrequency: 'auto',
        dueDateTime: null,
        completed: false,
        reminders: [],
        frequency,
      },
    ],
    extractedPeople: [],
  };
}

// Approach 2A & Question 3: Strict Schema Normalizer & Non-Destructive Partial Patch Policy
function sanitizeAndNormalizeExtractedTasks(
  extractedTasks: any[],
  userTasks: any[] = []
): any[] {
  if (!Array.isArray(extractedTasks)) return [];

  const existingTaskMap = new Map<string, any>();
  if (Array.isArray(userTasks)) {
    userTasks.forEach((t) => {
      if (t && t.id) existingTaskMap.set(t.id, t);
    });
  }

  const validCategories = new Set([
    'Work', 'College/School', 'Self Growth', 'Home & Family',
    'Health & Fitness', 'Finance', 'Social & Relationships',
    'Creative', 'Errands & Admin', 'Side Project', 'Travel & Leisure', 'Hobbies & Leisure'
  ]);

  return extractedTasks.map((t: any) => {
    const isUpdate = t.action === 'update' && t.existingTaskId && existingTaskMap.has(t.existingTaskId);
    const existing = isUpdate ? existingTaskMap.get(t.existingTaskId) : null;

    // Strict taskType enforcement
    const hasFreq = Boolean(t.frequency && t.frequency.enabled);
    const taskType = hasFreq ? 'frequent' : (t.taskType === 'frequent' ? 'frequent' : 'regular');

    // Strict Urgency enforcement
    let urgency = t.urgency || (existing ? existing.urgency : 'Medium');
    if (taskType === 'frequent') {
      urgency = 'Low';
    }

    // Strict Category validation
    let environmentalCategory = t.environmentalCategory;
    if (!environmentalCategory || !validCategories.has(environmentalCategory)) {
      environmentalCategory = existing ? existing.environmentalCategory : 'Work';
    }

    // Non-destructive preservation of legacy fields
    const completionHistory = existing ? (existing.completionHistory || []) : [];
    const stopwatchLogs = existing ? (existing.stopwatchLogs || []) : [];
    const completedPastDue = existing ? existing.completedPastDue : false;
    const moodEmoji = t.moodEmoji || (existing ? existing.moodEmoji : null);
    const existingFreq = existing ? existing.frequency : undefined;
    const mergedFrequency = t.frequency || existingFreq;
    const isCompleted = typeof t.completed === 'boolean' ? t.completed : (existing ? existing.completed : false);

    if (mergedFrequency && taskType === 'frequent') {
      if (isCompleted && mergedFrequency.isFinalized === undefined) {
        mergedFrequency.isFinalized = true;
      }
    }

    return {
      ...t,
      action: isUpdate ? 'update' : 'create',
      existingTaskId: isUpdate ? t.existingTaskId : null,
      title: t.title || (existing ? existing.title : 'Untitled Task'),
      taskType,
      urgency,
      environmentalCategory,
      moodEmoji,
      intendedTimeMinutes: Number(t.intendedTimeMinutes) || (existing ? existing.intendedTimeMinutes : 30),
      actualTimeMinutes: t.actualTimeMinutes !== null && t.actualTimeMinutes !== undefined
        ? Number(t.actualTimeMinutes)
        : (existing ? existing.actualTimeMinutes : null),
      notesBullets: Array.isArray(t.notesBullets) ? t.notesBullets : (existing ? existing.notesBullets : []),
      involvedPeopleNames: Array.isArray(t.involvedPeopleNames) ? t.involvedPeopleNames : [],
      dueDateTime: taskType === 'frequent' ? null : (t.dueDateTime !== undefined ? t.dueDateTime : (existing ? existing.dueDateTime : null)),
      completed: isCompleted,
      frequency: mergedFrequency,
      completionHistory,
      stopwatchLogs,
      completedPastDue,
    };
  });
}

// API Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// AI Chat Endpoint with Task, People, and Categorization Extraction
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, userTasks = [], userPeople = [] } = req.body;
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required.' });
    }

    const ai = getAiClient();
    const currentDateStr = new Date().toISOString().split('T')[0];

    const systemPrompt = `You are Violet, an expert AI Task Intelligence & Productivity Assistant.
Current Date: ${currentDateStr}

YOUR GOALS & RULES:
1. CRITICAL SAFETY PROTOCOL FOR SELF-HARM & OTHERS' PROTECTION:
   - If the user's message expresses thoughts of self-harm, suicide, severe emotional distress, or harm to others:
     * Set "isSafetyAlert": true
     * Set "isOffTopic": false
     * Set "replyText": A compassionate, non-judgmental response that revalidates the user's feelings, gently explains that Violet is an AI assistant and not an emergency or crisis channel, and encourages reaching out to professional help or a crisis hotline immediately.
     * DO NOT mention any tasks, work, schedules, or people profiles.
     * Set "refiningQuestion": null
     * Set "extractedTasks": [], "extractedPeople": []
2. Help the user organize, clarify, and plan their tasks, schedules, reminders, and people connections.
3. STRICT GUARDRAIL ON TOPIC: If the user message is completely unrelated to tasks, productivity, scheduling, personal goals, work, school, or self-improvement (and not a safety crisis):
   - Set "isOffTopic": true.
   - Reply with a standard polite message: "I'm Violet, your task & productivity assistant. I can only help with task planning, scheduling, reminders, and goal management."
   - Provide a "suggestedRephrase": A suggestion on how the user could rephrase or adapt their prompt into a task or productivity goal.
4. CRITICAL TASK VALIDATION & DEDUPLICATION PROCESS:
   - Before extracting any new task, review ALL items in "Existing Tasks Context".
   - Check if the user is referring to, updating, extending, changing dates for, or adding details to ANY existing task already on file (even if created in a different chat session or earlier in conversation).
   - If the user's message pertains to or overlaps with an existing task:
     * Set "action": "update"
     * Set "existingTaskId": "<id_of_the_matched_existing_task>"
     * Provide updated or merged details (e.g. updated title, modified urgency, new bullet notes, due date, completed status).
   - If NO existing task matches or pertains to the user's request:
     * Set "action": "create"
     * Set "existingTaskId": null
5. PEOPLE PROFILE MATCHING & ALIAS VALIDATION:
   - When extracting or updating people in "extractedPeople", review "Existing People Context".
   - Match existing profile names or nicknames/aliases strictly WITHOUT considering capitalization (e.g., "Sarah", "sarah", "SARAH", or alias "Sare" all match the profile for Sarah).
   - Automatically append new details to the existing profile instead of creating duplicates.
   - ENSURE PROFILE NOTES ARE NOT REPEATED: Only add new, non-redundant information to profile notes.
7. AUTOMATIC FREQUENCY & STOPWATCH ASSIGNMENT & TYPE ENFORCEMENT:
   - Whenever the user explicitly mentions a repeating schedule or frequency for a task (e.g., 'every monday', 'every weekday at 9am', 'daily', 'tuesdays and thursdays', 'every Mon, Wed, Fri', 'every week on Fridays'):
     * You MUST populate the "frequency" object in the extracted or updated task:
       {
         "enabled": true,
         "daysOfWeek": Array of DayOfWeek ["Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun"].
           - "daily" or "everyday" -> ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
           - "every weekday" or "weekdays" -> ["Mon", "Tue", "Wed", "Thu", "Fri"]
           - "weekends" -> ["Sat", "Sun"]
           - "every monday" -> ["Mon"]
           - "tuesdays and thursdays" -> ["Tue", "Thu"]
           - Map any mentioned day names or abbreviations to ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
         "repeatTime": String in 24-hour "HH:mm" format (e.g. "09:00", "14:30"; default to "09:00" if no specific time was mentioned).
         "addToStopwatch": true (MUST be true whenever frequency is mentioned/enabled),
         "stopwatchTargetMinutes": number (intended duration in minutes, matching intendedTimeMinutes)
       }
     * STRICT ENFORCEMENT: Whenever frequency is set (enabled: true), set "taskType": "frequent", "dueDateTime": null, "urgency": "Low".
     * If NO frequency or repeating schedule is mentioned, set "frequency": null.
8. DISTINCTION BETWEEN FREQUENT ACTIVITIES AND REGULAR TASKS:
   - "frequent" activity: Non-stop recurring habit, routine, or activity with frequency subcategory tag.
     * Has taskType: "frequent"
     * Must have frequency object with enabled: true.
     * NO due date (dueDateTime: null) and NO urgency tag (set urgency: "Low")
     * Categorized strictly by emotional mood ("moodEmoji": e.g. "😊", "🔥", "🧘", "💪", "⚡", "🎯", "🌱", "❤️") and keywords ("emotionalCategory": array of tag strings)
     * Stays active indefinitely until removed by user.
   - "regular" task: Discrete item with or without a due date/deadline.
     * Has taskType: "regular"
     * MUST have frequency: null
     * Has urgency: "ASAP" | "Urgent" | "Medium" | "None-Low"
     * May have dueDateTime.

9. IF RELEVANT (isOffTopic: false, isSafetyAlert: false):
   - Respond helpfully, warmly, and concisely as Violet.
   - ALWAYS include 1 concise follow-up refining question ("refiningQuestion") to refine task details.
   - Return any extracted or updated actionable tasks in "extractedTasks":
     * action: "create" | "update"
     * existingTaskId: string | null
     * title: string
     * taskType: "regular" | "frequent"
     * moodEmoji: string | null (e.g. "😊", "🔥", "🧘", "💪", "⚡", "🎯", "🌱", "❤️")
     * urgency: "ASAP" (within 24 hours) | "Urgent" (within 7 days) | "Medium" (within 1 month) | "None-Low" (within 3 months)
     * emotionalCategory: string[] (keywords describing feeling/vibe/tags)
     * environmentalCategory: "Work" | "College/School" | "Self Growth" | "Home & Family" | "Health & Fitness" | "Finance" | "Social & Relationships" | "Creative" | "Errands & Admin" | "Side Project" | "Travel & Leisure" | "Hobbies & Leisure"
     * intendedTimeMinutes: number
     * actualTimeMinutes: number | null
     * notesBullets: string[] (bullet points for instructions, warnings, key details)
     * involvedPeopleNames: string[]
     * followUpFrequency: "auto" | "hourly" | "daily" | "weekly" | "none"
     * dueDateTime: string | null
     * completed: boolean
     * reminders: array of { label: string, triggerTime: string, type: "in_app" | "notification" }
     * frequency: { enabled: boolean, daysOfWeek: string[], repeatTime: string, addToStopwatch: boolean, stopwatchTargetMinutes: number } | null
   - EXTRACT or UPDATE involved people in "extractedPeople":
     * name: string
     * roleOrRelation: string
     * notes: string (only unique non-repeated information)
     * aliases: string[] (any alternative names or nicknames mentioned)
     * tasksCount: number

Existing Tasks Context: ${JSON.stringify(userTasks.slice(-30))}
Existing People Context: ${JSON.stringify(userPeople.slice(-30))}

Return JSON matching this exact JSON schema:
{
  "isOffTopic": boolean,
  "isSafetyAlert": boolean,
  "replyText": string,
  "suggestedRephrase": string | null,
  "refiningQuestion": string | null,
  "extractedTasks": Array<{
    "action": "create" | "update",
    "existingTaskId": string | null,
    "title": string,
    "taskType": "regular" | "frequent",
    "moodEmoji": string | null,
    "urgency": string,
    "emotionalCategory": Array<string>,
    "environmentalCategory": string,
    "intendedTimeMinutes": number,
    "actualTimeMinutes": number | null,
    "notesBullets": Array<string>,
    "involvedPeopleNames": Array<string>,
    "followUpFrequency": string,
    "dueDateTime": string | null,
    "completed": boolean,
    "reminders": Array<object>,
    "frequency": {
      "enabled": boolean,
      "daysOfWeek": Array<string>,
      "repeatTime": string,
      "addToStopwatch": boolean,
      "stopwatchTargetMinutes": number
    } | null
  }>,
  "extractedPeople": Array<object>
}`;

    const userMessageHistory = messages.map((m: { role: string; content: string }) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n');

    let responseText = '{}';
    let cascadeError: any = null;

    try {
      const { response } = await generateContentWithCascadeAndRetry(ai, {
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `${systemPrompt}\n\nCONVERSATION HISTORY:\n${userMessageHistory}\n\nLATEST USER MESSAGE:\n${
                  messages[messages.length - 1].content
                }`,
              },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });
      responseText = response.text || '{}';
    } catch (err: any) {
      cascadeError = err;
      console.warn('[GeminiCascade] All models failed in cascade:', err?.message || err);
    }

    // Approach 1B: If models are unavailable due to 503 high demand or capacity, execute safe heuristic fallback
    if (cascadeError) {
      if (isCapacityOrDemandError(cascadeError)) {
        console.log('[GeminiCascade] Activating Approach 1B Heuristic Fallback Extractor');
        const latestContent = messages[messages.length - 1]?.content || '';
        const fallbackResult = extractFallbackTaskFromPrompt(latestContent, userTasks, userPeople);
        fallbackResult.extractedTasks = sanitizeAndNormalizeExtractedTasks(fallbackResult.extractedTasks, userTasks);
        return res.json(fallbackResult);
      }
      throw cascadeError;
    }

    let parsedData: any;
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      parsedData = {
        isOffTopic: false,
        replyText: responseText,
        suggestedRephrase: null,
        refiningQuestion: "Would you like me to set a specific deadline or reminder for this task?",
        extractedTasks: [],
        extractedPeople: []
      };
    }

    // Option 2B: Strict Server-Side ID Resolution
    if (parsedData && Array.isArray(userPeople)) {
      const peopleMapByName = new Map<string, string>();
      userPeople.forEach((p: any) => {
        if (p && p.id && p.name) {
          peopleMapByName.set(p.name.trim().toLowerCase(), p.id);
          if (Array.isArray(p.aliases)) {
            p.aliases.forEach((a: string) => {
              if (a) peopleMapByName.set(a.trim().toLowerCase(), p.id);
            });
          }
        }
      });

      if (Array.isArray(parsedData.extractedPeople)) {
        parsedData.extractedPeople.forEach((extP: any) => {
          if (extP && extP.name) {
            const cleanName = extP.name.trim().toLowerCase();
            const matchedId = extP.existingPersonId || peopleMapByName.get(cleanName);
            if (matchedId) {
              extP.existingPersonId = matchedId;
            }
          }
        });
      }

      if (Array.isArray(parsedData.extractedTasks)) {
        parsedData.extractedTasks.forEach((extT: any) => {
          if (extT) {
            const resolvedIds = new Set<string>(extT.involvedPeopleIds || []);
            if (Array.isArray(extT.involvedPeopleNames)) {
              extT.involvedPeopleNames.forEach((name: string) => {
                if (!name) return;
                const cleanName = name.trim().toLowerCase();
                const matchedId = peopleMapByName.get(cleanName);
                if (matchedId) {
                  resolvedIds.add(matchedId);
                } else if (Array.isArray(parsedData.extractedPeople)) {
                  const newlyExtracted = parsedData.extractedPeople.find(
                    (p: any) => p && p.name && p.name.trim().toLowerCase() === cleanName
                  );
                  if (newlyExtracted && newlyExtracted.existingPersonId) {
                    resolvedIds.add(newlyExtracted.existingPersonId);
                  }
                }
              });
            }
            extT.involvedPeopleIds = Array.from(resolvedIds);
          }
        });
      }
    }

    // Approach 2A & Question 3: Enforce strict schema normalization & non-destructive preservation
    if (parsedData && Array.isArray(parsedData.extractedTasks)) {
      parsedData.extractedTasks = sanitizeAndNormalizeExtractedTasks(
        parsedData.extractedTasks,
        userTasks
      );
    }

    return res.json(parsedData);
  } catch (error: any) {
    console.error('Error in /api/chat:', error);
    const errStr = String(error?.message || error || '').toLowerCase();
    const status = error?.status || error?.statusCode || error?.response?.status;
    let errorCode = 'ERR_HTTP_500';

    if (
      status === 503 ||
      errStr.includes('503') ||
      errStr.includes('high demand') ||
      errStr.includes('spikes in demand') ||
      errStr.includes('unavailable')
    ) {
      errorCode = 'ERR_MODEL_HIGH_DEMAND';
    } else if (status === 429 || errStr.includes('quota') || errStr.includes('resource_exhausted') || errStr.includes('exceeded') || errStr.includes('rate limit')) {
      errorCode = 'ERR_QUOTA_EXCEEDED';
    } else if (status) {
      errorCode = `ERR_HTTP_${status}`;
    } else if (errStr.includes('api_key') || errStr.includes('api key')) {
      errorCode = 'ERR_API_KEY_MISSING';
    } else if (errStr.includes('unhandled workflow') || errStr.includes('unsupported')) {
      errorCode = 'ERR_UNHANDLED_WORKFLOW';
    }

    return res.status(status && typeof status === 'number' && status >= 400 && status < 600 ? status : 500).json({
      isError: true,
      replyText: 'Oops, something happened :C',
      errorCode,
      errorDetails: error?.message || 'Error occurred during processing.',
    });
  }
});

// Dedicated Analytics AI Persona ("Prism") Endpoint (Approach A & 3A)
app.post('/api/analytics-chat', async (req, res) => {
  try {
    const { prompt, tasks = [], people = [], timers = {}, history = [] } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        isError: true,
        replyText: 'Oops, something happened :C',
        errorCode: 'ERR_HTTP_400',
        errorDetails: 'A valid text prompt is required.',
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        isError: true,
        replyText: 'Oops, something happened :C',
        errorCode: 'ERR_API_KEY_MISSING',
        errorDetails: 'GEMINI_API_KEY is not configured on the server.',
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    // Concise summary of user data passed to Gemini for SQL / aggregation logic
    const tasksSummary = Array.isArray(tasks)
      ? tasks.slice(0, 150).map((t: any) => {
          const rawTags = Array.isArray(t.emotionalKeywords) ? [...t.emotionalKeywords] : [];
          if (t.completed && !rawTags.some((k: string) => k.toLowerCase() === 'completed')) {
            rawTags.push('completed');
          }
          return {
            id: t.id,
            title: t.title,
            category: t.environmentalCategory || 'General',
            urgency: t.urgency || 'Medium',
            completed: Boolean(t.completed),
            tags: rawTags,
            completedAt: t.completedAt || null,
            intendedTimeMinutes: t.intendedTimeMinutes || 0,
            actualTimeMinutes: t.actualTimeMinutes || 0,
            daysOfWeek: t.frequency?.daysOfWeek || [],
            frequencyEnabled: Boolean(t.frequency?.enabled),
            assignedPersonId: t.assignedPersonId || null,
            hasStopwatchLog: Boolean(t.stopwatchLogs && t.stopwatchLogs.length > 0),
            createdAt: t.createdAt || null,
          };
        })
      : [];

    const peopleSummary = Array.isArray(people)
      ? people.map((p: any) => ({ id: p.id, name: p.name, role: p.roleOrRelation }))
      : [];

    const systemInstruction = `
You are "Prism", an expert Data Analytics & Insights AI Specialist for the Violet Task Planner app.
Your objective is to interpret user requests for analytics and visualize their workspace metrics using up to 3 tailored charts (Bar, Line, Pie, or Area).

Your JSON output MUST match this structure exactly:
{
  "replyText": "Concise, encouraging explanation of the data insights and what the charts depict.",
  "charts": [
    {
      "id": "chart-1",
      "title": "Clear Chart Title",
      "description": "Brief description of the chart metrics",
      "chartType": "bar" | "line" | "pie" | "area",
      "xAxisKey": "category" | "day" | "urgency" | "person" | "status" | "metric",
      "dataKeys": ["Key1", "Key2"],
      "dataset": [
        { "category": "Work", "Key1": 10, "Key2": 5 }
      ],
      "sampleDataset": [
        { "category": "Work (Sample)", "Key1": 12, "Key2": 8 },
        { "category": "Personal (Sample)", "Key1": 6, "Key2": 4 }
      ],
      "summaryNote": "Key takeaway highlight from this data",
      "sqlQueryDescription": "SELECT category, SUM(intendedTimeMinutes) AS Intended, SUM(actualTimeMinutes) AS Actual FROM tasks GROUP BY category"
    }
  ],
  "suggestedFollowUps": ["Suggestion prompt 1", "Suggestion prompt 2", "Suggestion prompt 3"]
}

RULES:
1. Generate up to 3 distinct, highly relevant charts based on the user's intent.
2. Calculate real aggregates from the provided tasks and people dataset where possible.
3. Always include a realistic "sampleDataset" for each chart so if the user has 0 or sparse data, the UI can fall back cleanly (Approach 5A).
4. Provide a realistic SQL query representation in "sqlQueryDescription" explaining how the data was grouped or calculated.
5. If the request cannot be graphed, return a clear, helpful replyText with 0 charts and suggested prompt follow-ups.
6. Output ONLY valid JSON without markdown wrapping.
`;

    const userPayloadPrompt = `
USER PROMPT: "${prompt}"

CURRENT WORKSPACE DATA:
- Total Tasks: ${tasks.length}
- Tasks Summary: ${JSON.stringify(tasksSummary)}
- People Summary: ${JSON.stringify(peopleSummary)}
- Recent Chat Context: ${JSON.stringify(history.slice(-3))}

Generate the response in JSON according to system instructions.
`;

    let responseText = '';
    let analyticsCascadeErr: any = null;

    try {
      const { response } = await generateContentWithCascadeAndRetry(ai, {
        contents: [
          { role: 'user', parts: [{ text: userPayloadPrompt }] }
        ],
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
        },
      });
      responseText = response.text || '';
    } catch (err: any) {
      analyticsCascadeErr = err;
      console.warn('[GeminiCascade Analytics] Cascade failed:', err?.message || err);
    }

    // Approach 4A & Question 2: Deterministic Analytics Fallback on Server
    if (analyticsCascadeErr && isCapacityOrDemandError(analyticsCascadeErr)) {
      console.log('[GeminiCascade Analytics] Running deterministic aggregation fallback');
      const catCountMap: Record<string, { active: number; completed: number; time: number }> = {};
      tasksSummary.forEach((t: any) => {
        const c = t.category || 'General';
        if (!catCountMap[c]) catCountMap[c] = { active: 0, completed: 0, time: 0 };
        if (t.completed) catCountMap[c].completed++;
        else catCountMap[c].active++;
        catCountMap[c].time += t.actualTimeMinutes || t.intendedTimeMinutes || 0;
      });

      const catDataset = Object.entries(catCountMap).map(([category, s]) => ({
        category,
        Active: s.active,
        Completed: s.completed,
      }));

      const urgencyCountMap: Record<string, number> = { ASAP: 0, Urgent: 0, Medium: 0, Low: 0 };
      tasksSummary.forEach((t: any) => {
        if (!t.completed) {
          const u = t.urgency || 'Medium';
          urgencyCountMap[u] = (urgencyCountMap[u] || 0) + 1;
        }
      });

      const urgencyDataset = Object.entries(urgencyCountMap).map(([urgency, count]) => ({
        urgency,
        Tasks: count,
      }));

      return res.json({
        replyText: `AI servers are currently experiencing high demand. I computed these statistical charts deterministically from your workspace (${tasksSummary.length} total tasks).`,
        isDeterministicFallback: true,
        charts: [
          {
            id: `det-chart-cat-${Date.now()}`,
            title: 'Task Distribution by Environmental Realm',
            description: 'Live active vs completed count across life domains',
            chartType: 'bar',
            xAxisKey: 'category',
            dataKeys: ['Active', 'Completed'],
            dataset: catDataset.length > 0 ? catDataset : [{ category: 'Work', Active: 1, Completed: 0 }],
            sampleDataset: [
              { category: 'Work', Active: 4, Completed: 2 },
              { category: 'Health', Active: 2, Completed: 1 },
            ],
            summaryNote: 'Calculated directly from active inventory records.',
            sqlQueryDescription: 'SELECT category, SUM(CASE WHEN completed THEN 1 ELSE 0 END) AS Completed, SUM(CASE WHEN NOT completed THEN 1 ELSE 0 END) AS Active FROM tasks GROUP BY category',
          },
          {
            id: `det-chart-urg-${Date.now()}`,
            title: 'Active Tasks Priority Breakdown',
            description: 'Task count by urgency level',
            chartType: 'bar',
            xAxisKey: 'urgency',
            dataKeys: ['Tasks'],
            dataset: urgencyDataset,
            sampleDataset: [
              { urgency: 'ASAP', Tasks: 2 },
              { urgency: 'Urgent', Tasks: 3 },
              { urgency: 'Medium', Tasks: 5 },
            ],
            summaryNote: 'Urgency distribution calculated without external API calls.',
            sqlQueryDescription: 'SELECT urgency, COUNT(*) AS Tasks FROM tasks WHERE completed = false GROUP BY urgency',
          },
        ],
        suggestedFollowUps: ['Show task distribution by category', 'Analyze focus time', 'Group tasks by urgency'],
      });
    }

    if (analyticsCascadeErr) {
      throw analyticsCascadeErr;
    }

    let parsedData: any = {};
    try {
      const cleanedText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedData = JSON.parse(cleanedText);
    } catch (parseErr) {
      console.warn('Failed to parse Gemini analytics JSON, fallback response used');
      parsedData = {
        replyText: "I analyzed your request. Here is an overview based on your tasks.",
        charts: [],
        suggestedFollowUps: ["Show task distribution by category", "Analyze focus time", "Group tasks by urgency"],
      };
    }

    // Ensure charts array is capped at 3
    if (Array.isArray(parsedData.charts)) {
      parsedData.charts = parsedData.charts.slice(0, 3).map((c: any, index: number) => ({
        id: c.id || `chart-${Date.now()}-${index}`,
        title: c.title || `Analytics Chart ${index + 1}`,
        description: c.description || '',
        chartType: ['bar', 'line', 'pie', 'area'].includes(c.chartType) ? c.chartType : 'bar',
        xAxisKey: c.xAxisKey || 'category',
        dataKeys: Array.isArray(c.dataKeys) && c.dataKeys.length > 0 ? c.dataKeys : ['value'],
        dataset: Array.isArray(c.dataset) ? c.dataset : [],
        sampleDataset: Array.isArray(c.sampleDataset) ? c.sampleDataset : [
          { category: 'Sample A', value: 10 },
          { category: 'Sample B', value: 20 },
          { category: 'Sample C', value: 15 },
        ],
        summaryNote: c.summaryNote || '',
        sqlQueryDescription: c.sqlQueryDescription || 'SELECT category, COUNT(*) FROM tasks GROUP BY category',
      }));
    } else {
      parsedData.charts = [];
    }

    return res.json(parsedData);
  } catch (error: any) {
    console.error('Error in /api/analytics-chat:', error);
    const errStr = String(error?.message || error || '').toLowerCase();
    const status = error?.status || error?.statusCode || error?.response?.status;
    let errorCode = 'ERR_HTTP_500';

    if (
      status === 503 ||
      errStr.includes('503') ||
      errStr.includes('high demand') ||
      errStr.includes('spikes in demand') ||
      errStr.includes('unavailable')
    ) {
      errorCode = 'ERR_MODEL_HIGH_DEMAND';
    } else if (status === 429 || errStr.includes('quota') || errStr.includes('resource_exhausted') || errStr.includes('exceeded') || errStr.includes('rate limit')) {
      errorCode = 'ERR_QUOTA_EXCEEDED';
    } else if (status) {
      errorCode = `ERR_HTTP_${status}`;
    } else if (errStr.includes('api_key') || errStr.includes('api key')) {
      errorCode = 'ERR_API_KEY_MISSING';
    }

    return res.status(status && typeof status === 'number' && status >= 400 && status < 600 ? status : 500).json({
      isError: true,
      replyText: 'Oops, something happened :C',
      errorCode,
      errorDetails: error?.message || 'Error processing analytics query.',
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
