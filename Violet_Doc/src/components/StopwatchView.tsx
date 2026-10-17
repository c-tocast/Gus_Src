import React, { useState, useEffect } from 'react';
import {
  Timer,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Plus,
  Calendar,
  Clock,
  Sparkles,
  Tag,
  AlertTriangle,
  Zap,
  Filter,
} from 'lucide-react';
import { Task, Person, DayOfWeek, EnvironmentalCategory, UrgencyLevel, ActiveTimerState } from '../types';
import { calculateDynamicUrgency, getTimerElapsedSeconds } from '../utils/storage';

interface StopwatchViewProps {
  tasks: Task[];
  people: Person[];
  onUpdateTask: (updatedTask: Task) => void;
  onAddNewTask: (newTask: Partial<Task>) => void;
  simulatedOffsetMs?: number;
  timers: Record<string, ActiveTimerState>;
  onUpdateTimers: React.Dispatch<React.SetStateAction<Record<string, ActiveTimerState>>>;
}

const DAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const StopwatchView: React.FC<StopwatchViewProps> = ({
  tasks,
  people,
  onUpdateTask,
  onAddNewTask,
  simulatedOffsetMs = 0,
  timers,
  onUpdateTimers,
}) => {
  // Filter state
  const [filterMode, setFilterMode] = useState<'all' | 'today' | 'pending' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 1-second UI refresh timer
  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Quick task creation modal/form
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<EnvironmentalCategory>('Work');
  const [urgency, setUrgency] = useState<UrgencyLevel>('Medium');
  const [targetMinutes, setTargetMinutes] = useState(25);
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>(['Mon', 'Wed', 'Fri']);
  const [repeatTime, setRepeatTime] = useState('09:00');

  // Stopwatch-enabled tasks filter
  const stopwatchTasks = tasks.filter((t) => {
    // A task is stopwatch-tagged if frequency?.addToStopwatch is true OR if it has a frequency configured
    const isStopwatchTagged = t.frequency?.addToStopwatch || (t.frequency?.enabled ?? false);

    if (!isStopwatchTagged) return false;

    // Apply text search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!t.title.toLowerCase().includes(q)) return false;
    }

    if (filterMode === 'pending') return !t.completed && !t.frequency?.isFinalized;
    if (filterMode === 'completed') return t.completed || Boolean(t.frequency?.isFinalized);
    if (filterMode === 'today') {
      if (t.completed || t.frequency?.isFinalized) return false;
      const todayDayStr = new Date(Date.now() + simulatedOffsetMs).toLocaleDateString('en-US', {
        weekday: 'short',
      }) as DayOfWeek;
      const days = t.frequency?.daysOfWeek || [];
      return days.includes(todayDayStr) || days.length === 0;
    }

    return true;
  });

  // Timer Controls with Delta Calculation
  const getTimerState = (task: Task): ActiveTimerState => {
    if (timers[task.id]) return timers[task.id];

    const targetSecs = (task.frequency?.stopwatchTargetMinutes || task.intendedTimeMinutes || 25) * 60;
    const initialElapsed = Math.min((task.actualTimeMinutes || 0) * 60, targetSecs);
    return {
      taskId: task.id,
      isRunning: false,
      startTimeMs: null,
      accumulatedSeconds: initialElapsed,
      targetSeconds: targetSecs,
    };
  };

  const handleStart = (task: Task) => {
    const currentState = getTimerState(task);
    const now = Date.now();
    const currentElapsed = getTimerElapsedSeconds(currentState, now);

    onUpdateTimers((prev) => ({
      ...prev,
      [task.id]: {
        ...currentState,
        taskId: task.id,
        accumulatedSeconds: currentElapsed >= currentState.targetSeconds ? 0 : currentElapsed,
        startTimeMs: now,
        isRunning: true,
        completedInStopwatch: false,
      },
    }));
  };

  const handlePause = (task: Task) => {
    const currentState = getTimerState(task);
    const now = Date.now();
    const currentElapsed = getTimerElapsedSeconds(currentState, now);

    onUpdateTimers((prev) => ({
      ...prev,
      [task.id]: {
        ...currentState,
        taskId: task.id,
        accumulatedSeconds: currentElapsed,
        startTimeMs: null,
        isRunning: false,
      },
    }));
  };

  const handleReset = (task: Task) => {
    const targetSecs = (task.frequency?.stopwatchTargetMinutes || task.intendedTimeMinutes || 25) * 60;
    onUpdateTimers((prev) => ({
      ...prev,
      [task.id]: {
        taskId: task.id,
        accumulatedSeconds: 0,
        startTimeMs: null,
        isRunning: false,
        targetSeconds: targetSecs,
        completedInStopwatch: false,
      },
    }));
  };

  const handleCompleteTask = (task: Task) => {
    const currentState = getTimerState(task);
    const currentElapsed = getTimerElapsedSeconds(currentState, nowMs);
    const elapsedMins = Math.max(1, Math.ceil(currentElapsed / 60));

    onUpdateTimers((prev) => ({
      ...prev,
      [task.id]: {
        ...currentState,
        taskId: task.id,
        accumulatedSeconds: currentElapsed,
        startTimeMs: null,
        isRunning: false,
      },
    }));

    const nextCompleted = !task.completed;
    const isRepetitive = task.taskType === 'frequent' || Boolean(task.frequency?.enabled);
    const updatedFrequency = isRepetitive && task.frequency
      ? {
          ...task.frequency,
          isFinalized: nextCompleted,
          finalizedAt: nextCompleted ? new Date().toISOString() : null,
        }
      : task.frequency;

    onUpdateTask({
      ...task,
      completed: nextCompleted,
      completedAt: nextCompleted ? new Date().toISOString() : null,
      actualTimeMinutes: task.completed ? task.actualTimeMinutes : (task.actualTimeMinutes || 0) + elapsedMins,
      frequency: updatedFrequency,
    });
  };

  const handleAdjustTime = (task: Task, deltaMinutes: number) => {
    const currentState = getTimerState(task);
    const newTarget = Math.max(60, currentState.targetSeconds + deltaMinutes * 60);

    onUpdateTimers((prev) => ({
      ...prev,
      [task.id]: {
        ...currentState,
        taskId: task.id,
        targetSeconds: newTarget,
      },
    }));

    onUpdateTask({
      ...task,
      intendedTimeMinutes: Math.round(newTarget / 60),
      frequency: task.frequency
        ? { ...task.frequency, stopwatchTargetMinutes: Math.round(newTarget / 60) }
        : undefined,
    });
  };

  const handleCreateStopwatchTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onAddNewTask({
      title: title.trim(),
      urgency,
      environmentalCategory: category,
      intendedTimeMinutes: targetMinutes,
      actualTimeMinutes: 0,
      completed: false,
      emotionalKeywords: ['Stopwatch Focus', 'Scheduled'],
      notesBullets: [`Frequency schedule: ${selectedDays.join(', ')} at ${repeatTime}`],
      notificationsEnabled: true,
      frequency: {
        enabled: true,
        daysOfWeek: selectedDays,
        repeatTime: repeatTime || '09:00',
        addToStopwatch: true,
        stopwatchTargetMinutes: targetMinutes,
      },
    });

    setTitle('');
    setShowAddModal(false);
  };

  const toggleDaySelection = (day: DayOfWeek) => {
    if (selectedDays.includes(day)) {
      if (selectedDays.length === 1) return; // Keep at least one
      setSelectedDays(selectedDays.filter((d) => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const formatTimeDisplay = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative overflow-y-auto p-4 space-y-4">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 rounded-3xl p-5 text-white shadow-md relative overflow-hidden">
        <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20">
              <Timer className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                Stopwatch & Timer Center
              </h2>
              <p className="text-xs text-indigo-100">
                Track frequency-tagged activities with live interactive timers.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-indigo-900 font-bold text-xs shadow-sm hover:bg-indigo-50 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 text-indigo-600" />
            <span>Add Stopwatch Activity</span>
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-white/15 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              filterMode === 'all'
                ? 'bg-white text-indigo-950 font-bold shadow-xs'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            All Stopwatch ({tasks.filter((t) => t.frequency?.addToStopwatch || t.frequency?.enabled).length})
          </button>
          <button
            onClick={() => setFilterMode('today')}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              filterMode === 'today'
                ? 'bg-white text-indigo-950 font-bold shadow-xs'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            Scheduled Today
          </button>
          <button
            onClick={() => setFilterMode('pending')}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              filterMode === 'pending'
                ? 'bg-white text-indigo-950 font-bold shadow-xs'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setFilterMode('completed')}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              filterMode === 'completed'
                ? 'bg-white text-indigo-950 font-bold shadow-xs'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            Completed
          </button>
        </div>
      </div>

      {/* Task Stopwatch List */}
      <div className="space-y-3">
        {stopwatchTasks.length === 0 ? (
          <div className="bg-white border border-slate-200/90 rounded-3xl p-8 text-center space-y-3 shadow-2xs">
            <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 mx-auto flex items-center justify-center">
              <Timer className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">No Stopwatch Activities Found</h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
                You can tag any task with a repeating frequency & stopwatch timer or add a new one directly.
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 text-white font-bold text-xs shadow-sm hover:bg-violet-700 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Stopwatch Task</span>
            </button>
          </div>
        ) : (
          stopwatchTasks.map((task) => {
            const timerState = getTimerState(task);
            const elapsedSecs = getTimerElapsedSeconds(timerState, nowMs);
            const remainingSecs = Math.max(0, timerState.targetSeconds - elapsedSecs);
            const progressPercent = Math.min(
              100,
              Math.round((elapsedSecs / timerState.targetSeconds) * 100)
            );
            const isCompleted = task.completed;

            return (
              <div
                key={task.id}
                className={`bg-white border transition-all rounded-3xl p-4 space-y-3 shadow-2xs ${
                  isCompleted
                    ? 'border-emerald-200 bg-emerald-50/20'
                    : timerState.isRunning
                    ? 'border-violet-300 ring-2 ring-violet-400/20 shadow-md'
                    : 'border-slate-200/90 hover:border-slate-300'
                }`}
              >
                {/* Header info */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700 border border-violet-200">
                        {task.environmentalCategory}
                      </span>
                      {task.frequency?.enabled && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {task.frequency.daysOfWeek.join(', ')} @ {task.frequency.repeatTime}
                        </span>
                      )}
                      {task.frequency?.isFinalized ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Routine Finalized
                        </span>
                      ) : isCompleted ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Completed
                        </span>
                      ) : null}
                    </div>
                    <h3
                      className={`text-sm font-bold text-slate-800 ${
                        isCompleted ? 'line-through text-slate-500' : ''
                      }`}
                    >
                      {task.title}
                    </h3>
                  </div>

                  {/* Quick time add / subtract */}
                  {!isCompleted && (
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
                      <button
                        onClick={() => handleAdjustTime(task, -5)}
                        className="px-2 py-0.5 rounded-lg bg-white text-slate-700 font-bold hover:bg-slate-200 text-[10px] shadow-2xs"
                        title="Subtract 5 mins"
                      >
                        -5m
                      </button>
                      <button
                        onClick={() => handleAdjustTime(task, 5)}
                        className="px-2 py-0.5 rounded-lg bg-white text-slate-700 font-bold hover:bg-slate-200 text-[10px] shadow-2xs"
                        title="Add 5 mins"
                      >
                        +5m
                      </button>
                    </div>
                  )}
                </div>

                {/* Digital Display & Controls Box */}
                <div className="bg-slate-900 rounded-2xl p-4 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="text-center sm:text-left">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                        Remaining Time
                      </span>
                      <span
                        className={`text-2xl sm:text-3xl font-black font-mono tracking-wider ${
                          remainingSecs <= 60 && !isCompleted ? 'text-amber-400 animate-pulse' : 'text-white'
                        }`}
                      >
                        {formatTimeDisplay(remainingSecs)}
                      </span>
                    </div>

                    <div className="h-8 w-px bg-slate-800 hidden sm:block" />

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                        Target Duration
                      </span>
                      <span className="text-xs font-semibold text-slate-300">
                        {Math.round(timerState.targetSeconds / 60)} mins (Spent:{' '}
                        {Math.round(elapsedSecs / 60)}m)
                      </span>
                    </div>
                  </div>

                  {/* Stopwatch Action Buttons */}
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    {!isCompleted && (
                      <>
                        {timerState.isRunning ? (
                          <button
                            onClick={() => handlePause(task)}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition-all cursor-pointer shadow-sm"
                          >
                            <Pause className="w-4 h-4 fill-current" />
                            <span>Pause</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleStart(task)}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition-all cursor-pointer shadow-sm"
                          >
                            <Play className="w-4 h-4 fill-current" />
                            <span>Start</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleReset(task)}
                          className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-all cursor-pointer"
                          title="Reset Stopwatch"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => handleCompleteTask(task)}
                      className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm ${
                        isCompleted
                          ? 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                          : 'bg-violet-600 text-white hover:bg-violet-500'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isCompleted ? 'Mark Active' : 'Complete'}</span>
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                    <span>Progress: {progressPercent}%</span>
                    <span>
                      {Math.round(elapsedSecs / 60)} / {Math.round(timerState.targetSeconds / 60)} min
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        isCompleted ? 'bg-emerald-500' : 'bg-gradient-to-r from-violet-600 to-indigo-600'
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Quick Add Stopwatch Task Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-xl border border-slate-100 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Timer className="w-5 h-5 text-violet-600" />
                <span>New Stopwatch Activity</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateStopwatchTask} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Activity Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Morning Cardio & Stretching"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as EnvironmentalCategory)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                  >
                    <option value="Work">Work</option>
                    <option value="Health & Fitness">Health & Fitness</option>
                    <option value="Self Growth">Self Growth</option>
                    <option value="College/School">College/School</option>
                    <option value="Creative">Creative</option>
                    <option value="Errands & Admin">Errands & Admin</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Timer Target (Mins)</label>
                  <input
                    type="number"
                    min={1}
                    max={480}
                    value={targetMinutes}
                    onChange={(e) => setTargetMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>

              {/* Mandatory Frequency Fields */}
              <div className="bg-violet-50/60 border border-violet-100 rounded-2xl p-3.5 space-y-3">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-violet-600" />
                  <span className="text-xs font-bold text-violet-900">Frequency & Schedule Tag</span>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1.5">
                    Repeating Days of the Week *
                  </label>
                  <div className="flex items-center gap-1">
                    {DAYS.map((day) => {
                      const isSelected = selectedDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleDaySelection(day)}
                          className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-violet-600 text-white shadow-xs'
                              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Scheduled Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={repeatTime}
                    onChange={(e) => setRepeatTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-violet-600 text-white font-bold text-xs shadow-sm hover:bg-violet-700 transition-all cursor-pointer"
                >
                  Save & Launch Stopwatch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
