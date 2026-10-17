import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  Clock,
  Bell,
  BellOff,
  Plus,
  Trash2,
  User,
  Tag,
  AlertTriangle,
  Smile,
  Globe,
  FileText,
  Calendar,
  Search,
  Timer,
  Repeat,
  RotateCcw,
} from 'lucide-react';
import { Task, Person, UrgencyLevel, EnvironmentalCategory, DayOfWeek, TaskFrequency, NoteItem } from '../types';
import { getRandomAvatarColor, normalizeTaskCompletedTags } from '../utils/storage';
import { normalizeNoteItems } from '../utils/notesHelper';
import { CustomDropdown, DropdownOption } from './CustomDropdown';
import { InteractiveNoteList } from './InteractiveNoteList';

interface TaskDetailModalProps {
  task: Task;
  people: Person[];
  onClose: () => void;
  onUpdateTask: (updatedTask: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onAddNewPerson?: (newPerson: Partial<Person>) => Person | void;
}

const URGENCY_OPTIONS: DropdownOption<UrgencyLevel>[] = [
  { value: 'Low', label: 'Low Urgency', emoji: '🌱' },
  { value: 'Medium', label: 'Medium Urgency', emoji: '📅' },
  { value: 'Urgent', label: 'Urgent (< 24 Hours)', emoji: '🔥' },
  { value: 'Past Due', label: 'Past Due', emoji: '⚠️' },
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

const FOLLOWUP_OPTIONS: DropdownOption[] = [
  { value: 'auto', label: 'Auto (Adaptive based on Urgency)', emoji: '🤖' },
  { value: 'hourly', label: 'Hourly Check-ins', emoji: '⏱️' },
  { value: 'daily', label: 'Daily Check-ins', emoji: '☀️' },
  { value: 'weekly', label: 'Weekly Check-ins', emoji: '📅' },
  { value: 'none', label: 'Disabled for this task', emoji: '🚫' },
];

const EMOTIONAL_SUGGESTIONS = [
  'Exciting',
  'High Focus',
  'Routine',
  'Stressful',
  'Fulfilling',
  'Dreading',
  'Creative',
  'Relaxing',
];

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  people,
  onClose,
  onUpdateTask,
  onDeleteTask,
  onAddNewPerson,
}) => {
  const [title, setTitle] = useState(task.title);
  const [completed, setCompleted] = useState(task.completed);
  const [urgency, setUrgency] = useState<UrgencyLevel>(task.urgency);
  const [environmentalCategory, setEnvironmentalCategory] = useState<EnvironmentalCategory>(
    task.environmentalCategory
  );
  const [intendedTimeMinutes, setIntendedTimeMinutes] = useState(task.intendedTimeMinutes || 30);
  const [actualTimeMinutes, setActualTimeMinutes] = useState(task.actualTimeMinutes || 0);
  const [dueDateTime, setDueDateTime] = useState(task.dueDateTime || '');
  const [emotionalKeywords, setEmotionalKeywords] = useState<string[]>(
    task.emotionalKeywords || []
  );
  const [newKeyword, setNewKeyword] = useState('');
  const [notesBullets, setNotesBullets] = useState<NoteItem[]>(() =>
    normalizeNoteItems(task.notesBullets)
  );
  const [newNote, setNewNote] = useState('');
  const [involvedPeopleIds, setInvolvedPeopleIds] = useState<string[]>(
    task.involvedPeopleIds || []
  );
  const [notificationsEnabled, setNotificationsEnabled] = useState(task.notificationsEnabled);
  const [followUpFrequency, setFollowUpFrequency] = useState(task.followUpFrequency || 'auto');
  const [taskType, setTaskType] = useState<'regular' | 'frequent'>(task.taskType || 'regular');

  // Archive fields state (Option 1A)
  const [archivedDueDateTime, setArchivedDueDateTime] = useState<string | null>(
    task.archivedDueDateTime ?? (task.dueDateTime ? task.dueDateTime : null)
  );
  const [archivedUrgency, setArchivedUrgency] = useState<UrgencyLevel>(
    task.archivedUrgency ?? (task.urgency !== 'Low' ? task.urgency : 'Medium')
  );

  // Frequency Subcategory State
  const [frequencyEnabled, setFrequencyEnabled] = useState(
    task.frequency?.enabled ?? task.taskType === 'frequent'
  );
  const [frequencyDays, setFrequencyDays] = useState<DayOfWeek[]>(
    task.frequency?.daysOfWeek || ['Mon', 'Wed', 'Fri']
  );
  const [repeatTime, setRepeatTime] = useState(task.frequency?.repeatTime || '09:00');
  const [addToStopwatch, setAddToStopwatch] = useState(task.frequency?.addToStopwatch ?? true);
  const [isFinalized, setIsFinalized] = useState<boolean>(
    Boolean(task.frequency?.isFinalized || (task.taskType === 'frequent' && task.completed))
  );
  const [showFinalizeModal, setShowFinalizeModal] = useState<boolean>(false);

  // Option 1A & 2A: Toggle frequency handler with non-destructive archiving and confirmation
  const handleFrequencyToggle = (checked: boolean) => {
    if (checked) {
      // Auto-promote to Frequent
      if (dueDateTime) setArchivedDueDateTime(dueDateTime);
      if (urgency !== 'Low') setArchivedUrgency(urgency);
      setFrequencyEnabled(true);
      setTaskType('frequent');
      setUrgency('Low');
      setDueDateTime('');
    } else {
      // Option 2A: Confirm demotion to Regular task
      const confirmMsg =
        'Convert this item to a Non-Repetitive Task? Frequency tags will be removed and it will be placed into the target due-date workflow.';
      if (window.confirm(confirmMsg)) {
        setFrequencyEnabled(false);
        setTaskType('regular');
        setIsFinalized(false);
        if (archivedDueDateTime) setDueDateTime(archivedDueDateTime);
        if (archivedUrgency) setUrgency(archivedUrgency);
      }
    }
  };

  const handleTaskTypeSwitch = (targetType: 'regular' | 'frequent') => {
    if (targetType === taskType) return;
    if (targetType === 'frequent') {
      if (dueDateTime) setArchivedDueDateTime(dueDateTime);
      if (urgency !== 'Low') setArchivedUrgency(urgency);
      setTaskType('frequent');
      setFrequencyEnabled(true);
      setUrgency('Low');
      setDueDateTime('');
    } else {
      const confirmMsg =
        'Convert this item to a Non-Repetitive Task? Frequency tags will be removed and it will be placed into the target due-date workflow.';
      if (window.confirm(confirmMsg)) {
        setTaskType('regular');
        setFrequencyEnabled(false);
        setIsFinalized(false);
        if (archivedDueDateTime) setDueDateTime(archivedDueDateTime);
        if (archivedUrgency) setUrgency(archivedUrgency);
      }
    }
  };

  // People narrow-down & inline create state
  const [personSearchQuery, setPersonSearchQuery] = useState('');
  const [showAddPersonForm, setShowAddPersonForm] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonRole, setNewPersonRole] = useState('');
  const [newPersonPhone, setNewPersonPhone] = useState('');

  const handleToggleCompleted = (nextVal: boolean) => {
    setCompleted(nextVal);
    const isRepetitiveFrequent = frequencyEnabled || taskType === 'frequent';
    if (isRepetitiveFrequent) {
      setIsFinalized(nextVal);
    }
    if (nextVal) {
      if (!emotionalKeywords.some((k) => k.toLowerCase() === 'completed')) {
        setEmotionalKeywords([...emotionalKeywords, 'completed']);
      }
    } else {
      setEmotionalKeywords(emotionalKeywords.filter((k) => k.toLowerCase() !== 'completed'));
    }
  };

  const handleConfirmFinalize = () => {
    const isRepetitiveFrequent = frequencyEnabled || taskType === 'frequent';
    const finalTaskType = isRepetitiveFrequent ? 'frequent' : 'regular';
    const updatedKeywords = emotionalKeywords.some((k) => k.toLowerCase() === 'completed')
      ? emotionalKeywords
      : [...emotionalKeywords, 'completed'];

    const updatedFrequency: TaskFrequency | undefined = isRepetitiveFrequent
      ? {
          enabled: true,
          daysOfWeek: frequencyDays,
          repeatTime: repeatTime || '09:00',
          addToStopwatch,
          stopwatchTargetMinutes: Number(intendedTimeMinutes) || 30,
          isFinalized: true,
          finalizedAt: new Date().toISOString(),
        }
      : undefined;

    const rawTask: Task = {
      ...task,
      title,
      taskType: finalTaskType,
      completed: true,
      urgency: finalTaskType === 'frequent' ? 'Low' : urgency,
      environmentalCategory,
      intendedTimeMinutes: Number(intendedTimeMinutes),
      actualTimeMinutes: Number(actualTimeMinutes),
      dueDateTime: null,
      archivedDueDateTime: isRepetitiveFrequent ? (archivedDueDateTime || dueDateTime || null) : archivedDueDateTime,
      archivedUrgency: isRepetitiveFrequent ? (archivedUrgency || (urgency !== 'Low' ? urgency : 'Medium')) : archivedUrgency,
      emotionalKeywords: updatedKeywords,
      notesBullets,
      involvedPeopleIds,
      notificationsEnabled,
      followUpFrequency,
      frequency: updatedFrequency,
      completedAt: new Date().toISOString(),
      completionHistory: task.completionHistory || [],
    };

    onUpdateTask(normalizeTaskCompletedTags(rawTask).task);
    setIsFinalized(true);
    setCompleted(true);
    setEmotionalKeywords(updatedKeywords);
    setShowFinalizeModal(false);
    onClose();
  };

  const handleReactivateRoutine = () => {
    const filteredKeywords = emotionalKeywords.filter((k) => k.toLowerCase() !== 'completed');

    const updatedFrequency: TaskFrequency = {
      enabled: true,
      daysOfWeek: frequencyDays,
      repeatTime: repeatTime || '09:00',
      addToStopwatch,
      stopwatchTargetMinutes: Number(intendedTimeMinutes) || 30,
      isFinalized: false,
      finalizedAt: null,
    };

    const rawTask: Task = {
      ...task,
      title,
      taskType: 'frequent',
      completed: false,
      urgency: 'Low',
      environmentalCategory,
      intendedTimeMinutes: Number(intendedTimeMinutes),
      actualTimeMinutes: Number(actualTimeMinutes),
      dueDateTime: null,
      emotionalKeywords: filteredKeywords,
      notesBullets,
      involvedPeopleIds,
      notificationsEnabled,
      followUpFrequency,
      frequency: updatedFrequency,
      completedAt: null,
      completionHistory: task.completionHistory || [],
    };

    onUpdateTask(normalizeTaskCompletedTags(rawTask).task);
    setIsFinalized(false);
    setCompleted(false);
    setEmotionalKeywords(filteredKeywords);
  };

  const handleSave = () => {
    const isRepetitiveFrequent = frequencyEnabled || taskType === 'frequent';
    const finalTaskType = isRepetitiveFrequent ? 'frequent' : 'regular';
    const finalIsFinalized = isRepetitiveFrequent ? (isFinalized || completed) : false;
    const updatedFrequency: TaskFrequency | undefined = isRepetitiveFrequent
      ? {
          enabled: true,
          daysOfWeek: frequencyDays,
          repeatTime: repeatTime || '09:00',
          addToStopwatch,
          stopwatchTargetMinutes: Number(intendedTimeMinutes) || 30,
          isFinalized: finalIsFinalized,
          finalizedAt: finalIsFinalized ? (task.frequency?.finalizedAt || new Date().toISOString()) : null,
        }
      : undefined;

    const rawTask: Task = {
      ...task,
      title,
      taskType: finalTaskType,
      completed: finalIsFinalized ? true : completed,
      urgency: finalTaskType === 'frequent' ? 'Low' : urgency,
      environmentalCategory,
      intendedTimeMinutes: Number(intendedTimeMinutes),
      actualTimeMinutes: Number(actualTimeMinutes),
      dueDateTime: finalTaskType === 'frequent' ? null : dueDateTime || null,
      archivedDueDateTime: isRepetitiveFrequent ? (archivedDueDateTime || dueDateTime || null) : archivedDueDateTime,
      archivedUrgency: isRepetitiveFrequent ? (archivedUrgency || (urgency !== 'Low' ? urgency : 'Medium')) : archivedUrgency,
      emotionalKeywords,
      notesBullets,
      involvedPeopleIds,
      notificationsEnabled,
      followUpFrequency,
      frequency: updatedFrequency,
      completedAt: (finalIsFinalized || completed) && !task.completed
        ? new Date().toISOString()
        : ((finalIsFinalized || completed) ? task.completedAt || new Date().toISOString() : null),
    };

    onUpdateTask(normalizeTaskCompletedTags(rawTask).task);
    onClose();
  };

  const handleAddKeyword = (kw: string) => {
    const trimmed = kw.trim();
    if (!trimmed) return;
    if (trimmed.toLowerCase() === 'completed') {
      handleToggleCompleted(true);
      setNewKeyword('');
      return;
    }
    if (!emotionalKeywords.includes(trimmed)) {
      setEmotionalKeywords([...emotionalKeywords, trimmed]);
    }
    setNewKeyword('');
  };

  const handleRemoveKeyword = (kw: string) => {
    if (kw.toLowerCase() === 'completed') {
      handleToggleCompleted(false);
      return;
    }
    setEmotionalKeywords(emotionalKeywords.filter((k) => k !== kw));
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    setNotesBullets([...notesBullets, newNote.trim()]);
    setNewNote('');
  };

  const handleRemoveNote = (index: number) => {
    setNotesBullets(notesBullets.filter((_, i) => i !== index));
  };

  const togglePersonLink = (personId: string) => {
    if (involvedPeopleIds.includes(personId)) {
      setInvolvedPeopleIds(involvedPeopleIds.filter((id) => id !== personId));
    } else {
      setInvolvedPeopleIds([...involvedPeopleIds, personId]);
    }
  };

  const handleCreateInlinePerson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPersonName.trim()) return;

    if (onAddNewPerson) {
      const created = onAddNewPerson({
        name: newPersonName.trim(),
        roleOrRelation: newPersonRole.trim() || 'Collaborator',
        phone: newPersonPhone.trim() || undefined,
        avatarColor: getRandomAvatarColor(),
      });

      if (created && created.id) {
        setInvolvedPeopleIds((prev) => [...prev, created.id]);
      }
    }

    setNewPersonName('');
    setNewPersonRole('');
    setNewPersonPhone('');
    setShowAddPersonForm(false);
  };

  const filteredPeople = people.filter(
    (p) =>
      p.name.toLowerCase().includes(personSearchQuery.toLowerCase()) ||
      p.roleOrRelation?.toLowerCase().includes(personSearchQuery.toLowerCase()) ||
      p.aliases?.some((a) => a.toLowerCase().includes(personSearchQuery.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto font-sans">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 my-8">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-slate-800 to-violet-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleToggleCompleted(!completed)}
              className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors border cursor-pointer ${
                completed
                  ? 'bg-emerald-500 border-emerald-400 text-white'
                  : 'bg-white/10 border-white/20 hover:bg-white/20'
              }`}
            >
              {completed && <CheckCircle2 className="w-4 h-4" />}
            </button>
            <span className="text-xs font-bold uppercase tracking-wider text-violet-300">
              {completed ? 'Completed Task' : 'Active Task Details'}
            </span>
          </div>

          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Past Due Banner */}
          {(task.completedPastDue || (completed && dueDateTime && new Date(dueDateTime).getTime() < Date.now())) && (
            <div className="bg-amber-50 border border-amber-200/90 rounded-2xl p-3 flex items-center gap-2.5 text-xs text-amber-900 font-medium">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>This activity was completed past due.</span>
            </div>
          )}

          {!completed && dueDateTime && new Date(dueDateTime).getTime() < Date.now() && (
            <div className="bg-rose-50 border border-rose-200/90 rounded-2xl p-3 flex items-center gap-2.5 text-xs text-rose-900 font-medium">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>This task is past due and requires immediate attention.</span>
            </div>
          )}
          {/* Task Category Switcher (Approach 3B Conversion Alert) */}
          <div className="bg-slate-100 p-1 rounded-2xl flex items-center gap-1 border border-slate-200">
            <button
              type="button"
              onClick={() => handleTaskTypeSwitch('regular')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                taskType === 'regular'
                  ? 'bg-violet-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <span>📋 Non-Repetitive Task</span>
            </button>
            <button
              type="button"
              onClick={() => handleTaskTypeSwitch('frequent')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                taskType === 'frequent'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <span>🔁 Repetitive Frequent Activity</span>
            </button>
          </div>

          {/* Task Title */}
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-base font-bold rounded-2xl p-3 outline-none focus:border-violet-600 focus:bg-white transition-all"
            />
          </div>

          {/* Urgency & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CustomDropdown
              label="Urgency Level"
              options={URGENCY_OPTIONS}
              value={urgency}
              onChange={(val) => setUrgency(val as UrgencyLevel)}
            />

            <CustomDropdown
              label="Environmental Realm"
              options={CATEGORY_OPTIONS}
              value={environmentalCategory}
              onChange={(val) => setEnvironmentalCategory(val as EnvironmentalCategory)}
            />
          </div>

          {/* Time Tracking & Metrics */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-violet-600" /> Time Metrics (Planned vs Actual)
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-500 font-medium block mb-1">
                  Intended Duration (mins)
                </label>
                <input
                  type="number"
                  min="0"
                  value={intendedTimeMinutes}
                  onChange={(e) => setIntendedTimeMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-white border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl p-2 outline-none focus:border-violet-600"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 font-medium block mb-1">
                  Actual Spent Time (mins)
                </label>
                <input
                  type="number"
                  min="0"
                  value={actualTimeMinutes}
                  onChange={(e) => setActualTimeMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-white border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl p-2 outline-none focus:border-violet-600"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] text-slate-500 font-medium block mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" /> Target Due Date & Time
              </label>
              <input
                type="datetime-local"
                value={dueDateTime}
                onChange={(e) => setDueDateTime(e.target.value)}
                className="w-full bg-white border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl p-2 outline-none focus:border-violet-600"
              />
            </div>
          </div>

          {/* Frequency Subcategory & Stopwatch Block */}
          <div className="bg-violet-50/70 border border-violet-200/90 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-violet-600" />
                <h4 className="text-xs font-bold text-slate-800">Frequency Subcategory Tag</h4>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={frequencyEnabled}
                  onChange={(e) => handleFrequencyToggle(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-600"></div>
              </label>
            </div>

            {frequencyEnabled && (
              <div className="space-y-3 pt-2 border-t border-violet-200/60">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Repeating Days of the Week <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-1">
                    {(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as DayOfWeek[]).map((day) => {
                      const isSel = frequencyDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            if (isSel) {
                              if (frequencyDays.length > 1) {
                                setFrequencyDays(frequencyDays.filter((d) => d !== day));
                              }
                            } else {
                              setFrequencyDays([...frequencyDays, day]);
                            }
                          }}
                          className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                            isSel
                              ? 'bg-violet-600 text-white'
                              : 'bg-white text-slate-600 border border-slate-200'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Scheduled Time <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      required={frequencyEnabled}
                      value={repeatTime}
                      onChange={(e) => setRepeatTime(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl p-1.5 text-xs text-slate-800 font-bold outline-none focus:border-violet-600"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Add to Stopwatch
                    </label>
                    <button
                      type="button"
                      onClick={() => setAddToStopwatch(!addToStopwatch)}
                      className={`w-full py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                        addToStopwatch
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-white text-slate-500 border-slate-200'
                      }`}
                    >
                      <Timer className="w-3.5 h-3.5" />
                      <span>{addToStopwatch ? 'Yes (Featured)' : 'No'}</span>
                    </button>
                  </div>
                </div>

                {/* Finalize Routine or Reactivate Routine Action Card (Approach 1A, 2A, 4A, 5A) */}
                <div className="pt-2 border-t border-violet-200/60">
                  {!isFinalized ? (
                    <div className="bg-emerald-50/90 border border-emerald-300 rounded-2xl p-3.5 space-y-2.5">
                      <div className="flex items-start gap-2.5">
                        <Repeat className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <h5 className="text-xs font-bold text-emerald-950">Active Recurring Routine</h5>
                          <p className="text-[11px] text-emerald-800 leading-relaxed mt-0.5">
                            To permanently complete this recurring habit, click below. It will assign the <span className="font-bold">#completed</span> tag, stop any active timer, and move it to your <span className="font-bold">{environmentalCategory}</span> Completed archive so it will no longer recur.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowFinalizeModal(true)}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-3 rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Mark as Fully Completed & Finalize</span>
                      </button>
                    </div>
                  ) : (
                    <div className="bg-emerald-100/70 border border-emerald-300 rounded-2xl p-3.5 space-y-2.5">
                      <div className="flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h5 className="text-xs font-black text-emerald-950 uppercase tracking-wider">
                              Routine Fully Finalized & Completed
                            </h5>
                            <span className="text-[10px] bg-emerald-200 text-emerald-900 font-extrabold px-2 py-0.5 rounded-full">
                              Archived in {environmentalCategory}
                            </span>
                          </div>
                          <p className="text-[11px] text-emerald-800 leading-relaxed mt-0.5">
                            This activity has been marked as fully completed and tagged with <span className="font-bold">#completed</span>. It will not recur in your active habit schedule.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleReactivateRoutine}
                        className="w-full bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold text-xs py-2 px-3 rounded-xl transition-all shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4 text-emerald-600" />
                        <span>Reactivate Routine</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Emotional Keywords */}
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
              <Smile className="w-3.5 h-3.5 text-pink-500" /> Emotional Mood & Keywords
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {emotionalKeywords.map((kw) => (
                kw.toLowerCase() === 'completed' ? (
                  <span
                    key={kw}
                    className="text-xs bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded-xl font-extrabold flex items-center gap-1 shadow-2xs"
                    title="System-Reserved Tag: Automatically assigned when completed"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    completed
                    <button
                      type="button"
                      onClick={() => handleRemoveKeyword(kw)}
                      className="text-emerald-700 hover:text-red-600 cursor-pointer ml-1 font-bold"
                      title="Unmark as completed"
                    >
                      ×
                    </button>
                  </span>
                ) : (
                  <span
                    key={kw}
                    className="text-xs bg-pink-50 text-pink-700 border border-pink-200 px-2.5 py-1 rounded-xl font-bold flex items-center gap-1"
                  >
                    #{kw}
                    <button
                      type="button"
                      onClick={() => handleRemoveKeyword(kw)}
                      className="hover:text-red-600 cursor-pointer ml-0.5"
                    >
                      ×
                    </button>
                  </span>
                )
              ))}
            </div>

            {/* Quick Suggestions */}
            <div className="flex flex-wrap gap-1 mb-2">
              {EMOTIONAL_SUGGESTIONS.map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => handleAddKeyword(sug)}
                  className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-0.5 rounded-lg font-semibold transition-colors cursor-pointer"
                >
                  + {sug}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddKeyword(newKeyword))}
                placeholder="Custom emotion/mindset keyword..."
                className="flex-1 bg-slate-50 border border-slate-200 text-xs p-2 rounded-xl outline-none focus:border-violet-600"
              />
              <button
                type="button"
                onClick={() => handleAddKeyword(newKeyword)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-xl cursor-pointer"
              >
                Add
              </button>
            </div>
          </div>

          {/* Bullet Instructions & Notes */}
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-violet-600" /> Key Instructions & Bullet Notes
            </label>
            <InteractiveNoteList
              items={notesBullets}
              onChange={setNotesBullets}
              placeholder="Add instruction, key detail, or note..."
              showProgress={true}
            />
          </div>

          {/* Involved People Link & Inline Creation */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-violet-600" /> Involved People
              </label>
              <button
                type="button"
                onClick={() => setShowAddPersonForm(!showAddPersonForm)}
                className="text-xs text-violet-700 bg-violet-100 hover:bg-violet-200 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Quick Add Person
              </button>
            </div>

            {/* Inline Person Creation Form */}
            {showAddPersonForm && (
              <form onSubmit={handleCreateInlinePerson} className="p-3 bg-violet-50/90 border border-violet-200 rounded-2xl space-y-2 animate-in fade-in duration-150">
                <h5 className="text-xs font-bold text-violet-900">Add & Link New Person</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    value={newPersonName}
                    onChange={(e) => setNewPersonName(e.target.value)}
                    placeholder="Full Name *"
                    className="bg-white border border-slate-200 text-xs text-slate-800 rounded-xl p-2 outline-none focus:border-violet-600 font-bold"
                  />
                  <input
                    type="text"
                    value={newPersonRole}
                    onChange={(e) => setNewPersonRole(e.target.value)}
                    placeholder="Role / Relation (e.g. Designer)"
                    className="bg-white border border-slate-200 text-xs text-slate-800 rounded-xl p-2 outline-none focus:border-violet-600"
                  />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <input
                    type="text"
                    value={newPersonPhone}
                    onChange={(e) => setNewPersonPhone(e.target.value)}
                    placeholder="Phone or contact info (optional)"
                    className="bg-white border border-slate-200 text-xs text-slate-800 rounded-xl p-2 outline-none focus:border-violet-600 flex-1 mr-2"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowAddPersonForm(false)}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2 py-1"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow-2xs cursor-pointer"
                    >
                      Save & Link
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Narrow-down / Search People */}
            {people.length > 3 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={personSearchQuery}
                  onChange={(e) => setPersonSearchQuery(e.target.value)}
                  placeholder="Narrow down existing collaborators..."
                  className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-800 rounded-xl pl-8 pr-3 py-1.5 outline-none focus:border-violet-600"
                />
              </div>
            )}

            {people.length === 0 ? (
              <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-xl border border-slate-200">
                No people created yet. Click "+ Quick Add Person" above to add someone.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 pt-1 max-h-36 overflow-y-auto p-1">
                {filteredPeople.map((p) => {
                  const isLinked = involvedPeopleIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePersonLink(p.id)}
                      className={`text-xs px-3 py-1.5 rounded-xl border font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                        isLinked
                          ? 'bg-violet-50 border-violet-300 text-violet-900 shadow-2xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: p.avatarColor || '#7c3aed' }}
                      />
                      {p.name}
                      {isLinked && <span className="text-violet-600 font-bold">✓</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Notifications & AI Follow-Up Controls */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h5 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  {notificationsEnabled ? (
                    <Bell className="w-4 h-4 text-violet-600" />
                  ) : (
                    <BellOff className="w-4 h-4 text-slate-400" />
                  )}
                  In-App & Phone Notifications for Task
                </h5>
                <p className="text-[11px] text-slate-500">
                  Toggle whether reminders for this task display in app and notification shade
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  notificationsEnabled ? 'bg-violet-600' : 'bg-slate-300'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-md absolute top-0.5 transition-transform ${
                    notificationsEnabled ? 'left-5.5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>

            <CustomDropdown
              label="AI Automated Follow-Up Check-In Frequency"
              options={FOLLOWUP_OPTIONS}
              value={followUpFrequency}
              onChange={(val) => setFollowUpFrequency(val as any)}
            />
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between font-sans">
          <button
            type="button"
            onClick={() => onDeleteTask(task.id)}
            className="text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" /> Delete Task
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-bold text-slate-600 hover:bg-slate-200/60 px-4 py-2 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white px-5 py-2 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog for Finalizing Routine (Approach 5A) */}
      {showFinalizeModal && (
        <div className="fixed inset-0 z-60 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">Finalize This Repetitive Routine?</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Are you sure you want to mark <span className="font-bold text-slate-800">"{title}"</span> as fully completed?
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 space-y-2 text-xs text-slate-700">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>Status changed to <span className="font-bold text-emerald-700">Completed</span></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>Assigned system tag <span className="font-bold text-emerald-700">#completed</span></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>Visible in category <span className="font-bold text-slate-900">{environmentalCategory}</span> Completed archive</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>Active stopwatch timer will be stopped immediately</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>Removed from active recurring schedule</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowFinalizeModal(false)}
                className="text-xs font-bold text-slate-600 hover:bg-slate-100 px-4 py-2.5 rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmFinalize}
                className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm & Finalize</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
