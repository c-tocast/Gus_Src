import React, { useState } from 'react';
import { User, Plus, Search, CheckSquare, Square, Phone, Mail, Sparkles, Tag } from 'lucide-react';
import { Person, Task, UrgencyLevel, EnvironmentalCategory } from '../types';
import { getRandomAvatarColor } from '../utils/storage';
import { parsePersonNotes, serializePersonNotes } from '../utils/notesHelper';
import { CustomDropdown, DropdownOption } from './CustomDropdown';

interface PeopleViewProps {
  people: Person[];
  tasks: Task[];
  onSelectPerson: (person: Person) => void;
  onUpdatePerson?: (updatedPerson: Person) => void;
  onAddNewPerson: (
    newPerson: Partial<Person>,
    initialRelatedTask?: {
      title: string;
      urgency: UrgencyLevel;
      environmentalCategory: EnvironmentalCategory;
    }
  ) => void;
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

export const PeopleView: React.FC<PeopleViewProps> = ({
  people,
  tasks,
  onSelectPerson,
  onUpdatePerson,
  onAddNewPerson,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // Manual Add Form
  const [name, setName] = useState('');
  const [roleOrRelation, setRoleOrRelation] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [aliases, setAliases] = useState<string[]>([]);
  const [newAliasText, setNewAliasText] = useState('');

  // Initial Task attachment on person creation
  const [attachTask, setAttachTask] = useState(false);
  const [initialTaskTitle, setInitialTaskTitle] = useState('');
  const [initialTaskUrgency, setInitialTaskUrgency] = useState<UrgencyLevel>('Medium');
  const [initialTaskCategory, setInitialTaskCategory] = useState<EnvironmentalCategory>('Work');

  const filteredPeople = people.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.roleOrRelation?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.notes?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.aliases?.some((a) => a.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleAddAlias = () => {
    const trimmed = newAliasText.trim();
    if (!trimmed) return;
    if (!aliases.some((a) => a.toLowerCase() === trimmed.toLowerCase())) {
      setAliases([...aliases, trimmed]);
    }
    setNewAliasText('');
  };

  const handleRemoveAlias = (aliasToRemove: string) => {
    setAliases(aliases.filter((a) => a !== aliasToRemove));
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const initialTaskData =
      attachTask && initialTaskTitle.trim()
        ? {
            title: initialTaskTitle.trim(),
            urgency: initialTaskUrgency,
            environmentalCategory: initialTaskCategory,
          }
        : undefined;

    onAddNewPerson(
      {
        name: name.trim(),
        roleOrRelation: roleOrRelation.trim() || 'Contact',
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        notes: notes.trim() || '',
        aliases,
        avatarColor: getRandomAvatarColor(),
      },
      initialTaskData
    );

    setName('');
    setRoleOrRelation('');
    setEmail('');
    setPhone('');
    setNotes('');
    setAliases([]);
    setAttachTask(false);
    setInitialTaskTitle('');
    setShowAddModal(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative font-sans">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 shrink-0 shadow-2xs">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-bold text-slate-800">People & Key Collaborators</h2>
            <p className="text-xs text-slate-500 font-medium">
              {people.length} person profile{people.length === 1 ? '' : 's'} • Manage task involvement & contacts
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-violet-600 hover:bg-violet-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Person
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search collaborators by name, alias, relation, or notes..."
            className="w-full bg-slate-100 focus:bg-white border border-slate-200 focus:border-violet-600 text-xs text-slate-800 rounded-xl pl-9 pr-3 py-2 outline-none transition-all"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredPeople.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-3 mt-4">
            <div className="w-12 h-12 rounded-full bg-violet-50 text-violet-600 flex items-center justify-center mx-auto">
              <User className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No person profiles created yet</h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Mention anyone in the Violet AI chatbox (e.g. "Review proposal with Sarah") and Violet will automatically build or update their profile.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredPeople.map((person) => {
              const personTasks = tasks.filter((t) => t.involvedPeopleIds?.includes(person.id));

              return (
                <div
                  key={person.id}
                  onClick={() => onSelectPerson(person)}
                  className="bg-white border border-slate-200/90 rounded-2xl p-4 transition-all shadow-2xs hover:shadow-md cursor-pointer group flex flex-col justify-between space-y-3 hover:border-violet-300"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-11 h-11 rounded-2xl text-white font-bold text-base flex items-center justify-center shrink-0 shadow-xs"
                      style={{ backgroundColor: person.avatarColor || '#7c3aed' }}
                    >
                      {person.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-slate-800 group-hover:text-violet-600 transition-colors truncate">
                        {person.name}
                      </h4>
                      <p className="text-xs font-semibold text-slate-500 truncate">
                        {person.roleOrRelation || 'Contact'}
                      </p>

                      {/* Aliases */}
                      {person.aliases && person.aliases.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {person.aliases.map((alias) => (
                            <span
                              key={alias}
                              className="text-[10px] bg-violet-50 text-violet-800 border border-violet-200/80 px-1.5 py-0.2 rounded-md font-bold"
                            >
                              @{alias}
                            </span>
                          ))}
                        </div>
                      )}

                      {person.notes && (() => {
                        const parsedNotes = parsePersonNotes(person.notes);
                        if (parsedNotes.length === 0) return null;
                        return (
                          <div className="mt-1 space-y-1">
                            {parsedNotes.slice(0, 3).map((item) => (
                              <div key={item.id} className="flex items-center gap-1.5 text-[11px]">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onUpdatePerson) {
                                      const updatedNotes = parsedNotes.map((n) =>
                                        n.id === item.id ? { ...n, completed: !n.completed } : n
                                      );
                                      onUpdatePerson({
                                        ...person,
                                        notes: serializePersonNotes(updatedNotes),
                                      });
                                    }
                                  }}
                                  className={`cursor-pointer transition-colors shrink-0 ${
                                    item.completed
                                      ? 'text-emerald-600'
                                      : 'text-slate-300 hover:text-violet-600'
                                  }`}
                                  title={item.completed ? 'Mark note uncompleted' : 'Mark note completed'}
                                >
                                  {item.completed ? (
                                    <CheckSquare className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Square className="w-3 h-3" />
                                  )}
                                </button>
                                <span
                                  className={`truncate ${
                                    item.completed
                                      ? 'line-through text-slate-400 font-normal'
                                      : 'text-slate-600 font-medium'
                                  }`}
                                >
                                  {item.text}
                                </span>
                              </div>
                            ))}
                            {parsedNotes.length > 3 && (
                              <span className="text-[10px] text-slate-400 font-semibold pl-4 block">
                                +{parsedNotes.length - 3} more notes
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span className="flex items-center gap-1 font-bold text-slate-700">
                      <CheckSquare className="w-3.5 h-3.5 text-violet-600" />
                      {personTasks.length} {personTasks.length === 1 ? 'Task' : 'Tasks'}
                    </span>
                    <span className="text-violet-600 font-bold group-hover:underline">
                      Edit Profile →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Manual Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">Add Person Profile</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3 font-sans">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Sarah Jenkins"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-bold outline-none focus:border-violet-600 focus:bg-white"
                />
              </div>

              {/* Nicknames / Aliases */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                  <Tag className="w-3 h-3 text-violet-600" /> Aliases & Nicknames
                </label>
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {aliases.map((a) => (
                    <span
                      key={a}
                      className="text-[11px] bg-violet-50 text-violet-900 border border-violet-200 px-2 py-0.5 rounded-lg font-bold flex items-center gap-1"
                    >
                      @{a}
                      <button
                        type="button"
                        onClick={() => handleRemoveAlias(a)}
                        className="hover:text-red-600 cursor-pointer ml-0.5"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newAliasText}
                    onChange={(e) => setNewAliasText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddAlias())}
                    placeholder="e.g. Boss, Sare..."
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold outline-none focus:border-violet-600"
                  />
                  <button
                    type="button"
                    onClick={handleAddAlias}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-1 rounded-xl"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Role or Relation <span className="text-slate-400 text-[10px]">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={roleOrRelation}
                  onChange={(e) => setRoleOrRelation(e.target.value)}
                  placeholder="e.g., Marketing Director, Professor"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-violet-600 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Email <span className="text-slate-400 text-[10px]">(Optional)</span></label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="sarah@company.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-800 outline-none focus:border-violet-600"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Phone <span className="text-slate-400 text-[10px]">(Optional)</span></label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 555-0192"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-800 outline-none focus:border-violet-600"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Notes & Context <span className="text-slate-400 text-[10px]">(Optional)</span></label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Preferred contact hours, context, or instructions..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-800 outline-none focus:border-violet-600"
                />
              </div>

              {/* Attach initial related task option */}
              <div className="pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-violet-900 bg-violet-50/80 p-2.5 rounded-xl border border-violet-200">
                  <input
                    type="checkbox"
                    checked={attachTask}
                    onChange={(e) => setAttachTask(e.target.checked)}
                    className="accent-violet-600 w-4 h-4 rounded"
                  />
                  <span>Create initial related task for {name || 'this person'}</span>
                </label>

                {attachTask && (
                  <div className="mt-2 p-3 bg-slate-50 border border-violet-200 rounded-xl space-y-2 animate-in fade-in duration-150">
                    <input
                      type="text"
                      value={initialTaskTitle}
                      onChange={(e) => setInitialTaskTitle(e.target.value)}
                      placeholder="e.g. Schedule meeting with Sarah..."
                      className="w-full bg-white border border-slate-200 text-xs text-slate-800 p-2 rounded-xl outline-none focus:border-violet-600 font-bold"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <CustomDropdown
                        label="Urgency"
                        size="sm"
                        options={URGENCY_OPTIONS}
                        value={initialTaskUrgency}
                        onChange={(val) => setInitialTaskUrgency(val as UrgencyLevel)}
                      />
                      <CustomDropdown
                        label="Realm"
                        size="sm"
                        options={CATEGORY_OPTIONS}
                        value={initialTaskCategory}
                        onChange={(val) => setInitialTaskCategory(val as EnvironmentalCategory)}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="text-xs font-bold text-slate-600 hover:bg-slate-100 px-4 py-2 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white px-5 py-2 rounded-xl shadow-xs cursor-pointer"
                >
                  Create Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
