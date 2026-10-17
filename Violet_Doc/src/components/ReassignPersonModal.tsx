import React, { useState } from 'react';
import { X, UserX, ArrowRight, Trash2 } from 'lucide-react';
import { Person, Task } from '../types';
import { CustomDropdown, DropdownOption } from './CustomDropdown';

interface ReassignPersonModalProps {
  person: Person;
  linkedTasks: Task[];
  availablePeople: Person[];
  onConfirmDelete: (reassignToPersonId?: string) => void;
  onClose: () => void;
}

export const ReassignPersonModal: React.FC<ReassignPersonModalProps> = ({
  person,
  linkedTasks,
  availablePeople,
  onConfirmDelete,
  onClose,
}) => {
  const [selectedPersonId, setSelectedPersonId] = useState<string>('unassign');

  const otherPeople = availablePeople.filter((p) => p.id !== person.id);

  const dropdownOptions: DropdownOption[] = [
    {
      value: 'unassign',
      label: 'Unassign tasks (Remove link)',
      emoji: '🚫',
      description: 'Keep tasks active without an assigned collaborator',
    },
    ...otherPeople.map((p) => ({
      value: p.id,
      label: `Reassign to ${p.name}`,
      emoji: '👤',
      description: p.roleOrRelation || 'Collaborator',
    })),
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPersonId === 'unassign') {
      onConfirmDelete(undefined);
    } else {
      onConfirmDelete(selectedPersonId);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 font-sans animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-red-600 to-rose-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <UserX className="w-5 h-5 text-rose-100" />
            <div>
              <h3 className="text-sm font-bold">Delete Profile & Reassign Tasks</h3>
              <p className="text-[11px] text-rose-100 font-medium">
                {person.name} is linked to {linkedTasks.length} task{linkedTasks.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            <strong className="text-slate-800">{person.name}</strong> is currently assigned to the following task(s):
          </p>

          {/* Linked Tasks List */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-1.5 max-h-36 overflow-y-auto">
            {linkedTasks.map((t) => (
              <div key={t.id} className="text-xs font-bold text-slate-700 bg-white p-2 rounded-xl border border-slate-200 truncate">
                • {t.title}
              </div>
            ))}
          </div>

          {/* Reassignment Dropdown */}
          <div>
            <CustomDropdown
              label="Choose Action for Tasks"
              options={dropdownOptions}
              value={selectedPersonId}
              onChange={(val) => setSelectedPersonId(val)}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-bold text-slate-600 hover:bg-slate-100 px-4 py-2 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="text-xs font-bold bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Confirm & Delete</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
