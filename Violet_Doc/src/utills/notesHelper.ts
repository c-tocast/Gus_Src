import { NoteItem } from '../types';

export function generateNoteId(): string {
  return `note-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

export function normalizeNoteItem(item: string | NoteItem | undefined | null): NoteItem | null {
  if (!item) return null;

  if (typeof item === 'object' && item !== null && 'text' in item) {
    const textStr = String(item.text || '').trim();
    if (!textStr) return null;
    return {
      id: item.id || generateNoteId(),
      text: textStr,
      completed: Boolean(item.completed),
    };
  }

  if (typeof item === 'string') {
    let raw = item.trim();
    if (!raw) return null;

    let completed = false;

    // Check for completed markers
    if (/^(?:\[[xXvV]\]|✓|\(x\)|\(X\))\s*/.test(raw)) {
      completed = true;
      raw = raw.replace(/^(?:\[[xXvV]\]|✓|\(x\)|\(X\))\s*/, '');
    } else if (/^\[\s*\]\s*/.test(raw)) {
      completed = false;
      raw = raw.replace(/^\[\s*\]\s*/, '');
    }

    // Strip leading bullets / list markers
    raw = raw.replace(/^(?:[•\-\*]|\d+\.)\s*/, '').trim();

    if (!raw) return null;

    return {
      id: generateNoteId(),
      text: raw,
      completed,
    };
  }

  return null;
}

export function normalizeNoteItems(
  items: (string | NoteItem)[] | undefined | null
): NoteItem[] {
  if (!items || !Array.isArray(items)) return [];
  const result: NoteItem[] = [];
  items.forEach((it) => {
    const normalized = normalizeNoteItem(it);
    if (normalized) {
      result.push(normalized);
    }
  });
  return result;
}

export function serializePersonNotes(items: (NoteItem | string)[]): string {
  const normalized = normalizeNoteItems(items);
  if (normalized.length === 0) return '';
  return normalized
    .map((item) => (item.completed ? `✓ ${item.text}` : `• ${item.text}`))
    .join('\n');
}

export function parsePersonNotes(notesStr: string | undefined | null): NoteItem[] {
  if (!notesStr || !notesStr.trim()) return [];
  const lines = notesStr.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return normalizeNoteItems(lines);
}

export function mergeNoteItems(
  existing: (NoteItem | string)[] | undefined | null,
  incoming: (NoteItem | string)[] | undefined | null
): NoteItem[] {
  const current = normalizeNoteItems(existing);
  const newItems = normalizeNoteItems(incoming);

  const existingLowerMap = new Set(current.map((item) => item.text.toLowerCase()));

  newItems.forEach((incomingItem) => {
    const lower = incomingItem.text.toLowerCase();
    if (!existingLowerMap.has(lower)) {
      existingLowerMap.add(lower);
      current.push({
        id: incomingItem.id || generateNoteId(),
        text: incomingItem.text,
        completed: incomingItem.completed || false,
      });
    }
  });

  return current;
}
