import React, { useState } from 'react';
import {
  X,
  Copy,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Info,
  Users,
  CheckSquare,
  Tag,
  Merge,
  AlertTriangle,
} from 'lucide-react';
import {
  Task,
  Person,
  DuplicateCandidate,
  DuplicateTaskPair,
  DuplicatePersonPair,
  DuplicateTagPair,
} from '../types';
import {
  findDuplicateCandidates,
  executeTaskMerge,
  executePersonMerge,
  executeTagMerge,
} from '../utils/deduplication';

interface MergeDuplicatesModalProps {
  tasks: Task[];
  people: Person[];
  onClose: () => void;
  onUpdateTasks: (updatedTasks: Task[]) => void;
  onUpdatePeople: (updatedPeople: Person[]) => void;
}

export const MergeDuplicatesModal: React.FC<MergeDuplicatesModalProps> = ({
  tasks,
  people,
  onClose,
  onUpdateTasks,
  onUpdatePeople,
}) => {
  const [candidates, setCandidates] = useState<DuplicateCandidate[]>(() =>
    findDuplicateCandidates(tasks, people)
  );
  const [activeFilter, setActiveFilter] = useState<'all' | 'task' | 'person' | 'tag'>('all');
  const [mergedCount, setMergedCount] = useState(0);

  const filteredCandidates = candidates.filter(
    (c) => activeFilter === 'all' || c.type === activeFilter
  );

  const handleMergeSingle = (candidate: DuplicateCandidate) => {
    if (candidate.type === 'task') {
      const mergedTask = executeTaskMerge(candidate.olderTask, candidate.newerTask);
      // Remove older task, replace newer task with mergedTask
      const nextTasks = tasks
        .filter((t) => t.id !== candidate.olderTask.id)
        .map((t) => (t.id === candidate.newerTask.id ? mergedTask : t));

      onUpdateTasks(nextTasks);
    } else if (candidate.type === 'person') {
      const mergedPerson = executePersonMerge(candidate.olderPerson, candidate.newerPerson);
      // Remove older person, replace newer person with mergedPerson
      const nextPeople = people
        .filter((p) => p.id !== candidate.olderPerson.id)
        .map((p) => (p.id === candidate.newerPerson.id ? mergedPerson : p));

      // Re-link any tasks associated with older person ID to newer person ID
      const nextTasks = tasks.map((t) => {
        if (t.involvedPeopleIds?.includes(candidate.olderPerson.id)) {
          const updatedPeopleIds = Array.from(
            new Set([
              ...t.involvedPeopleIds.filter((id) => id !== candidate.olderPerson.id),
              candidate.newerPerson.id,
            ])
          );
          return { ...t, involvedPeopleIds: updatedPeopleIds };
        }
        return t;
      });

      onUpdatePeople(nextPeople);
      onUpdateTasks(nextTasks);
    } else if (candidate.type === 'tag') {
      const nextTasks = executeTagMerge(
        tasks,
        candidate.tagDuplicate,
        candidate.tagCanonical
      );
      onUpdateTasks(nextTasks);
    }

    // Remove candidate from list
    setCandidates((prev) => prev.filter((c) => c.id !== candidate.id));
    setMergedCount((prev) => prev + 1);
  };

  const handleMergeAll = () => {
    let currentTasks = [...tasks];
    let currentPeople = [...people];

    candidates.forEach((candidate) => {
      if (candidate.type === 'task') {
        const mergedTask = executeTaskMerge(candidate.olderTask, candidate.newerTask);
        currentTasks = currentTasks
          .filter((t) => t.id !== candidate.olderTask.id)
          .map((t) => (t.id === candidate.newerTask.id ? mergedTask : t));
      } else if (candidate.type === 'person') {
        const mergedPerson = executePersonMerge(candidate.olderPerson, candidate.newerPerson);
        currentPeople = currentPeople
          .filter((p) => p.id !== candidate.olderPerson.id)
          .map((p) => (p.id === candidate.newerPerson.id ? mergedPerson : p));

        currentTasks = currentTasks.map((t) => {
          if (t.involvedPeopleIds?.includes(candidate.olderPerson.id)) {
            const updatedPeopleIds = Array.from(
              new Set([
                ...t.involvedPeopleIds.filter((id) => id !== candidate.olderPerson.id),
                candidate.newerPerson.id,
              ])
            );
            return { ...t, involvedPeopleIds: updatedPeopleIds };
          }
          return t;
        });
      } else if (candidate.type === 'tag') {
        currentTasks = executeTagMerge(
          currentTasks,
          candidate.tagDuplicate,
          candidate.tagCanonical
        );
      }
    });

    onUpdateTasks(currentTasks);
    onUpdatePeople(currentPeople);

    setMergedCount((prev) => prev + candidates.length);
    setCandidates([]);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto font-sans">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 my-6 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-violet-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-violet-500/20 text-violet-300 flex items-center justify-center border border-violet-400/30">
              <Merge className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">Review & Merge Duplicates</h3>
              <p className="text-[11px] text-violet-200 font-medium">
                Detect & depurate duplicated tasks, contacts, or tags
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Disclaimer Bar */}
        <div className="px-6 py-3 bg-amber-50 border-b border-amber-200/80 text-amber-900 text-xs flex items-start gap-2 shrink-0">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="leading-snug">
            <strong className="font-bold">Merging Policy:</strong> The newer entry takes precedence for primary fields (title, status, urgency). All non-overlapping data—such as extra bullet notes, emotional tags, and linked people—will be safely preserved and merged.
          </p>
        </div>

        {/* Filter Bar & Bulk Actions */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0 flex-wrap">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveFilter('all')}
              className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                activeFilter === 'all'
                  ? 'bg-violet-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
              }`}
            >
              All ({candidates.length})
            </button>
            <button
              onClick={() => setActiveFilter('task')}
              className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1 ${
                activeFilter === 'task'
                  ? 'bg-violet-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              Tasks ({candidates.filter((c) => c.type === 'task').length})
            </button>
            <button
              onClick={() => setActiveFilter('person')}
              className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1 ${
                activeFilter === 'person'
                  ? 'bg-violet-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              People ({candidates.filter((c) => c.type === 'person').length})
            </button>
            <button
              onClick={() => setActiveFilter('tag')}
              className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1 ${
                activeFilter === 'tag'
                  ? 'bg-violet-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              Tags ({candidates.filter((c) => c.type === 'tag').length})
            </button>
          </div>

          {candidates.length > 0 && (
            <button
              onClick={handleMergeAll}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Approve All Merges
            </button>
          )}
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {candidates.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">Your Workspace is Depurated & Clean!</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No duplicate tasks, contacts, or tags detected.
                {mergedCount > 0 && ` You successfully merged ${mergedCount} item(s)!`}
              </p>
            </div>
          ) : (
            filteredCandidates.map((candidate) => {
              if (candidate.type === 'task') {
                const pair = candidate as DuplicateTaskPair;
                return (
                  <div
                    key={pair.id}
                    className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-violet-100 text-violet-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckSquare className="w-3 h-3" /> Duplicate Task Pair
                      </span>
                      <span className="text-[11px] text-amber-700 font-semibold bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                        {pair.similarityReason}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs">
                      {/* Older Entry */}
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Older Entry
                        </span>
                        <h5 className="font-bold text-slate-700 line-clamp-2">{pair.olderTask.title}</h5>
                        <p className="text-[11px] text-slate-500">
                          Urgency: {pair.olderTask.urgency} • Realm: {pair.olderTask.environmentalCategory}
                        </p>
                        {pair.olderTask.notesBullets?.length > 0 && (
                          <p className="text-[10px] text-slate-500 italic">
                            + {pair.olderTask.notesBullets.length} note bullet(s)
                          </p>
                        )}
                      </div>

                      {/* Newer Entry (Precedence) */}
                      <div className="space-y-1 sm:border-l sm:border-slate-200 sm:pl-3">
                        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">
                          Newer Entry (Precedence)
                        </span>
                        <h5 className="font-bold text-slate-900 line-clamp-2">{pair.newerTask.title}</h5>
                        <p className="text-[11px] text-slate-600">
                          Urgency: {pair.newerTask.urgency} • Realm: {pair.newerTask.environmentalCategory}
                        </p>
                        {pair.newerTask.notesBullets?.length > 0 && (
                          <p className="text-[10px] text-slate-500 italic">
                            + {pair.newerTask.notesBullets.length} note bullet(s)
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => handleMergeSingle(candidate)}
                        className="bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-2xs flex items-center gap-1.5 cursor-pointer transition-all"
                      >
                        <Merge className="w-3.5 h-3.5" /> Approve & Merge Task Pair
                      </button>
                    </div>
                  </div>
                );
              }

              if (candidate.type === 'person') {
                const pair = candidate as DuplicatePersonPair;
                return (
                  <div
                    key={pair.id}
                    className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-violet-100 text-violet-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Users className="w-3 h-3" /> Duplicate Contact Pair
                      </span>
                      <span className="text-[11px] text-amber-700 font-semibold bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                        {pair.similarityReason}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs">
                      {/* Older Entry */}
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Older Entry
                        </span>
                        <h5 className="font-bold text-slate-700">{pair.olderPerson.name}</h5>
                        <p className="text-[11px] text-slate-500">{pair.olderPerson.roleOrRelation}</p>
                        {pair.olderPerson.notes && (
                          <p className="text-[10px] text-slate-500 line-clamp-1 italic">
                            "{pair.olderPerson.notes}"
                          </p>
                        )}
                      </div>

                      {/* Newer Entry */}
                      <div className="space-y-1 sm:border-l sm:border-slate-200 sm:pl-3">
                        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">
                          Newer Entry (Precedence)
                        </span>
                        <h5 className="font-bold text-slate-900">{pair.newerPerson.name}</h5>
                        <p className="text-[11px] text-slate-600">{pair.newerPerson.roleOrRelation}</p>
                        {pair.newerPerson.notes && (
                          <p className="text-[10px] text-slate-500 line-clamp-1 italic">
                            "{pair.newerPerson.notes}"
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => handleMergeSingle(candidate)}
                        className="bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-2xs flex items-center gap-1.5 cursor-pointer transition-all"
                      >
                        <Merge className="w-3.5 h-3.5" /> Approve & Merge Contact Pair
                      </button>
                    </div>
                  </div>
                );
              }

              if (candidate.type === 'tag') {
                const pair = candidate as DuplicateTagPair;
                return (
                  <div
                    key={pair.id}
                    className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-violet-100 text-violet-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Tag className="w-3 h-3" /> Tag Casing Variation
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Used in {pair.affectedTaskIds.length} task(s)
                      </span>
                    </div>

                    <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs">
                      <span className="bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 rounded-lg font-bold">
                        #{pair.tagDuplicate}
                      </span>
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg font-bold">
                        #{pair.tagCanonical} (Canonical)
                      </span>
                    </div>

                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => handleMergeSingle(candidate)}
                        className="bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-2xs flex items-center gap-1.5 cursor-pointer transition-all"
                      >
                        <Merge className="w-3.5 h-3.5" /> Standardize Tag Format
                      </button>
                    </div>
                  </div>
                );
              }

              return null;
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 font-sans">
          <span className="text-xs text-slate-500">
            {candidates.length} remaining duplicate candidate group(s)
          </span>

          <button
            onClick={onClose}
            className="text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white px-5 py-2 rounded-xl shadow-2xs cursor-pointer transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
