import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Plus,
  Search,
  Filter,
  Bell,
  BellOff,
  User,
  Tag,
  AlertTriangle,
  Smile,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Minimize2,
  Maximize2,
  Sparkles,
  Timer,
  Calendar,
  Repeat,
  CheckSquare,
  Square,
} from 'lucide-react';
import { Task, Person, UrgencyLevel, EnvironmentalCategory, DayOfWeek, TaskFrequency } from '../types';
import { calculateDynamicUrgency, getRandomAvatarColor, normalizeTaskCompletedTags } from '../utils/storage';
import { normalizeNoteItems } from '../utils/notesHelper';
import { CustomDropdown, DropdownOption } from './CustomDropdown';

interface TaskListViewProps {
  tasks: Task[];
  people: Person[];
  onSelectTask: (task: Task) => void;
  onUpdateTask?: (updatedTask: Task) => void;
  onToggleComplete: (taskId: string) => void;
  onToggleFrequentToday?: (taskId: string, dateStr: string) => void;
  onToggleNotification: (taskId: string) => void;
  onAddNewTask: (newTask: Partial<Task>) => void;
  onAddNewPerson?: (newPerson: Partial<Person>) => Person | void;
  simulatedOffsetMs?: number;
}

const CATEGORIES: ('All' | EnvironmentalCategory)[] = [
  'All',
  'Work',
  'College/School',
  'Self Growth',
  'Home & Family',
  'Health & Fitness',
  'Finance',
  'Social & Relationships',
  'Creative',
  'Errands & Admin',
  'Side Project',
  'Travel & Leisure',
  'Hobbies & Leisure',
];

const URGENCY_OPTIONS: DropdownOption<UrgencyLevel>[] = [
  { value: 'Low', label: 'Low Urgency', emoji: '🌱' },
  { value: 'Medium', label: 'Medium Urgency', emoji: '📅' },
  { value: 'Urgent', label: 'Urgent (< 24h)', emoji: '🔥' },
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

const MOOD_OPTIONS = [
  { emoji: '😊', label: 'Content' },
  { emoji: '🔥', label: 'Energetic' },
  { emoji: '🧘', label: 'Calm' },
  { emoji: '💪', label: 'Productive' },
  { emoji: '⚡', label: 'Motivated' },
  { emoji: '🎯', label: 'Focused' },
  { emoji: '🌱', label: 'Mindful' },
  { emoji: '❤️', label: 'Grateful' },
];

export const TaskListView: React.FC<TaskListViewProps> = ({
  tasks,
  people,
  onSelectTask,
  onUpdateTask,
  onToggleComplete,
  onToggleFrequentToday,
  onToggleNotification,
  onAddNewTask,
  onAddNewPerson,
  simulatedOffsetMs = 0,
}) => {
  const [driverFilter, setDriverFilter] = useState<'all' | 'regular' | 'frequent'>('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'completed' | 'all'>('active');
  const [completedDrawerExpanded, setCompletedDrawerExpanded] = useState(false);
  const [selectedUrgency, setSelectedUrgency] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedTag, setSelectedTag] = useState<string>('All');
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalTab, setModalTab] = useState<'regular' | 'frequent'>('regular');
  const [minimizedTaskIds, setMinimizedTaskIds] = useState<Set<string>>(new Set());
  const [finalizeTargetTask, setFinalizeTargetTask] = useState<Task | null>(null);

  // Compute tag frequencies from task inventory
  const allTaskTags = React.useMemo(() => {
    const tagMap = new Map<string, number>();
    tasks.forEach((t) => {
      t.emotionalKeywords?.forEach((kw) => {
        const clean = kw.trim();
        if (clean) {
          tagMap.set(clean, (tagMap.get(clean) || 0) + 1);
        }
      });
    });
    return Array.from(tagMap.entries()).sort((a, b) => b[1] - a[1]);
  }, [tasks]);

  // Collapsible section states for Stacked View
  const [regularSectionExpanded, setRegularSectionExpanded] = useState(true);
  const [frequentSectionExpanded, setFrequentSectionExpanded] = useState(true);

  // Form states for manual add
  const [newTitle, setNewTitle] = useState('');
  const [newUrgency, setNewUrgency] = useState<UrgencyLevel>('Medium');
  const [newCategory, setNewCategory] = useState<EnvironmentalCategory>('Work');
  const [newIntendedMins, setNewIntendedMins] = useState(30);
  const [newInvolvedPeopleIds, setNewInvolvedPeopleIds] = useState<string[]>([]);

  // Frequent Activity Form State
  const [frequentMood, setFrequentMood] = useState<string>('😊');
  const [frequentKeywords, setFrequentKeywords] = useState<string[]>(['Routine', 'Health']);
  const [newKeywordInput, setNewKeywordInput] = useState('');

  // Frequency Subcategory Form state
  const [enableFrequency, setEnableFrequency] = useState(false);
  const [frequencyDays, setFrequencyDays] = useState<DayOfWeek[]>(['Mon', 'Wed', 'Fri']);
  const [repeatTime, setRepeatTime] = useState('09:00');
  const [addToStopwatch, setAddToStopwatch] = useState(true);

  // Inline Person creation in Quick Add
  const [showInlineAddPerson, setShowInlineAddPerson] = useState(false);
  const [inlinePersonName, setInlinePersonName] = useState('');
  const [inlinePersonRole, setInlinePersonRole] = useState('');

  const refTime = Date.now() + simulatedOffsetMs;
  const todayStr = new Date(refTime).toISOString().split('T')[0];

  const handleConfirmFinalizeTask = (taskToFinalize: Task) => {
    const updatedKeywords = taskToFinalize.emotionalKeywords?.some((k) => k.toLowerCase() === 'completed')
      ? (taskToFinalize.emotionalKeywords || [])
      : [...(taskToFinalize.emotionalKeywords || []), 'completed'];

    const updatedFrequency: TaskFrequency = {
      enabled: true,
      daysOfWeek: taskToFinalize.frequency?.daysOfWeek || ['Mon', 'Wed', 'Fri'],
      repeatTime: taskToFinalize.frequency?.repeatTime || '09:00',
      addToStopwatch: taskToFinalize.frequency?.addToStopwatch ?? true,
      stopwatchTargetMinutes: taskToFinalize.frequency?.stopwatchTargetMinutes || taskToFinalize.intendedTimeMinutes || 30,
      isFinalized: true,
      finalizedAt: new Date(Date.now() + simulatedOffsetMs).toISOString(),
    };

    const finalizedTask: Task = {
      ...taskToFinalize,
      completed: true,
      completedAt: new Date(Date.now() + simulatedOffsetMs).toISOString(),
      frequency: updatedFrequency,
      emotionalKeywords: updatedKeywords,
    };

    if (onUpdateTask) {
      onUpdateTask(normalizeTaskCompletedTags(finalizedTask).task);
    } else {
      onToggleComplete(taskToFinalize.id);
    }
    setFinalizeTargetTask(null);
  };

  const filteredTasks = tasks.filter((t) => {
    const isFrequent = t.taskType === 'frequent';
    const isRepetitiveFreq = isFrequent && Boolean(t.frequency?.enabled);
    const isFinalized = Boolean(t.frequency?.isFinalized) || (isFrequent && t.completed);

    // Status Filter (Approach 1A & 2A):
    // Active tasks: regular tasks that are not completed, and repetitive routines that are not finalized
    if (statusFilter === 'active') {
      if (t.completed || isFinalized) return false;
    }
    // Completed tasks: any regular task or repetitive routine that is completed / finalized
    if (statusFilter === 'completed') {
      if (!t.completed && !isFinalized) return false;
    }

    // Driver filter (Approach 3A: Strict Dual-Condition Filter)
    if (driverFilter === 'regular' && isRepetitiveFreq) return false;
    if (driverFilter === 'frequent' && !isRepetitiveFreq) return false;

    const dynamicUrgency = calculateDynamicUrgency(t, refTime);
    const matchesUrgency =
      selectedUrgency === 'All' ||
      dynamicUrgency === selectedUrgency ||
      (selectedUrgency === 'Urgent' && dynamicUrgency === 'ASAP') ||
      (selectedUrgency === 'Low' && dynamicUrgency === 'None-Low');
    const matchesCategory = selectedCategory === 'All' || t.environmentalCategory === selectedCategory;
    const matchesTag =
      selectedTag === 'All' ||
      t.emotionalKeywords?.some((k) => k.toLowerCase() === selectedTag.toLowerCase());
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.notesBullets.some((n) => n.toLowerCase().includes(searchQuery.toLowerCase())) ||
      t.emotionalKeywords.some((k) => k.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesUrgency && matchesCategory && matchesTag && matchesSearch;
  });

  const toggleMinimizeTask = (taskId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setMinimizedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const toggleMinimizeAll = () => {
    if (minimizedTaskIds.size === filteredTasks.length && filteredTasks.length > 0) {
      setMinimizedTaskIds(new Set());
    } else {
      setMinimizedTaskIds(new Set(filteredTasks.map((t) => t.id)));
    }
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    if (modalTab === 'frequent' || enableFrequency) {
      const frequencyData: TaskFrequency = {
        enabled: true,
        daysOfWeek: frequencyDays.length > 0 ? frequencyDays : ['Mon', 'Wed', 'Fri'],
        repeatTime: repeatTime || '09:00',
        addToStopwatch,
        stopwatchTargetMinutes: Number(newIntendedMins) || 30,
      };

      onAddNewTask({
        title: newTitle.trim(),
        taskType: 'frequent',
        urgency: 'Low',
        dueDateTime: null,
        environmentalCategory: newCategory,
        intendedTimeMinutes: Number(newIntendedMins) || 30,
        actualTimeMinutes: 0,
        completed: false,
        moodEmoji: frequentMood,
        emotionalKeywords: frequentKeywords.length > 0 ? frequentKeywords : ['Routine'],
        notesBullets: [],
        involvedPeopleIds: newInvolvedPeopleIds,
        notificationsEnabled: true,
        followUpFrequency: 'daily',
        completionHistory: [],
        reminders: [],
        frequency: frequencyData,
      });
    } else {
      onAddNewTask({
        title: newTitle.trim(),
        taskType: 'regular',
        urgency: newUrgency,
        environmentalCategory: newCategory,
        intendedTimeMinutes: Number(newIntendedMins) || 30,
        actualTimeMinutes: 0,
        completed: false,
        emotionalKeywords: ['Focus'],
        notesBullets: [],
        involvedPeopleIds: newInvolvedPeopleIds,
        notificationsEnabled: true,
        followUpFrequency: 'auto',
        reminders: [],
        frequency: undefined,
      });
    }

    setNewTitle('');
    setNewInvolvedPeopleIds([]);
    setEnableFrequency(false);
    setShowAddModal(false);
  };

  const handleCreateInlinePerson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlinePersonName.trim()) return;

    if (onAddNewPerson) {
      const created = onAddNewPerson({
        name: inlinePersonName.trim(),
        roleOrRelation: inlinePersonRole.trim() || 'Collaborator',
        avatarColor: getRandomAvatarColor(),
      });

      if (created && created.id) {
        setNewInvolvedPeopleIds((prev) => [...prev, created.id]);
      }
    }

    setInlinePersonName('');
    setInlinePersonRole('');
    setShowInlineAddPerson(false);
  };

  const togglePersonSelect = (personId: string) => {
    if (newInvolvedPeopleIds.includes(personId)) {
      setNewInvolvedPeopleIds(newInvolvedPeopleIds.filter((id) => id !== personId));
    } else {
      setNewInvolvedPeopleIds([...newInvolvedPeopleIds, personId]);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative font-sans">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 shrink-0 shadow-2xs">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-bold text-slate-800">Task Inventory</h2>
            <p className="text-xs text-slate-500 font-medium">
              {filteredTasks.length} task{filteredTasks.length === 1 ? '' : 's'} shown • Categorized by Urgency & Realm
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMinimizeAll}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              title="Toggle minimize view on all tasks"
            >
              {minimizedTaskIds.size === filteredTasks.length && filteredTasks.length > 0 ? (
                <>
                  <Maximize2 className="w-3.5 h-3.5" /> Expand All
                </>
              ) : (
                <>
                  <Minimize2 className="w-3.5 h-3.5" /> Minimize All
                </>
              )}
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="bg-violet-600 hover:bg-violet-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add Task
            </button>
          </div>
        </div>

        {/* DRIVER TABS: Regular Tasks vs Frequent Activities */}
        <div className="flex items-center gap-2 mb-2 bg-slate-100 p-1 rounded-2xl border border-slate-200/80">
          <button
            onClick={() => setDriverFilter('all')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              driverFilter === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            All Inventory
          </button>
          <button
            onClick={() => setDriverFilter('regular')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              driverFilter === 'regular'
                ? 'bg-white text-violet-700 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Regular Tasks</span>
            <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.2 rounded-full font-bold">
              {tasks.filter((t) => (t.taskType !== 'frequent' || !t.frequency?.enabled) && (!t.completed || statusFilter !== 'active')).length}
            </span>
          </button>
          <button
            onClick={() => setDriverFilter('frequent')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              driverFilter === 'frequent'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Repeat className="w-3.5 h-3.5 text-emerald-600" />
            <span>Frequent Activities</span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full font-bold">
              {tasks.filter((t) => t.taskType === 'frequent' && t.frequency?.enabled).length}
            </span>
          </button>
        </div>

        {/* STATUS VIEW TABS (Approach 3A: Default Active To-Do, Dedicated Completed Section) */}
        <div className="flex items-center gap-1.5 mb-3 bg-slate-50 p-1 rounded-xl border border-slate-200/80">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider px-2">View:</span>
          <button
            onClick={() => setStatusFilter('active')}
            className={`flex-1 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              statusFilter === 'active'
                ? 'bg-violet-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <span>Active</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${statusFilter === 'active' ? 'bg-white/20 text-white' : 'bg-violet-100 text-violet-800'}`}>
              {tasks.filter((t) => !t.completed || t.taskType === 'frequent').length}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('completed')}
            className={`flex-1 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              statusFilter === 'completed'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Completed Records</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${statusFilter === 'completed' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
              {tasks.filter((t) => t.completed && t.taskType !== 'frequent').length}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('all')}
            className={`flex-1 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              statusFilter === 'all'
                ? 'bg-slate-800 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <span>All ({tasks.length})</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks by title, instructions, keywords, or people..."
            className="w-full bg-slate-100 focus:bg-white border border-slate-200 focus:border-violet-600 text-xs text-slate-800 rounded-xl pl-9 pr-3 py-2 outline-none transition-all"
          />
        </div>

        {/* Urgency Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Urgency:</span>
          {['All', 'Past Due', 'Urgent', 'Medium', 'Low'].map((urg) => (
            <button
              key={urg}
              onClick={() => setSelectedUrgency(urg)}
              className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer shrink-0 ${
                selectedUrgency === urg
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {urg === 'Past Due'
                ? '⚠️ Past Due'
                : urg === 'Urgent'
                ? '🔥 Urgent'
                : urg === 'Medium'
                ? '📅 Medium'
                : urg === 'Low'
                ? '🌱 Low'
                : 'All'}
            </button>
          ))}
        </div>

        {/* Category Realm & Tag Grid Dropdown Menu */}
        <div className="relative pt-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-xs">
            {/* Tag Grid Dropdown Hint Button */}
            <button
              onClick={() => setTagDropdownOpen(!tagDropdownOpen)}
              className={`px-3 py-1.5 rounded-xl font-extrabold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 border ${
                tagDropdownOpen || selectedCategory !== 'All' || selectedTag !== 'All'
                  ? 'bg-violet-600 text-white border-violet-500 shadow-xs'
                  : 'bg-slate-100 text-slate-700 border-slate-200/80 hover:bg-slate-200'
              }`}
              title="Click to toggle Tag Grid & Category Filter Menu"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>
                {selectedCategory !== 'All'
                  ? `Realm: ${selectedCategory}`
                  : selectedTag !== 'All'
                  ? `Tag: #${selectedTag}`
                  : 'Tags & Categories'}
              </span>
              {(selectedCategory !== 'All' || selectedTag !== 'All') && (
                <span className="text-[10px] bg-white/25 text-white px-1.5 py-0.2 rounded-full font-black">
                  1
                </span>
              )}
              {tagDropdownOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {/* Clear Filter Button if active */}
            {(selectedCategory !== 'All' || selectedTag !== 'All') && (
              <button
                onClick={() => {
                  setSelectedCategory('All');
                  setSelectedTag('All');
                }}
                className="text-xs text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded-xl font-bold cursor-pointer shrink-0 transition-colors"
              >
                Clear Filters ×
              </button>
            )}

            <div className="h-4 w-px bg-slate-200 shrink-0 mx-0.5" />

            {/* Quick Category Pills */}
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat);
                  setSelectedTag('All');
                }}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer shrink-0 ${
                  selectedCategory === cat && selectedTag === 'All'
                    ? 'bg-slate-800 text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Collapsible Dropdown Tag Grid Menu - Adjustable & Scrollable */}
          {tagDropdownOpen && (
            <div className="mt-3 bg-white border border-slate-200/90 rounded-2xl shadow-md p-4 space-y-4 max-h-[55vh] sm:max-h-[65vh] overflow-y-auto scrollbar-thin animate-in fade-in slide-in-from-top-1 duration-150 relative z-10">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-violet-600 shrink-0" />
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                      Tag & Realm Filter Palette
                    </h4>
                    <p className="text-[10px] text-slate-500 font-medium">
                      Select any tag or category to filter your task inventory instantly
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {(selectedCategory !== 'All' || selectedTag !== 'All') && (
                    <button
                      onClick={() => {
                        setSelectedCategory('All');
                        setSelectedTag('All');
                      }}
                      className="text-[11px] font-bold text-red-600 hover:underline cursor-pointer"
                    >
                      Reset Filters
                    </button>
                  )}
                  <button
                    onClick={() => setTagDropdownOpen(false)}
                    className="text-slate-400 hover:text-slate-600 text-xs font-bold p-1 cursor-pointer bg-slate-100 hover:bg-slate-200 rounded-lg"
                    title="Close palette"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* SECTION 1: EMOTIONAL & SYSTEM TAGS GRID */}
              {allTaskTags.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Smile className="w-3.5 h-3.5 text-pink-500" /> Emotional & Context Tags Grid
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-0.5">
                    {allTaskTags.map(([tag, count]) => {
                      const isCompletedTag = tag.toLowerCase() === 'completed';
                      const isSelected = selectedTag.toLowerCase() === tag.toLowerCase();

                      return (
                        <button
                          key={tag}
                          onClick={() => {
                            setSelectedTag(isSelected ? 'All' : tag);
                            setSelectedCategory('All');
                          }}
                          className={`text-xs px-2.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                            isSelected
                              ? 'bg-slate-900 text-white border-slate-800 shadow-2xs'
                              : isCompletedTag
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100'
                          }`}
                        >
                          {isCompletedTag && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                          <span>#{tag}</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : isCompletedTag
                              ? 'bg-emerald-200 text-emerald-900'
                              : 'bg-pink-200 text-pink-800'
                          }`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SECTION 2: CATEGORIES GRID */}
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Environmental Realms
                </p>
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-0.5">
                  {CATEGORIES.map((cat) => {
                    const count = cat === 'All'
                      ? tasks.length
                      : tasks.filter((t) => t.environmentalCategory === cat).length;
                    return (
                      <button
                        key={cat}
                        onClick={() => {
                          setSelectedCategory(cat);
                          setSelectedTag('All');
                        }}
                        className={`text-xs px-2.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                          selectedCategory === cat && selectedTag === 'All'
                            ? 'bg-violet-600 text-white border-violet-500 shadow-2xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span>{cat}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                          selectedCategory === cat && selectedTag === 'All'
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-200 text-slate-600'
                        }`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Task List Content - Collapsible Stacked Sections */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {filteredTasks.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-2 mt-4">
            <Sparkles className="w-8 h-8 text-violet-400 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">No matching items found</h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Try adjusting your search keywords or filters, or click a section "+ Add" button to create a new entry.
            </p>
          </div>
        ) : (
          <>
            {/* SECTION 1: NON-REPETITIVE REGULAR TASKS */}
            {(driverFilter === 'all' || driverFilter === 'regular') && (
              <div className="bg-white border border-violet-200/90 rounded-2xl overflow-hidden shadow-2xs">
                {/* Section Header */}
                <div
                  onClick={() => setRegularSectionExpanded(!regularSectionExpanded)}
                  className="bg-gradient-to-r from-violet-50/90 via-slate-50 to-white px-4 py-3 border-b border-violet-100 flex items-center justify-between cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2.5">
                    <button type="button" className="text-violet-600 hover:text-violet-800 p-0.5">
                      {regularSectionExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-black uppercase tracking-wider text-violet-950">
                          Non-Repetitive Tasks
                        </h3>
                        {/* Minimalist Badge Counter (Approach 4B) */}
                        <span className="text-[10px] bg-violet-100 text-violet-800 font-extrabold px-2 py-0.5 rounded-full">
                          {tasks.filter((t) => t.taskType !== 'frequent' && !t.completed).length} active
                        </span>
                        {tasks.filter((t) => t.taskType !== 'frequent' && t.completed).length > 0 && (
                          <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full">
                            {tasks.filter((t) => t.taskType !== 'frequent' && t.completed).length} completed
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Standard tasks with target due dates, urgency ratings & estimated durations
                      </p>
                    </div>
                  </div>

                  {/* Contextual Header Plus Button (Approach 5A) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setModalTab('regular');
                      setShowAddModal(true);
                    }}
                    className="bg-violet-600 hover:bg-violet-700 text-white px-2.5 py-1.5 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1 transition-all cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Task</span>
                  </button>
                </div>

                {/* Regular Tasks Body */}
                {regularSectionExpanded && (
                  <div className="p-3 space-y-2.5">
                    {tasks.filter((t) => t.taskType !== 'frequent').length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2 text-center">
                        No non-repetitive regular tasks present.
                      </p>
                    ) : filteredTasks.filter((t) => t.taskType !== 'frequent').length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2 text-center">
                        No regular tasks match the active filters.
                      </p>
                    ) : (
                      filteredTasks
                        .filter((t) => t.taskType !== 'frequent')
                        .map((task) => {
                          const dynamicUrgency = calculateDynamicUrgency(task, refTime);
                          const isMinimized = minimizedTaskIds.has(task.id);
                          const involvedPeople = people.filter((p) => task.involvedPeopleIds?.includes(p.id));
                          const wasCompletedPastDue =
                            task.completedPastDue || (task.completed && dynamicUrgency === 'Past Due');

                          return (
                            <div
                              key={task.id}
                              className={`bg-white border rounded-2xl p-3.5 transition-all border-slate-200/90 hover:shadow-md ${
                                task.completed ? 'opacity-65 bg-slate-50/80' : ''
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                {/* Left Checkbox & Title */}
                                <div className="flex items-start gap-3 min-w-0 flex-1">
                                  <button
                                    onClick={() => onToggleComplete(task.id)}
                                    className={`mt-0.5 w-5 h-5 rounded-lg border flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
                                      task.completed
                                        ? 'bg-emerald-500 border-emerald-500 text-white'
                                        : 'border-slate-300 hover:border-violet-500 bg-slate-50'
                                    }`}
                                  >
                                    {task.completed && <CheckCircle2 className="w-3.5 h-3.5" />}
                                  </button>

                                  <div className="min-w-0 flex-1 space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h4
                                        onClick={() => onSelectTask(task)}
                                        className={`text-sm font-bold text-slate-800 hover:text-violet-600 transition-colors cursor-pointer ${
                                          task.completed ? 'line-through text-slate-400' : ''
                                        }`}
                                      >
                                        {task.title}
                                      </h4>

                                      <span
                                        className={`text-[10px] px-2 py-0.5 rounded-md font-extrabold uppercase tracking-wider flex items-center gap-1 ${
                                          dynamicUrgency === 'Past Due'
                                            ? 'bg-rose-100 text-rose-800 border border-rose-200/80'
                                            : dynamicUrgency === 'Urgent' || dynamicUrgency === 'ASAP'
                                            ? 'bg-amber-100 text-amber-800 border border-amber-200/80'
                                            : dynamicUrgency === 'Medium'
                                            ? 'bg-blue-100 text-blue-800 border border-blue-200/80'
                                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200/80'
                                        }`}
                                      >
                                        {dynamicUrgency === 'Past Due' && '⚠️ '}
                                        {dynamicUrgency === 'Urgent' || dynamicUrgency === 'ASAP' ? '🔥 ' : ''}
                                        {dynamicUrgency === 'Medium' ? '📅 ' : ''}
                                        {dynamicUrgency === 'Low' || dynamicUrgency === 'None-Low' ? '🌱 ' : ''}
                                        {dynamicUrgency === 'ASAP'
                                          ? 'Urgent'
                                          : dynamicUrgency === 'None-Low'
                                          ? 'Low'
                                          : dynamicUrgency}
                                      </span>

                                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold">
                                        {task.environmentalCategory}
                                      </span>
                                    </div>

                                    {/* Emotional Keywords */}
                                    {task.emotionalKeywords && task.emotionalKeywords.length > 0 && (
                                      <div className="flex items-center gap-1 flex-wrap pt-0.5">
                                        {task.emotionalKeywords.map((kw, i) => (
                                          kw.toLowerCase() === 'completed' ? (
                                            <span
                                              key={i}
                                              className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.2 rounded-md flex items-center gap-1 shadow-2xs"
                                              title="System-Reserved Tag: Managed automatically when task is completed"
                                            >
                                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                              completed
                                            </span>
                                          ) : (
                                            <span
                                              key={i}
                                              className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded-md"
                                            >
                                              #{kw}
                                            </span>
                                          )
                                        ))}
                                      </div>
                                    )}

                                    {/* Past Due Alerts */}
                                    {wasCompletedPastDue && (
                                      <div className="mt-1 bg-amber-50/90 border border-amber-200/80 rounded-xl px-2.5 py-1 flex items-center gap-1.5 text-[11px] text-amber-900 font-medium">
                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                        <span>Activity was completed past due</span>
                                      </div>
                                    )}

                                    {!task.completed && dynamicUrgency === 'Past Due' && (
                                      <div className="mt-1 bg-rose-50 border border-rose-200/90 rounded-xl px-2.5 py-1 flex items-center gap-1.5 text-[11px] text-rose-900 font-medium">
                                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                        <span>Overdue item — needs attention</span>
                                      </div>
                                    )}

                                    {!isMinimized && (
                                      <div className="space-y-1.5 pt-1 animate-in fade-in duration-150">
                                        {task.notesBullets.length > 0 && (() => {
                                          const normalized = normalizeNoteItems(task.notesBullets);
                                          const completedCount = normalized.filter((n) => n.completed).length;
                                          return (
                                            <div className="space-y-1">
                                              {normalized.length > 1 && (
                                                <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                                  <span>Sub-checklist ({completedCount}/{normalized.length})</span>
                                                </div>
                                              )}
                                              <ul className="text-xs text-slate-600 space-y-1">
                                                {normalized.map((item) => (
                                                  <li key={item.id} className="flex items-center gap-1.5 group">
                                                    <button
                                                      type="button"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (onUpdateTask) {
                                                          const updated = normalized.map((n) =>
                                                            n.id === item.id ? { ...n, completed: !n.completed } : n
                                                          );
                                                          onUpdateTask({ ...task, notesBullets: updated });
                                                        }
                                                      }}
                                                      className={`cursor-pointer transition-colors shrink-0 ${
                                                        item.completed
                                                          ? 'text-emerald-600'
                                                          : 'text-slate-300 hover:text-violet-600'
                                                      }`}
                                                      title={item.completed ? 'Mark uncompleted' : 'Mark completed'}
                                                    >
                                                      {item.completed ? (
                                                        <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                                                      ) : (
                                                        <Square className="w-3.5 h-3.5" />
                                                      )}
                                                    </button>
                                                    <span
                                                      className={`text-xs ${
                                                        item.completed
                                                          ? 'line-through text-slate-400 font-normal'
                                                          : 'text-slate-700 font-medium'
                                                      }`}
                                                    >
                                                      {item.text}
                                                    </span>
                                                  </li>
                                                ))}
                                              </ul>
                                            </div>
                                          );
                                        })()}

                                        {involvedPeople.length > 0 && (
                                          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">
                                              People:
                                            </span>
                                            {involvedPeople.map((p) => (
                                              <span
                                                key={p.id}
                                                className="text-[11px] bg-violet-50 text-violet-900 border border-violet-200 px-2 py-0.5 rounded-lg font-bold flex items-center gap-1"
                                              >
                                                <span
                                                  className="w-2 h-2 rounded-full"
                                                  style={{ backgroundColor: p.avatarColor || '#7c3aed' }}
                                                />
                                                {p.name}
                                              </span>
                                            ))}
                                          </div>
                                        )}

                                        <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1">
                                          <span className="flex items-center gap-1 font-semibold text-slate-600">
                                            <Clock className="w-3 h-3 text-violet-600" />
                                            {task.intendedTimeMinutes}m intended
                                            {task.actualTimeMinutes > 0 && ` (${task.actualTimeMinutes}m spent)`}
                                          </span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Right Controls */}
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={(e) => toggleMinimizeTask(task.id, e)}
                                    title={isMinimized ? 'Expand details' : 'Minimize card'}
                                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                  >
                                    {isMinimized ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                                  </button>

                                  <button
                                    onClick={() => onToggleNotification(task.id)}
                                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                      task.notificationsEnabled
                                        ? 'text-violet-600 bg-violet-50 hover:bg-violet-100'
                                        : 'text-slate-300 hover:text-slate-500'
                                    }`}
                                  >
                                    {task.notificationsEnabled ? (
                                      <Bell className="w-4 h-4" />
                                    ) : (
                                      <BellOff className="w-4 h-4" />
                                    )}
                                  </button>

                                  <button
                                    onClick={() => onSelectTask(task)}
                                    className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                    title="Open full details"
                                  >
                                    <ChevronRight className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        }))}
                  </div>
                )}
              </div>
            )}

            {/* SECTION 2: REPETITIVE FREQUENT ACTIVITIES */}
            {(driverFilter === 'all' || driverFilter === 'frequent') && (
              <div className="bg-white border border-emerald-200/90 rounded-2xl overflow-hidden shadow-2xs">
                {/* Section Header */}
                <div
                  onClick={() => setFrequentSectionExpanded(!frequentSectionExpanded)}
                  className="bg-gradient-to-r from-emerald-50/90 via-slate-50 to-white px-4 py-3 border-b border-emerald-100 flex items-center justify-between cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2.5">
                    <button type="button" className="text-emerald-600 hover:text-emerald-800 p-0.5">
                      {frequentSectionExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-black uppercase tracking-wider text-emerald-950 flex items-center gap-1">
                          <Repeat className="w-3.5 h-3.5 text-emerald-600" /> Repetitive Frequent Activities
                        </h3>
                        {/* Minimalist Badge Counter (Approach 4B) */}
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full">
                          {tasks.filter((t) => t.taskType === 'frequent' && !t.completed && !t.frequency?.isFinalized).length} habits
                        </span>
                        <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-full">
                          {
                            tasks
                              .filter((t) => t.taskType === 'frequent' && !t.completed && !t.frequency?.isFinalized)
                              .filter(
                                (t) =>
                                  t.completionHistory?.includes(todayStr) ||
                                  (t.completed && t.completedAt?.startsWith(todayStr))
                              ).length
                          }{' '}
                          done today
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Continuous routines & daily habits with mood drivers and automated check-ins
                      </p>
                    </div>
                  </div>

                  {/* Contextual Header Plus Button (Approach 5A) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setModalTab('frequent');
                      setShowAddModal(true);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1 transition-all cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Activity</span>
                  </button>
                </div>

                {/* Frequent Activities Body */}
                {frequentSectionExpanded && (
                  <div className="p-3 space-y-2.5">
                    {tasks.filter((t) => t.taskType === 'frequent').length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2 text-center">
                        No repetitive frequent activities created yet. Click "+ Add Activity" above to create your first habit!
                      </p>
                    ) : filteredTasks.filter((t) => t.taskType === 'frequent').length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2 text-center">
                        No frequent activities match the active filters.
                      </p>
                    ) : (
                      filteredTasks
                        .filter((t) => t.taskType === 'frequent')
                        .map((task) => {
                          const isMinimized = minimizedTaskIds.has(task.id);
                          const involvedPeople = people.filter((p) => task.involvedPeopleIds?.includes(p.id));
                          const isDoneToday =
                            task.completionHistory?.includes(todayStr) ||
                            (task.completed && task.completedAt?.startsWith(todayStr));

                          return (
                            <div
                              key={task.id}
                              className="bg-white border rounded-2xl p-3.5 transition-all border-emerald-200/90 bg-emerald-50/10 hover:shadow-md"
                            >
                              <div className="flex items-start justify-between gap-3">
                                {/* Left Checkbox & Habit Prompt */}
                                <div className="flex items-start gap-3 min-w-0 flex-1">
                                  <button
                                    onClick={() => {
                                      if (onToggleFrequentToday) {
                                        onToggleFrequentToday(task.id, todayStr);
                                      } else {
                                        onToggleComplete(task.id);
                                      }
                                    }}
                                    className={`mt-0.5 w-5 h-5 rounded-lg border flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
                                      isDoneToday
                                        ? 'bg-emerald-500 border-emerald-500 text-white'
                                        : 'border-slate-300 hover:border-emerald-500 bg-slate-50'
                                    }`}
                                  >
                                    {isDoneToday && <CheckCircle2 className="w-3.5 h-3.5" />}
                                  </button>

                                  <div className="min-w-0 flex-1 space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h4
                                        onClick={() => onSelectTask(task)}
                                        className="text-sm font-bold text-slate-800 hover:text-emerald-700 transition-colors cursor-pointer"
                                      >
                                        {task.title}
                                      </h4>

                                      <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md font-extrabold uppercase tracking-wider flex items-center gap-1">
                                        <Repeat className="w-3 h-3 text-emerald-600" /> Frequent Activity
                                      </span>

                                      <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                                        <span>{task.moodEmoji || '🧘'}</span>
                                        <span>Mood</span>
                                      </span>

                                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold">
                                        {task.environmentalCategory}
                                      </span>
                                    </div>

                                    {/* Emotional Keywords */}
                                    {task.emotionalKeywords && task.emotionalKeywords.length > 0 && (
                                      <div className="flex items-center gap-1 flex-wrap pt-0.5">
                                        {task.emotionalKeywords.map((kw, i) => (
                                          kw.toLowerCase() === 'completed' ? (
                                            <span
                                              key={i}
                                              className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.2 rounded-md flex items-center gap-1 shadow-2xs"
                                              title="System-Reserved Tag: Managed automatically when task is completed"
                                            >
                                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                              completed
                                            </span>
                                          ) : (
                                            <span
                                              key={i}
                                              className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded-md"
                                            >
                                              #{kw}
                                            </span>
                                          )
                                        ))}
                                      </div>
                                    )}

                                    {/* Daily Check-In Bar */}
                                    <div
                                      className={`mt-2 p-2.5 rounded-2xl border transition-all ${
                                        isDoneToday
                                          ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                                          : 'bg-violet-50/90 border-violet-200 text-violet-950'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between flex-wrap gap-2">
                                        <div className="flex items-center gap-2">
                                          <span className="text-lg">{task.moodEmoji || '🧘'}</span>
                                          <div>
                                            <p className="text-xs font-bold flex items-center gap-1.5">
                                              {isDoneToday ? (
                                                <span className="text-emerald-800 flex items-center gap-1 font-extrabold">
                                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Completed
                                                  for Today!
                                                </span>
                                              ) : (
                                                <span className="text-violet-900 flex items-center gap-1 font-extrabold">
                                                  <Sparkles className="w-3.5 h-3.5 text-violet-600" /> Did you do this
                                                  activity today?
                                                </span>
                                              )}
                                            </p>
                                            <p className="text-[11px] text-slate-500 font-medium">
                                              {isDoneToday
                                                ? `Logged today • ${
                                                    task.completionHistory?.length || 1
                                                  } total completions recorded`
                                                : 'Awaiting your check-in today • Non-stop habit'}
                                            </p>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-2 flex-wrap">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (onToggleFrequentToday) {
                                                onToggleFrequentToday(task.id, todayStr);
                                              } else {
                                                onToggleComplete(task.id);
                                              }
                                            }}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs flex items-center gap-1 ${
                                              isDoneToday
                                                ? 'bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
                                                : 'bg-violet-600 hover:bg-violet-700 text-white shadow-xs'
                                            }`}
                                          >
                                            {isDoneToday ? 'Undo Today' : '✓ Mark Done Today'}
                                          </button>

                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setFinalizeTargetTask(task);
                                            }}
                                            className="px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-900 shadow-2xs flex items-center gap-1.5"
                                            title="Mark as fully completed: assigns #completed tag, stops active stopwatch timer, and moves routine to category Completed archive"
                                          >
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                            <span>Finalize Routine</span>
                                          </button>
                                        </div>
                                      </div>
                                    </div>

                                    {!isMinimized && (
                                      <div className="space-y-1.5 pt-1 animate-in fade-in duration-150">
                                        {task.notesBullets.length > 0 && (() => {
                                          const normalized = normalizeNoteItems(task.notesBullets);
                                          const completedCount = normalized.filter((n) => n.completed).length;
                                          return (
                                            <div className="space-y-1">
                                              {normalized.length > 1 && (
                                                <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                                  <span>Sub-checklist ({completedCount}/{normalized.length})</span>
                                                </div>
                                              )}
                                              <ul className="text-xs text-slate-600 space-y-1">
                                                {normalized.map((item) => (
                                                  <li key={item.id} className="flex items-center gap-1.5 group">
                                                    <button
                                                      type="button"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (onUpdateTask) {
                                                          const updated = normalized.map((n) =>
                                                            n.id === item.id ? { ...n, completed: !n.completed } : n
                                                          );
                                                          onUpdateTask({ ...task, notesBullets: updated });
                                                        }
                                                      }}
                                                      className={`cursor-pointer transition-colors shrink-0 ${
                                                        item.completed
                                                          ? 'text-emerald-600'
                                                          : 'text-slate-300 hover:text-emerald-600'
                                                      }`}
                                                      title={item.completed ? 'Mark uncompleted' : 'Mark completed'}
                                                    >
                                                      {item.completed ? (
                                                        <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                                                      ) : (
                                                        <Square className="w-3.5 h-3.5" />
                                                      )}
                                                    </button>
                                                    <span
                                                      className={`text-xs ${
                                                        item.completed
                                                          ? 'line-through text-slate-400 font-normal'
                                                          : 'text-slate-700 font-medium'
                                                      }`}
                                                    >
                                                      {item.text}
                                                    </span>
                                                  </li>
                                                ))}
                                              </ul>
                                            </div>
                                          );
                                        })()}

                                        {involvedPeople.length > 0 && (
                                          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">
                                              People:
                                            </span>
                                            {involvedPeople.map((p) => (
                                              <span
                                                key={p.id}
                                                className="text-[11px] bg-emerald-50 text-emerald-900 border border-emerald-200 px-2 py-0.5 rounded-lg font-bold flex items-center gap-1"
                                              >
                                                <span
                                                  className="w-2 h-2 rounded-full"
                                                  style={{ backgroundColor: p.avatarColor || '#10b981' }}
                                                />
                                                {p.name}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Right Controls */}
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={(e) => toggleMinimizeTask(task.id, e)}
                                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                  >
                                    {isMinimized ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                                  </button>

                                  <button
                                    onClick={() => onToggleNotification(task.id)}
                                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                      task.notificationsEnabled
                                        ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                                        : 'text-slate-300 hover:text-slate-500'
                                    }`}
                                  >
                                    {task.notificationsEnabled ? (
                                      <Bell className="w-4 h-4" />
                                    ) : (
                                      <BellOff className="w-4 h-4" />
                                    )}
                                  </button>

                                  <button
                                    onClick={() => onSelectTask(task)}
                                    className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                    title="Open full details"
                                  >
                                    <ChevronRight className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        }))}
                  </div>
                )}
              </div>
            )}
            {/* SECTION 3: COMPLETED TASKS & ARCHIVE DRAWER (Approach 3A) */}
            {statusFilter === 'active' && tasks.some((t) => t.completed || Boolean(t.frequency?.isFinalized)) && (
              <div className="bg-white border border-emerald-200/90 rounded-2xl overflow-hidden shadow-2xs mt-4">
                <div
                  onClick={() => setCompletedDrawerExpanded(!completedDrawerExpanded)}
                  className="bg-gradient-to-r from-emerald-50/90 via-slate-50 to-white px-4 py-3 border-b border-emerald-100 flex items-center justify-between cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2.5">
                    <button type="button" className="text-emerald-700 hover:text-emerald-900 p-0.5">
                      {completedDrawerExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-black uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Completed Tasks Archive
                        </h3>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full">
                          {tasks.filter((t) => t.completed || Boolean(t.frequency?.isFinalized)).length} completed
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Completed tasks automatically hidden from main To-Do list. Tagged <span className="text-emerald-700 font-bold">#completed</span> across each realm.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setStatusFilter('completed');
                    }}
                    className="text-xs text-emerald-700 hover:text-emerald-900 font-bold underline cursor-pointer"
                  >
                    View All Completed →
                  </button>
                </div>

                {completedDrawerExpanded && (
                  <div className="p-3 space-y-2 bg-slate-50/60">
                    {tasks
                      .filter((t) => t.completed || Boolean(t.frequency?.isFinalized))
                      .slice(0, 15)
                      .map((task) => (
                        <div
                          key={task.id}
                          className="bg-white border border-slate-200/80 rounded-xl p-2.5 flex items-center justify-between hover:border-emerald-300 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <button
                              onClick={() => onToggleComplete(task.id)}
                              className="w-5 h-5 rounded-md bg-emerald-500 text-white flex items-center justify-center cursor-pointer shrink-0"
                              title="Click to unmark task as completed"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-700 line-through truncate">{task.title}</p>
                              <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                                <span className="text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded font-extrabold flex items-center gap-1">
                                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" /> completed
                                </span>
                                <span className="text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded font-bold">
                                  {task.environmentalCategory}
                                </span>
                                {(task.taskType === 'frequent' || task.frequency?.isFinalized) && (
                                  <span className="text-emerald-900 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded font-extrabold flex items-center gap-0.5">
                                    <Repeat className="w-2.5 h-2.5 text-emerald-600" /> Finalized Routine
                                  </span>
                                )}
                                {task.completedAt && (
                                  <span className="text-slate-400 font-medium">
                                    Done: {new Date(task.completedAt).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => onSelectTask(task)}
                            className="text-xs text-slate-500 hover:text-violet-700 font-bold px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            Inspect Notes
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Manual Quick Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">Add New Entry</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* DUAL TAB SWITCHER (Approach 3B) */}
            <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => setModalTab('regular')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  modalTab === 'regular'
                    ? 'bg-white text-violet-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Regular Task
              </button>
              <button
                type="button"
                onClick={() => setModalTab('frequent')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  modalTab === 'frequent'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Repeat className="w-3.5 h-3.5 text-emerald-600" />
                <span>Frequent Activity</span>
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3 font-sans">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  {modalTab === 'frequent' ? 'Activity Name' : 'Task Title'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={
                    modalTab === 'frequent'
                      ? 'e.g., Morning Meditate & Journaling...'
                      : 'e.g., Review project proposal with Sarah...'
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-bold outline-none focus:border-violet-600 focus:bg-white"
                />
              </div>

              {/* FREQUENT ACTIVITY TAB FIELDS */}
              {modalTab === 'frequent' ? (
                <>
                  <div className="bg-emerald-50/80 border border-emerald-200 p-3 rounded-2xl space-y-2">
                    <p className="text-[11px] text-emerald-900 font-semibold leading-relaxed">
                      💡 <strong>Frequent Activities</strong> run indefinitely without due dates or urgency pressure. Each day, Violet will send a notification asking if you completed it!
                    </p>

                    <div>
                      <label className="text-xs font-bold text-emerald-950 block mb-1.5">
                        Emotional Mood Driver
                      </label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {MOOD_OPTIONS.map((m) => (
                          <button
                            key={m.emoji}
                            type="button"
                            onClick={() => setFrequentMood(m.emoji)}
                            className={`p-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer border ${
                              frequentMood === m.emoji
                                ? 'bg-white border-emerald-500 text-emerald-900 shadow-xs scale-105'
                                : 'bg-emerald-100/50 border-emerald-200 text-slate-700 hover:bg-white'
                            }`}
                          >
                            <span className="text-lg">{m.emoji}</span>
                            <span className="text-[9px] truncate max-w-full">{m.label.split(' ')[0]}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-emerald-950 block mb-1">
                        Keywords / Tags
                      </label>
                      <div className="flex gap-1.5 mb-1.5">
                        <input
                          type="text"
                          value={newKeywordInput}
                          onChange={(e) => setNewKeywordInput(e.target.value)}
                          placeholder="Add keyword (e.g., Routine, Wellness)..."
                          className="flex-1 bg-white border border-emerald-200 text-xs p-1.5 rounded-xl outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!newKeywordInput.trim()) return;
                            if (!frequentKeywords.includes(newKeywordInput.trim())) {
                              setFrequentKeywords([...frequentKeywords, newKeywordInput.trim()]);
                            }
                            setNewKeywordInput('');
                          }}
                          className="bg-emerald-700 text-white font-bold text-xs px-3 rounded-xl cursor-pointer"
                        >
                          Add
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {frequentKeywords.map((kw, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full font-bold flex items-center gap-1"
                          >
                            #{kw}
                            <button
                              type="button"
                              onClick={() => setFrequentKeywords(frequentKeywords.filter((k) => k !== kw))}
                              className="hover:text-red-700 cursor-pointer"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <CustomDropdown
                      label="Realm Category"
                      options={CATEGORY_OPTIONS}
                      value={newCategory}
                      onChange={(val) => setNewCategory(val as EnvironmentalCategory)}
                    />
                    <div>
                      <label className="text-xs font-bold text-slate-600 block mb-1">
                        Intended Time (Mins)
                      </label>
                      <input
                        type="number"
                        value={newIntendedMins}
                        onChange={(e) => setNewIntendedMins(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-800 font-sans outline-none focus:border-violet-600"
                      />
                    </div>
                  </div>
                </>
              ) : (
                /* REGULAR TASK TAB FIELDS */
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <CustomDropdown
                      label="Urgency"
                      options={URGENCY_OPTIONS}
                      value={newUrgency}
                      onChange={(val) => setNewUrgency(val as UrgencyLevel)}
                    />

                    <CustomDropdown
                      label="Realm"
                      options={CATEGORY_OPTIONS}
                      value={newCategory}
                      onChange={(val) => setNewCategory(val as EnvironmentalCategory)}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">
                      Intended Duration (Minutes)
                    </label>
                    <input
                      type="number"
                      value={newIntendedMins}
                      onChange={(e) => setNewIntendedMins(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-800 font-sans outline-none focus:border-violet-600"
                    />
                  </div>
                </>
              )}

              {/* Frequency Subcategory Section */}
              <div className="bg-violet-50/70 border border-violet-200/80 rounded-2xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-violet-600" />
                    <span className="text-xs font-bold text-slate-800">Frequency Subcategory Tag</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableFrequency}
                      onChange={(e) => setEnableFrequency(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-600"></div>
                  </label>
                </div>

                {enableFrequency && (
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
                          required={enableFrequency}
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
                  </div>
                )}
              </div>

              {/* People Selection / Inline Add */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-600">Assign People <span className="text-slate-400 text-[10px]">(Optional)</span></label>
                  <button
                    type="button"
                    onClick={() => setShowInlineAddPerson(!showInlineAddPerson)}
                    className="text-[11px] font-bold text-violet-700 hover:underline cursor-pointer"
                  >
                    + Quick Add Person
                  </button>
                </div>

                {showInlineAddPerson && (
                  <div className="p-2.5 bg-violet-50/80 border border-violet-200 rounded-xl space-y-2 mb-2">
                    <input
                      type="text"
                      value={inlinePersonName}
                      onChange={(e) => setInlinePersonName(e.target.value)}
                      placeholder="Full Name *"
                      className="w-full bg-white border border-slate-200 text-xs p-1.5 rounded-lg outline-none font-bold"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={inlinePersonRole}
                        onChange={(e) => setInlinePersonRole(e.target.value)}
                        placeholder="Role / Relation (optional)"
                        className="flex-1 bg-white border border-slate-200 text-xs p-1.5 rounded-lg outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleCreateInlinePerson}
                        className="bg-violet-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                )}

                {people.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pt-1">
                    {people.map((p) => {
                      const isSelected = newInvolvedPeopleIds.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => togglePersonSelect(p.id)}
                          className={`text-xs px-2.5 py-1 rounded-xl border font-bold flex items-center gap-1 transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-violet-50 border-violet-300 text-violet-900 shadow-2xs'
                              : 'bg-slate-50 border-slate-200 text-slate-600'
                          }`}
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: p.avatarColor || '#7c3aed' }}
                          />
                          {p.name}
                          {isSelected && ' ✓'}
                        </button>
                      );
                    })}
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
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Finalizing Repetitive Task (Approach 5A) */}
      {finalizeTargetTask && (
        <div className="fixed inset-0 z-60 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">Finalize This Repetitive Routine?</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Are you sure you want to mark <span className="font-bold text-slate-800">"{finalizeTargetTask.title}"</span> as fully completed?
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
                <span>Visible in category <span className="font-bold text-slate-900">{finalizeTargetTask.environmentalCategory}</span> Completed archive</span>
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
                onClick={() => setFinalizeTargetTask(null)}
                className="text-xs font-bold text-slate-600 hover:bg-slate-100 px-4 py-2.5 rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmFinalizeTask(finalizeTargetTask)}
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
