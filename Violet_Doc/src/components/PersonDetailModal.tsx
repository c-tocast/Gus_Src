import React, { useState } from 'react';
import { X, Phone, Mail, FileText, CheckSquare, Trash2, MessageSquare, Plus, Link as LinkIcon, Tag, User } from 'lucide-react';
import { Person, Task, UrgencyLevel, EnvironmentalCategory, NoteItem } from '../types';
import { parsePersonNotes, serializePersonNotes } from '../utils/notesHelper';
import { CustomDropdown, DropdownOption } from './CustomDropdown';
import { InteractiveNoteList } from './InteractiveNoteList';

interface PersonDetailModalProps {
  person: Person;
  tasks: Task[];
  onClose: () => void;
  onUpdatePerson: (updatedPerson: Person) => void;
  onDeletePerson: (personId: string) => void;
  onOpenTask?: (taskId: string) => void;
  onSendChatMessage?: (prompt: string) => void;
  onAddTaskForPerson?: (
    personId: string,
    taskData: {
      title: string;
      urgency: UrgencyLevel;
      environmentalCategory: EnvironmentalCategory;
      intendedTimeMinutes: number;
    }
  ) => void;
  onToggleTaskLink?: (taskId: string, personId: string) => void;
}

const URGENCY_OPTIONS: DropdownOption<UrgencyLevel>[] = [
  { value: 'ASAP', label: 'ASAP (Within 24h)', emoji: '⚡' },
  { value: 'Urgent', label: 'Urgent (Within 7d)', emoji: '🔥' },
  { value: 'Medium', label: 'Medium (Within 1m)', emoji: '📅' },
  { value: 'None-Low', label: 'None-Low (Within 3m)', emoji: '🌱' },
];

const CATEGORY_OPTIONS: DropdownOption<EnvironmentalCategory>[] = [
  { value: 'Work', label: 'Work', emoji: '💼' },
  { value: 'College/School', label: 'College/School', emoji: '🎓' },
  { value: 'Self Growth', label: 'Self Growth', emoji: '🪴' },
  { value: 'Home & Family', label: 'Home & Family', emoji: '🏠' },
  { value: 'Health & Fitness', label: 'Health & Fitness', emoji: '🏋️' },
  { value: 'Finance', label: 'Finance', emoji: '💰' },
  { value: 'Social & Relationships', label: 'Social & Relationships', emoji: '🤝' },
  { value: 'Creative', label: 'Creative', emoji: '🎨' },
  { value: 'Errands & Admin', label: 'Errands & Admin', emoji: '📋' },
  { value: 'Side Project', label: 'Side Project', emoji: '🚀' },
  { value: 'Travel & Leisure', label: 'Travel & Leisure', emoji: '✈️' },
  { value: 'Hobbies & Leisure', label: 'Hobbies & Leisure', emoji: '🎨' },
];

export const PersonDetailModal: React.FC<PersonDetailModalProps> = ({
  person,
  tasks,
  onClose,
  onUpdatePerson,
  onDeletePerson,
  onOpenTask,
  onSendChatMessage,
  onAddTaskForPerson,
  onToggleTaskLink,
}) => {
  const [name, setName] = useState(person.name);
  const [roleOrRelation, setRoleOrRelation] = useState(person.roleOrRelation || '');
  const [email, setEmail] = useState(person.email || '');
  const [phone, setPhone] = useState(person.phone || '');
  const [noteItems, setNoteItems] = useState<NoteItem[]>(() =>
    parsePersonNotes(person.notes)
  );
  const [aliases, setAliases] = useState<string[]>(person.aliases || []);
  const [newAlias, setNewAlias] = useState('');
  const [aiPromptInput, setAiPromptInput] = useState('');

  // Related Task Creation State inside Modal
  const [showAddTaskForm, setShowAddTaskForm] = useState(false);
  const [showLinkExisting, setShowLinkExisting] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskUrgency, setNewTaskUrgency] = useState<UrgencyLevel>('Medium');
  const [newTaskCategory, setNewTaskCategory] = useState<EnvironmentalCategory>('Work');
  const [newTaskDuration, setNewTaskDuration] = useState(30);

  const linkedTasks = tasks.filter((t) => t.involvedPeopleIds?.includes(person.id));
  const unlinkedTasks = tasks.filter((t) => !t.involvedPeopleIds?.includes(person.id));

  const handleAddAlias = () => {
    const trimmed = newAlias.trim();
    if (!trimmed) return;
    const exists = aliases.some((a) => a.toLowerCase() === trimmed.toLowerCase());
    if (!exists) {
      setAliases([...aliases, trimmed]);
    }
    setNewAlias('');
  };

  const handleRemoveAlias = (aliasToRemove: string) => {
    setAliases(aliases.filter((a) => a !== aliasToRemove));
  };

  const handleSave = () => {
    if (!name.trim()) return;

    const serializedNotes = serializePersonNotes(noteItems);

    onUpdatePerson({
      ...person,
      name: name.trim(),
      roleOrRelation: roleOrRelation.trim(),
      email: email.trim(),
      phone: phone.trim(),
      notes: serializedNotes,
      aliases,
    });
    onClose();
  };

  const handleSendAiUpdate = () => {
    if (!aiPromptInput.trim()) return;
    if (onSendChatMessage) {
      onSendChatMessage(`Update person profile for ${person.name}: ${aiPromptInput}`);
      onClose();
    }
  };

  const handleCreateRelatedTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    if (onAddTaskForPerson) {
      onAddTaskForPerson(person.id, {
        title: newTaskTitle.trim(),
        urgency: newTaskUrgency,
        environmentalCategory: newTaskCategory,
        intendedTimeMinutes: newTaskDuration,
      });
      setNewTaskTitle('');
      setShowAddTaskForm(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 my-8">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-violet-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl text-white font-bold text-lg flex items-center justify-center shadow-md border border-white/20"
              style={{ backgroundColor: person.avatarColor || '#7c3aed' }}
            >
              {name ? name.charAt(0).toUpperCase() : 'P'}
            </div>
            <div>
              <h3 className="text-base font-bold">{name || 'Unnamed Person'}</h3>
              <p className="text-xs text-violet-200">{roleOrRelation || 'Contact Profile'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto font-sans">
          {/* Quick Info Inputs */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sarah Jenkins"
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl p-2.5 outline-none focus:border-violet-600 focus:bg-white"
              />
            </div>

            {/* Aliases & Nicknames */}
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-violet-600" /> Aliases & Nicknames
              </label>
              <p className="text-[11px] text-slate-500 mb-1.5">
                Add nicknames or alternate names so Violet recognizes when you refer to this person (e.g. "Boss", "Sare"):
              </p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {aliases.map((alias) => (
                  <span
                    key={alias}
                    className="bg-violet-50 border border-violet-200 text-violet-900 text-xs font-bold px-2.5 py-1 rounded-xl flex items-center gap-1"
                  >
                    @{alias}
                    <button
                      type="button"
                      onClick={() => handleRemoveAlias(alias)}
                      className="hover:text-red-600 ml-0.5 cursor-pointer"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newAlias}
                  onChange={(e) => setNewAlias(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddAlias())}
                  placeholder="e.g. Boss, Sare..."
                  className="flex-1 bg-slate-50 border border-slate-200 text-xs p-2 rounded-xl outline-none focus:border-violet-600 font-bold"
                />
                <button
                  type="button"
                  onClick={handleAddAlias}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl cursor-pointer"
                >
                  Add Alias
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Role / Relation
                </label>
                <input
                  type="text"
                  value={roleOrRelation}
                  onChange={(e) => setRoleOrRelation(e.target.value)}
                  placeholder="e.g. Manager, Client"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-medium rounded-xl p-2.5 outline-none focus:border-violet-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-violet-600" /> Phone
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-medium rounded-xl p-2.5 outline-none focus:border-violet-600 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1 flex items-center gap-1">
                <Mail className="w-3 h-3 text-violet-600" /> Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sarah@example.com"
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-medium rounded-xl p-2.5 outline-none focus:border-violet-600 focus:bg-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1 flex items-center gap-1">
                <FileText className="w-3 h-3 text-violet-600" /> Key Profile Notes & Bullet Instructions
              </label>
              <InteractiveNoteList
                items={noteItems}
                onChange={setNoteItems}
                placeholder="Key details, preferences, working hours, or instructions..."
                showProgress={true}
              />
            </div>
          </div>

          {/* Update via AI Chat Prompt Option */}
          <div className="bg-violet-50/80 border border-violet-200 rounded-2xl p-4 space-y-2">
            <h5 className="text-xs font-bold text-violet-900 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-violet-600" />
              Update Profile via Violet AI Message
            </h5>
            <p className="text-[11px] text-violet-800/80">
              Instruct Violet directly in natural language (e.g., "Sarah joined product engineering team"):
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={aiPromptInput}
                onChange={(e) => setAiPromptInput(e.target.value)}
                placeholder="Type update instruction for Violet..."
                className="flex-1 bg-white border border-violet-200 text-xs text-slate-800 rounded-xl px-3 py-2 outline-none focus:border-violet-500"
              />
              <button
                type="button"
                onClick={handleSendAiUpdate}
                className="bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors shrink-0 shadow-xs cursor-pointer"
              >
                Send to Violet
              </button>
            </div>
          </div>

          {/* Connected Tasks & Add Related Tasks */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5 text-violet-600" />
                Associated Tasks ({linkedTasks.length})
              </h4>
              <div className="flex items-center gap-1">
                {unlinkedTasks.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowLinkExisting(!showLinkExisting)}
                    className="text-[11px] text-slate-600 hover:text-violet-600 bg-slate-100 hover:bg-violet-50 px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <LinkIcon className="w-3 h-3" /> Link Existing
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowAddTaskForm(!showAddTaskForm)}
                  className="text-[11px] text-violet-700 bg-violet-100 hover:bg-violet-200 px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Add Task
                </button>
              </div>
            </div>

            {/* Inline Add Task Form with Custom Dropdowns */}
            {showAddTaskForm && (
              <form onSubmit={handleCreateRelatedTask} className="bg-slate-50 border border-violet-200 rounded-2xl p-3.5 space-y-3 animate-in fade-in duration-150">
                <h5 className="text-xs font-bold text-slate-800">Add Related Task for {name || 'this person'}</h5>
                <div>
                  <input
                    type="text"
                    required
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="e.g. Schedule strategy sync with Sarah..."
                    className="w-full bg-white border border-slate-200 text-xs text-slate-800 rounded-xl p-2 outline-none focus:border-violet-600"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <CustomDropdown
                    label="Urgency"
                    size="sm"
                    options={URGENCY_OPTIONS}
                    value={newTaskUrgency}
                    onChange={(val) => setNewTaskUrgency(val as UrgencyLevel)}
                  />
                  <CustomDropdown
                    label="Realm"
                    size="sm"
                    options={CATEGORY_OPTIONS}
                    value={newTaskCategory}
                    onChange={(val) => setNewTaskCategory(val as EnvironmentalCategory)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Duration (minutes)</label>
                  <input
                    type="number"
                    value={newTaskDuration}
                    onChange={(e) => setNewTaskDuration(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl p-2 outline-none"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddTaskForm(false)}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow-2xs"
                  >
                    Save & Link Task
                  </button>
                </div>
              </form>
            )}

            {/* Inline Link Existing Task List */}
            {showLinkExisting && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-1.5 max-h-40 overflow-y-auto">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Click an unlinked task to associate with {name}:
                </span>
                {unlinkedTasks.map((ut) => (
                  <div
                    key={ut.id}
                    onClick={() => onToggleTaskLink?.(ut.id, person.id)}
                    className="p-2 bg-white hover:bg-violet-50 border border-slate-200 rounded-xl cursor-pointer text-xs font-semibold text-slate-700 flex items-center justify-between transition-colors"
                  >
                    <span className="truncate">{ut.title}</span>
                    <span className="text-violet-600 text-[11px] font-bold shrink-0">+ Attach</span>
                  </div>
                ))}
              </div>
            )}

            {/* Linked Tasks List */}
            {linkedTasks.length === 0 ? (
              <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-xl border border-slate-200">
                No active tasks linked to {name} yet. Click "+ Add Task" or mention {name} in Violet chat.
              </p>
            ) : (
              <div className="space-y-2">
                {linkedTasks.map((t) => (
                  <div
                    key={t.id}
                    className="bg-slate-50 hover:bg-slate-100/90 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-2"
                  >
                    <div
                      onClick={() => {
                        onOpenTask?.(t.id);
                        onClose();
                      }}
                      className="min-w-0 flex-1 cursor-pointer"
                    >
                      <h5 className={`text-xs font-bold text-slate-800 ${t.completed ? 'line-through text-slate-400' : ''}`}>
                        {t.title}
                      </h5>
                      <span className="text-[10px] text-slate-500 font-medium">
                        {t.environmentalCategory} • {t.urgency}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onToggleTaskLink?.(t.id, person.id)}
                        className="text-[10px] text-slate-400 hover:text-red-600 px-2 py-1 rounded-md hover:bg-slate-200/60 cursor-pointer"
                        title="Unlink from person"
                      >
                        Unlink
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onOpenTask?.(t.id);
                          onClose();
                        }}
                        className="text-xs text-violet-600 font-bold hover:underline cursor-pointer"
                      >
                        View →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between font-sans">
          <button
            type="button"
            onClick={() => onDeletePerson(person.id)}
            className="text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" /> Delete Profile
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-bold text-slate-600 hover:bg-slate-200/60 px-4 py-2 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white px-5 py-2 rounded-xl shadow-xs cursor-pointer"
            >
              Save Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
