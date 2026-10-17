import { Task, Person, DuplicateCandidate, DuplicateTaskPair, DuplicatePersonPair, DuplicateTagPair } from '../types';
import { mergeNoteItems } from './notesHelper';

/**
 * Normalizes text for string comparison (lowercasing, trimming, removing extra punctuation)
 */
function normalizeText(str: string): string {
  return str.toLowerCase().replace(/[^\w\s]/gi, '').trim();
}

/**
 * Calculates Jaccard similarity score between two strings
 */
function getSimilarityScore(str1: string, str2: string): number {
  const norm1 = normalizeText(str1);
  const norm2 = normalizeText(str2);

  if (norm1 === norm2) return 1.0;
  if (!norm1 || !norm2) return 0.0;

  const words1 = new Set(norm1.split(/\s+/));
  const words2 = new Set(norm2.split(/\s+/));

  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Scans existing tasks, people, and tags to detect potential duplicates
 */
export function findDuplicateCandidates(tasks: Task[], people: Person[]): DuplicateCandidate[] {
  const candidates: DuplicateCandidate[] = [];

  // 1. Task Duplicates
  for (let i = 0; i < tasks.length; i++) {
    for (let j = i + 1; j < tasks.length; j++) {
      const t1 = tasks[i];
      const t2 = tasks[j];

      // Determine which task is newer
      const t1Time = new Date(t1.createdAt || 0).getTime();
      const t2Time = new Date(t2.createdAt || 0).getTime();
      const olderTask = t1Time <= t2Time ? t1 : t2;
      const newerTask = t1Time <= t2Time ? t2 : t1;

      const titleSim = getSimilarityScore(t1.title, t2.title);

      if (titleSim >= 0.75 || normalizeText(t1.title) === normalizeText(t2.title)) {
        candidates.push({
          type: 'task',
          id: `dup-task-${olderTask.id}-${newerTask.id}`,
          newerTask,
          olderTask,
          similarityReason: titleSim === 1.0 
            ? 'Exact matching task title' 
            : `High title similarity (${Math.round(titleSim * 100)}% match)`,
        });
      }
    }
  }

  // 2. People Duplicates
  for (let i = 0; i < people.length; i++) {
    for (let j = i + 1; j < people.length; j++) {
      const p1 = people[i];
      const p2 = people[j];

      const p1Time = new Date(p1.createdAt || 0).getTime();
      const p2Time = new Date(p2.createdAt || 0).getTime();
      const olderPerson = p1Time <= p2Time ? p1 : p2;
      const newerPerson = p1Time <= p2Time ? p2 : p1;

      const nameMatch = normalizeText(p1.name) === normalizeText(p2.name);
      const aliasMatch = p1.aliases?.some((a) =>
        p2.aliases?.some((b) => normalizeText(a) === normalizeText(b))
      );

      if (nameMatch || aliasMatch) {
        candidates.push({
          type: 'person',
          id: `dup-person-${olderPerson.id}-${newerPerson.id}`,
          newerPerson,
          olderPerson,
          similarityReason: nameMatch
            ? 'Matching person name'
            : 'Matching person nickname or alias',
        });
      }
    }
  }

  // 3. Tag / Emotional Keyword Duplicates
  const tagCounts: { [tag: string]: { original: string; count: number; taskIds: string[] } } = {};

  tasks.forEach((task) => {
    (task.emotionalKeywords || []).forEach((kw) => {
      const norm = normalizeText(kw);
      if (!norm) return;
      if (!tagCounts[norm]) {
        tagCounts[norm] = { original: kw, count: 0, taskIds: [] };
      }
      tagCounts[norm].count++;
      if (!tagCounts[norm].taskIds.includes(task.id)) {
        tagCounts[norm].taskIds.push(task.id);
      }
    });
  });

  // Find tags that differ in casing or whitespace
  const tagKeys = Object.keys(tagCounts);
  for (let i = 0; i < tagKeys.length; i++) {
    for (let j = i + 1; j < tagKeys.length; j++) {
      const key1 = tagKeys[i];
      const key2 = tagKeys[j];

      if (key1 === key2) {
        const item1 = tagCounts[key1];
        const item2 = tagCounts[key2];
        if (item1.original !== item2.original) {
          candidates.push({
            type: 'tag',
            id: `dup-tag-${key1}`,
            tagCanonical: item2.original.charAt(0).toUpperCase() + item2.original.slice(1),
            tagDuplicate: item1.original,
            affectedTaskIds: Array.from(new Set([...item1.taskIds, ...item2.taskIds])),
            similarityReason: 'Case or formatting variation of tag',
          });
        }
      }
    }
  }

  return candidates;
}

/**
 * Merges two duplicate tasks preserving all non-conflicting bullet notes, tags, contacts, and reminders.
 * The newer task takes precedence for primary fields (title, urgency, due date, category, completed state).
 */
export function executeTaskMerge(olderTask: Task, newerTask: Task): Task {
  // Combine notes without duplicates using mergeNoteItems
  const mergedNotes = mergeNoteItems(newerTask.notesBullets, olderTask.notesBullets);

  // Combine emotional keywords without duplicates
  const mergedTagsSet = new Set<string>();
  (newerTask.emotionalKeywords || []).forEach((t) => mergedTagsSet.add(t));
  (olderTask.emotionalKeywords || []).forEach((t) => mergedTagsSet.add(t));

  // Combine involved people IDs without duplicates
  const mergedPeopleSet = new Set<string>();
  (newerTask.involvedPeopleIds || []).forEach((p) => mergedPeopleSet.add(p));
  (olderTask.involvedPeopleIds || []).forEach((p) => mergedPeopleSet.add(p));

  // Combine reminders without duplicates
  const mergedReminders = [...(newerTask.reminders || [])];
  (olderTask.reminders || []).forEach((rem) => {
    if (!mergedReminders.some((r) => r.label === rem.label && r.triggerTime === rem.triggerTime)) {
      mergedReminders.push(rem);
    }
  });

  return {
    ...newerTask,
    title: newerTask.title || olderTask.title,
    urgency: newerTask.urgency || olderTask.urgency,
    environmentalCategory: newerTask.environmentalCategory || olderTask.environmentalCategory,
    intendedTimeMinutes: newerTask.intendedTimeMinutes || olderTask.intendedTimeMinutes,
    actualTimeMinutes: (newerTask.actualTimeMinutes || 0) + (olderTask.actualTimeMinutes || 0),
    dueDateTime: newerTask.dueDateTime !== null ? newerTask.dueDateTime : olderTask.dueDateTime,
    completed: newerTask.completed ?? olderTask.completed,
    completedAt: newerTask.completedAt || olderTask.completedAt,
    notesBullets: mergedNotes,
    emotionalKeywords: Array.from(mergedTagsSet),
    involvedPeopleIds: Array.from(mergedPeopleSet),
    reminders: mergedReminders,
  };
}

/**
 * Merges two duplicate people entries preserving notes, contacts, and aliases.
 * The newer person entry takes precedence for primary fields.
 */
export function executePersonMerge(olderPerson: Person, newerPerson: Person): Person {
  // Combine notes
  let combinedNotes = newerPerson.notes || '';
  if (olderPerson.notes && !combinedNotes.toLowerCase().includes(olderPerson.notes.toLowerCase())) {
    combinedNotes = combinedNotes ? `${combinedNotes}\n• ${olderPerson.notes}` : olderPerson.notes;
  }

  // Combine aliases
  const mergedAliasesSet = new Set<string>([
    ...(newerPerson.aliases || []),
    ...(olderPerson.aliases || []),
    olderPerson.name,
  ]);
  // Remove the new primary name from aliases
  mergedAliasesSet.delete(newerPerson.name);

  return {
    ...newerPerson,
    name: newerPerson.name || olderPerson.name,
    roleOrRelation: newerPerson.roleOrRelation || olderPerson.roleOrRelation,
    email: newerPerson.email || olderPerson.email,
    phone: newerPerson.phone || olderPerson.phone,
    avatarColor: newerPerson.avatarColor || olderPerson.avatarColor,
    notes: combinedNotes,
    aliases: Array.from(mergedAliasesSet),
  };
}

/**
 * Replaces a duplicate tag with the canonical tag across all tasks
 */
export function executeTagMerge(tasks: Task[], tagDuplicate: string, tagCanonical: string): Task[] {
  return tasks.map((task) => {
    if (!task.emotionalKeywords?.includes(tagDuplicate)) return task;
    const updatedKeywords = task.emotionalKeywords.map((k) =>
      k === tagDuplicate ? tagCanonical : k
    );
    // Deduplicate
    const uniqueKeywords = Array.from(new Set(updatedKeywords));
    return {
      ...task,
      emotionalKeywords: uniqueKeywords,
    };
  });
}
