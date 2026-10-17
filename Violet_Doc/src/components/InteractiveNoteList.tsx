import React, { useRef } from 'react';
import { CheckSquare, Square, Trash2, Plus, CheckCircle2 } from 'lucide-react';
import { NoteItem } from '../types';
import { generateNoteId } from '../utils/notesHelper';

interface InteractiveNoteListProps {
  items: NoteItem[];
  onChange: (items: NoteItem[]) => void;
  title?: string;
  placeholder?: string;
  showProgress?: boolean;
}

export const InteractiveNoteList: React.FC<InteractiveNoteListProps> = ({
  items,
  onChange,
  title,
  placeholder = 'Add key instruction or note...',
  showProgress = true,
}) => {
  const inputRefs = useRef<{ [id: string]: HTMLInputElement | null }>({});

  const completedCount = items.filter((i) => i.completed).length;
  const totalCount = items.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleToggle = (id: string) => {
    const updated = items.map((item) =>
      item.id === id ? { ...item, completed: !item.completed } : item
    );
    onChange(updated);
  };

  const handleTextChange = (id: string, newText: string) => {
    const updated = items.map((item) =>
      item.id === id ? { ...item, text: newText } : item
    );
    onChange(updated);
  };

  const handleDelete = (id: string) => {
    const updated = items.filter((item) => item.id !== id);
    onChange(updated);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number,
    item: NoteItem
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Insert new empty bullet right after current index
      const newItem: NoteItem = {
        id: generateNoteId(),
        text: '',
        completed: false,
      };
      const updated = [...items];
      updated.splice(index + 1, 0, newItem);
      onChange(updated);

      // Focus new input after render
      setTimeout(() => {
        inputRefs.current[newItem.id]?.focus();
      }, 50);
    } else if (e.key === 'Backspace' && item.text === '' && items.length > 0) {
      e.preventDefault();
      const prevItem = items[index - 1];
      const updated = items.filter((i) => i.id !== item.id);
      onChange(updated);

      if (prevItem) {
        setTimeout(() => {
          inputRefs.current[prevItem.id]?.focus();
        }, 50);
      }
    }
  };

  const handleAddNewItem = () => {
    const newItem: NoteItem = {
      id: generateNoteId(),
      text: '',
      completed: false,
    };
    onChange([...items, newItem]);
    setTimeout(() => {
      inputRefs.current[newItem.id]?.focus();
    }, 50);
  };

  return (
    <div className="space-y-2">
      {/* Header & Sub-checklist progress indicator */}
      {showProgress && totalCount > 0 && (
        <div className="flex items-center justify-between text-xs mb-1 bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-1.5">
          <div className="flex items-center gap-1.5 font-bold text-slate-700">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Sub-checklist Progress:</span>
            <span className="text-emerald-700 font-extrabold">
              {completedCount}/{totalCount} ({progressPercent}%)
            </span>
          </div>

          <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden shrink-0">
            <div
              className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Bullet List */}
      <div className="space-y-1.5">
        {items.map((item, index) => (
          <div
            key={item.id}
            className={`flex items-center gap-2 group p-1.5 rounded-xl border transition-all ${
              item.completed
                ? 'bg-emerald-50/50 border-emerald-200/60'
                : 'bg-white border-slate-200 focus-within:border-violet-500 focus-within:shadow-2xs'
            }`}
          >
            {/* Checkbox button */}
            <button
              type="button"
              onClick={() => handleToggle(item.id)}
              className={`p-1 rounded-lg cursor-pointer transition-colors shrink-0 ${
                item.completed
                  ? 'text-emerald-600 hover:text-emerald-700'
                  : 'text-slate-300 hover:text-violet-600'
              }`}
              title={item.completed ? 'Mark note uncompleted' : 'Mark note completed'}
            >
              {item.completed ? (
                <CheckSquare className="w-4 h-4 text-emerald-600 fill-emerald-100" />
              ) : (
                <Square className="w-4 h-4" />
              )}
            </button>

            {/* Inline editable text input */}
            <input
              ref={(el) => (inputRefs.current[item.id] = el)}
              type="text"
              value={item.text}
              onChange={(e) => handleTextChange(item.id, e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, index, item)}
              placeholder={placeholder}
              className={`flex-1 bg-transparent text-xs outline-none transition-all ${
                item.completed
                  ? 'line-through text-slate-400 font-normal'
                  : 'text-slate-800 font-medium'
              }`}
            />

            {/* Trash button */}
            <button
              type="button"
              onClick={() => handleDelete(item.id)}
              className="text-slate-300 hover:text-rose-600 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shrink-0"
              title="Delete note bullet"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Add new bullet button */}
      <button
        type="button"
        onClick={handleAddNewItem}
        className="w-full py-1.5 px-3 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 hover:border-violet-400 rounded-xl text-xs font-semibold text-slate-600 hover:text-violet-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Add Note Bullet</span>
      </button>
    </div>
  );
};
