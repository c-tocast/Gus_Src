import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  AlertCircle,
  HelpCircle,
  UserPlus,
  CheckSquare,
  Clock,
  ArrowRight,
  Bot,
  User,
  Loader2,
  RefreshCw,
  History,
  Plus,
  Trash2,
  X,
  MessageSquare,
  Calendar,
  HeartHandshake,
  Merge,
  PhoneCall,
  ExternalLink,
  ShieldAlert,
  Copy,
  Check,
  AlertTriangle,
  Terminal,
} from 'lucide-react';
import { ChatMessage, Task, Person, ChatSession } from '../types';
import { calculateDynamicUrgency } from '../utils/storage';

/**
 * Dedicated Diagnostic & Graceful Status Pill UI (Approach 2A & 5B)
 * Renders an animated countdown & 1-click retry pill during 503/high-demand spikes,
 * or standard diagnostic card with error code copy for other faults.
 */
const ErrorDiagnosticCard: React.FC<{
  msg: ChatMessage;
  onRetry?: (text: string) => void;
  onLoadPrompt?: (text: string) => void;
}> = ({ msg, onRetry, onLoadPrompt }) => {
  const [copied, setCopied] = useState(false);
  const errorCode = msg.errorCode || 'ERR_UNKNOWN_WORKFLOW_FAIL';
  const isDemandSpike =
    errorCode === 'ERR_MODEL_HIGH_DEMAND' ||
    errorCode === 'ERR_HTTP_503' ||
    errorCode === 'ERR_QUOTA_EXCEEDED';

  const [countdown, setCountdown] = useState(6);
  const [autoRetried, setAutoRetried] = useState(false);

  useEffect(() => {
    if (!isDemandSpike || !msg.retryPrompt || !onRetry || autoRetried) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setAutoRetried(true);
          onRetry(msg.retryPrompt!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isDemandSpike, msg.retryPrompt, onRetry, autoRetried]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(errorCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Approach 5B: Graceful Status Pill & Countdown UI for Model High Demand
  if (isDemandSpike) {
    return (
      <div className="w-full bg-gradient-to-r from-amber-50/90 via-orange-50/80 to-amber-50/90 border border-amber-300/80 rounded-2xl p-4 shadow-sm space-y-3 my-1 animate-in fade-in duration-200">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 border border-amber-300">
              <Sparkles className="w-4.5 h-4.5 text-amber-600 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-amber-950">
                  AI Model Demand Spike
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-200/90 text-amber-800 border border-amber-300">
                  Temporary
                </span>
              </div>
              <p className="text-xs text-amber-800/90 mt-0.5 leading-relaxed">
                The model is currently experiencing high demand. Spikes are temporary and usually resolve within moments.
              </p>
            </div>
          </div>
        </div>

        {/* Live Countdown & Auto-Retry Pill */}
        <div className="bg-white/90 border border-amber-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
            <Clock className="w-4 h-4 text-amber-600 animate-spin" />
            <span>
              {countdown > 0
                ? `Auto-retrying in ${countdown}s...`
                : 'Retrying now...'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {msg.retryPrompt && onRetry && (
              <button
                type="button"
                onClick={() => onRetry(msg.retryPrompt!)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Now</span>
              </button>
            )}

            {msg.retryPrompt && onLoadPrompt && (
              <button
                type="button"
                onClick={() => onLoadPrompt(msg.retryPrompt!)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 transition-all cursor-pointer"
                title="Edit message in input"
              >
                Edit
              </button>
            )}

            <button
              type="button"
              onClick={handleCopy}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 border ${
                copied
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
              }`}
              title="Copy error code"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copied ? 'Copied' : 'Code'}</span>
            </button>
          </div>
        </div>

        {msg.retryPrompt && (
          <div className="text-[11px] text-amber-900/80 bg-amber-100/50 p-2 rounded-lg font-sans flex items-center gap-1 truncate">
            <span className="font-semibold shrink-0">Preserved Input:</span>
            <span className="italic truncate">"{msg.retryPrompt}"</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full bg-rose-50/90 border border-rose-200/90 rounded-2xl p-4 shadow-2xs space-y-3 my-1">
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 border border-rose-200">
          <AlertTriangle className="w-4.5 h-4.5 text-rose-600" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-bold text-rose-950 flex items-center gap-1.5">
            {msg.content || 'Oops, something happened :C'}
          </h4>
          <p className="text-xs text-rose-700/90 mt-0.5 leading-relaxed">
            An error was captured during processing or input evaluation.
          </p>
        </div>
      </div>

      <div className="bg-white/90 border border-rose-200/80 rounded-xl p-3 flex items-center justify-between gap-2 shadow-2xs">
        <div className="min-w-0 flex-1 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-rose-600 shrink-0" />
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 block">
              Error Code
            </span>
            <span className="font-mono text-xs font-bold text-slate-800 tracking-wide select-all block truncate">
              {errorCode}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {msg.retryPrompt && onRetry && (
            <button
              type="button"
              onClick={() => onRetry(msg.retryPrompt!)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 shadow-2xs ${
              copied
                ? 'bg-emerald-600 text-white border border-emerald-600'
                : 'bg-rose-100 hover:bg-rose-200 text-rose-900 border border-rose-300'
            }`}
            title="Copy error code to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-white" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-rose-700" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {msg.errorDetails && (
        <div className="text-[11px] text-rose-800/80 bg-rose-100/50 p-2 rounded-lg font-mono truncate">
          Details: {msg.errorDetails}
        </div>
      )}
    </div>
  );
};

interface ChatViewProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => Promise<void>;
  isLoading: boolean;
  onNavigateToTask?: (taskId: string) => void;
  onNavigateToPerson?: (personId: string) => void;
  tasks: Task[];
  people: Person[];
  sessions?: ChatSession[];
  currentSessionId?: string;
  onStartNewChat?: () => void;
  onSelectSession?: (session: ChatSession) => void;
  onDeleteSession?: (sessionId: string) => void;
  onOpenDuplicatesModal?: () => void;
  hasActiveSafetyAlert?: boolean;
  safetyHelplineBannerEnabled?: boolean;
  duplicateToastInfo?: { show: boolean; count: number; autoMerged: number };
  onDismissDuplicateToast?: () => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  onSendMessage,
  isLoading,
  onNavigateToTask,
  onNavigateToPerson,
  tasks,
  people,
  sessions = [],
  currentSessionId,
  onStartNewChat,
  onSelectSession,
  onDeleteSession,
  onOpenDuplicatesModal,
  hasActiveSafetyAlert = false,
  safetyHelplineBannerEnabled = true,
  duplicateToastInfo,
  onDismissDuplicateToast,
}) => {
  const [inputText, setInputText] = useState('');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    const text = inputText;
    setInputText('');
    onSendMessage(text);
  };

  const handleChipClick = (chipText: string) => {
    setInputText(chipText);
  };

  // Check if any message in the current stream triggered a safety alert
  const containsSafetyAlertInStream = messages.some((m) => m.isSafetyAlert);
  const shouldShowHelplineBanner =
    (hasActiveSafetyAlert || containsSafetyAlertInStream) && safetyHelplineBannerEnabled;

  return (
    <div className="flex flex-col h-full bg-slate-50/70 relative font-sans">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200/80 px-4 py-2.5 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-2">
          {/* Upper Left Corner Option for Past Conversations */}
          <button
            onClick={() => setShowHistoryModal(true)}
            className="p-2 text-slate-700 hover:text-violet-600 hover:bg-slate-100 rounded-xl transition-all border border-slate-200 flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Past Conversations & History"
          >
            <History className="w-4 h-4 text-violet-600" />
            <span className="text-xs font-bold text-slate-800 hidden sm:inline">History</span>
            {sessions.length > 0 && (
              <span className="bg-violet-100 text-violet-700 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                {sessions.length}
              </span>
            )}
          </button>


        </div>

        <div className="flex items-center gap-2">
          {onOpenDuplicatesModal && (
            <button
              onClick={onOpenDuplicatesModal}
              className="bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
              title="Review & Merge Duplicates"
            >
              <Merge className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden sm:inline">Merge</span>
            </button>
          )}

          <button
            onClick={onStartNewChat}
            className="bg-violet-50 hover:bg-violet-100 border border-violet-200 text-violet-700 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
            title="Start fresh conversation"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Chat</span>
          </button>
        </div>
      </div>

      {/* PERSISTENT PINNED HELPLINE BANNER (when safety alert is triggered & enabled) */}
      {shouldShowHelplineBanner && (
        <div className="bg-rose-50 border-b border-rose-200 p-3.5 shrink-0 animate-in slide-in-from-top duration-200 shadow-sm">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200 mt-0.5">
              <HeartHandshake className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1 space-y-2 text-xs text-rose-950">
              <div>
                <h4 className="font-bold text-rose-900 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-600" /> Confidential Help & Support Hotlines
                </h4>
                <p className="text-[11px] text-rose-800 leading-normal mt-0.5">
                  Violet is an AI task management assistant and cannot serve as a crisis line. If you are experiencing distress, please connect with empathetic, trained professionals:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-medium pt-1">
                <a
                  href="tel:988"
                  className="bg-white border border-rose-200 hover:bg-rose-100/50 text-rose-900 p-2 rounded-xl flex items-center justify-between transition-colors shadow-2xs"
                >
                  <span className="flex items-center gap-1.5 font-bold">
                    <PhoneCall className="w-3.5 h-3.5 text-rose-600" /> 988 Crisis Lifeline
                  </span>
                  <span className="text-[10px] text-rose-700">Call / Text 988</span>
                </a>

                <a
                  href="sms:741741?body=HOME"
                  className="bg-white border border-rose-200 hover:bg-rose-100/50 text-rose-900 p-2 rounded-xl flex items-center justify-between transition-colors shadow-2xs"
                >
                  <span className="flex items-center gap-1.5 font-bold">
                    <MessageSquare className="w-3.5 h-3.5 text-rose-600" /> Crisis Text Line
                  </span>
                  <span className="text-[10px] text-rose-700">Text HOME to 741741</span>
                </a>
              </div>

              <div className="flex items-center justify-between text-[10px] text-rose-700 pt-0.5">
                <span>Free, confidential & available 24/7</span>
                <a
                  href="https://findahelpline.com"
                  target="_blank"
                  rel="noreferrer"
                  className="underline font-bold hover:text-rose-900 flex items-center gap-1"
                >
                  International Lines <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GENTLE DUPLICATE BACKGROUND SCAN TOAST BANNER */}
      {duplicateToastInfo?.show && (
        <div className="bg-amber-50/95 border-b border-amber-200/90 px-3.5 py-2.5 flex items-center justify-between text-xs text-amber-950 shrink-0 transition-all animate-in slide-in-from-top duration-200 shadow-2xs">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200/80">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <p className="truncate text-[11.5px] font-medium leading-tight">
              {duplicateToastInfo.autoMerged > 0 && duplicateToastInfo.count > 0 ? (
                <span>Auto-merged non-conflicting data! <b>{duplicateToastInfo.count} duplicate candidates</b> await review.</span>
              ) : duplicateToastInfo.autoMerged > 0 ? (
                <span>Auto-merged non-conflicting duplicate records!</span>
              ) : (
                <span><b>{duplicateToastInfo.count} duplicate candidate{duplicateToastInfo.count === 1 ? '' : 's'}</b> detected in background scan.</span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {onOpenDuplicatesModal && (
              <button
                onClick={() => {
                  onOpenDuplicatesModal();
                  onDismissDuplicateToast?.();
                }}
                className="bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
              >
                <Merge className="w-3 h-3" />
                <span>Review</span>
              </button>
            )}
            <button
              onClick={onDismissDuplicateToast}
              className="text-amber-700 hover:text-amber-900 p-1 rounded-lg hover:bg-amber-100 transition-colors"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[92%] sm:max-w-[85%] ${
                isUser ? 'ml-auto' : 'mr-auto'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1 text-[11px] text-slate-400 px-1">
                {isUser ? (
                  <>
                    <span>You</span>
                    <User className="w-3 h-3 text-slate-500" />
                  </>
                ) : (
                  <>
                    <Bot className="w-3 h-3 text-violet-600" />
                    <span className="font-bold text-slate-700">Violet AI</span>
                  </>
                )}
                <span>• {msg.timestamp}</span>
              </div>

              {msg.isError ? (
                <ErrorDiagnosticCard
                  msg={msg}
                  onRetry={(text) => onSendMessage(text)}
                  onLoadPrompt={(text) => setInputText(text)}
                />
              ) : (
                <div
                  className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-xs ${
                    isUser
                      ? 'bg-violet-600 text-white rounded-tr-xs'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-tl-xs'
                  }`}
                >
                  {/* Safe Guard High Demand Badge (Approach 1B & 5B) */}
                  {msg.isHighDemandFallback && (
                    <div className="mb-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                      <Sparkles className="w-3 h-3 text-amber-600" />
                      <span>Captured via Offline Safeguard • Legacy Records Protected</span>
                    </div>
                  )}
                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {/* Off-Topic Warning & Suggested Rephrase */}
                  {msg.isOffTopic && (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-900 text-xs space-y-2">
                      <div className="flex items-center gap-1.5 font-semibold text-amber-800">
                        <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                        Off-Topic Notice
                      </div>
                      <p className="text-amber-800/90 leading-normal">
                        Violet specializes in task planning, scheduling, people collaboration, and cataloging goals.
                      </p>
                      {msg.suggestedRephrase && (
                        <div className="pt-1">
                          <span className="text-[11px] font-semibold text-amber-900 block mb-1">
                            Suggested adjusted prompt:
                          </span>
                          <button
                            onClick={() => handleChipClick(msg.suggestedRephrase!)}
                            className="w-full text-left bg-white hover:bg-amber-100/60 transition-colors p-2 rounded-lg border border-amber-200 text-amber-900 font-medium text-xs flex items-center justify-between group cursor-pointer"
                          >
                            <span>"{msg.suggestedRephrase}"</span>
                            <ArrowRight className="w-3.5 h-3.5 text-amber-600 group-hover:translate-x-0.5 transition-transform" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Refining Question Prompt */}
                  {msg.refiningQuestion && !msg.isOffTopic && (
                    <div className="mt-3 p-2.5 bg-violet-50/80 border border-violet-200 rounded-xl flex items-start gap-2 text-xs text-violet-900">
                      <HelpCircle className="w-4 h-4 text-violet-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block text-[11px] text-violet-800">
                          Follow-up Refinement:
                        </span>
                        <p className="text-violet-950 font-medium">{msg.refiningQuestion}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Updated Tasks Cards inside chat */}
              {msg.updatedTaskIds && msg.updatedTaskIds.length > 0 && (
                <div className="mt-2 w-full space-y-1.5">
                  <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider px-1 flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 text-amber-600" /> Validated & Updated on File
                  </span>
                  {msg.updatedTaskIds.map((tid) => {
                    const task = tasks.find((t) => t.id === tid);
                    if (!task) return null;
                    return (
                      <div
                        key={tid}
                        onClick={() => onNavigateToTask?.(tid)}
                        className="bg-amber-50/60 hover:bg-amber-100/60 border border-amber-200 rounded-xl p-2.5 cursor-pointer transition-all shadow-2xs flex items-center justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full uppercase tracking-wider">
                              Updated on File
                            </span>
                            <span className="text-xs font-bold text-slate-800 truncate">
                              {task.title}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-0.5 flex items-center gap-2">
                            <span>{task.environmentalCategory}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {task.intendedTimeMinutes}m
                            </span>
                            {task.completed && (
                              <span className="text-emerald-700 font-bold ml-1">✓ Completed</span>
                            )}
                          </p>
                        </div>
                        <span className="text-xs text-amber-800 font-bold hover:underline shrink-0 ml-2">
                          View Task →
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Extracted Tasks Cards inside chat */}
              {msg.extractedTaskIds && msg.extractedTaskIds.length > 0 && (
                <div className="mt-2 w-full space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1 flex items-center gap-1">
                    <CheckSquare className="w-3 h-3 text-emerald-600" /> Extracted & Added Tasks
                  </span>
                  {msg.extractedTaskIds.map((tid) => {
                    const task = tasks.find((t) => t.id === tid);
                    if (!task) return null;
                    const dynamicUrgency = calculateDynamicUrgency(task);
                    return (
                      <div
                        key={tid}
                        onClick={() => onNavigateToTask?.(tid)}
                        className="bg-white hover:bg-slate-50 border border-emerald-200 rounded-xl p-2.5 cursor-pointer transition-all shadow-2xs flex items-center justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
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
                              {dynamicUrgency === 'ASAP' ? 'Urgent' : dynamicUrgency === 'None-Low' ? 'Low' : dynamicUrgency}
                            </span>
                            <span className="text-xs font-semibold text-slate-800 truncate">
                              {task.title}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                            <span>{task.environmentalCategory}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {task.intendedTimeMinutes}m
                            </span>
                          </p>
                        </div>
                        <span className="text-xs text-violet-600 font-medium hover:underline shrink-0 ml-2">
                          View →
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Extracted People Cards inside chat */}
              {msg.extractedPeopleIds && msg.extractedPeopleIds.length > 0 && (
                <div className="mt-2 w-full space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1 flex items-center gap-1">
                    <UserPlus className="w-3 h-3 text-violet-600" /> Linked Person Profiles
                  </span>
                  {msg.extractedPeopleIds.map((pid) => {
                    const p = people.find((item) => item.id === pid);
                    if (!p) return null;
                    return (
                      <div
                        key={pid}
                        onClick={() => onNavigateToPerson?.(pid)}
                        className="bg-white hover:bg-slate-50 border border-violet-200 rounded-xl p-2.5 cursor-pointer transition-all shadow-2xs flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0"
                            style={{ backgroundColor: p.avatarColor }}
                          >
                            {p.name.charAt(0)}
                          </div>
                          <div>
                            <h5 className="text-xs font-bold text-slate-800">{p.name}</h5>
                            <p className="text-[10px] text-slate-500">{p.roleOrRelation || 'Contact'}</p>
                          </div>
                        </div>
                        <span className="text-xs text-violet-600 font-medium hover:underline shrink-0">
                          Profile →
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-2 text-slate-500 text-xs bg-white border border-slate-200 rounded-2xl px-4 py-3 max-w-xs shadow-2xs">
            <Loader2 className="w-4 h-4 animate-spin text-violet-600" />
            <span>Violet is analyzing tasks, people profiles, and context...</span>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      <div className="px-4 py-1.5 overflow-x-auto flex items-center gap-2 shrink-0 no-scrollbar">
        <button
          onClick={() => handleChipClick('Finish marketing presentation with Sarah by tomorrow 3pm')}
          className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap shadow-2xs transition-colors cursor-pointer"
        >
          ➕ Task with person (Sarah)
        </button>
        <button
          onClick={() => handleChipClick('Update marketing presentation task: add note to review financial figures')}
          className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap shadow-2xs transition-colors cursor-pointer"
        >
          🔄 Update existing task notes
        </button>
        <button
          onClick={() => handleChipClick('I need to prepare for college finals next week, high focus')}
          className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap shadow-2xs transition-colors cursor-pointer"
        >
          🎓 College finals task
        </button>
      </div>

      {/* Input Box */}
      <div className="p-3 bg-white border-t border-slate-200/80 shrink-0">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a task, update, person, or ask Violet..."
            className="flex-1 bg-slate-100 border border-slate-200 focus:border-violet-500 focus:bg-white text-slate-800 text-sm rounded-full px-4 py-2.5 outline-none transition-all placeholder:text-slate-400 font-sans"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:hover:bg-violet-600 text-white p-2.5 rounded-full transition-all shrink-0 shadow-xs cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <p className="text-[10px] text-center text-slate-400 mt-1.5">
          Violet validates tasks & profiles on file to update them seamlessly or log new actionable items.
        </p>
      </div>

      {/* PAST CONVERSATIONS HISTORY MODAL / DRAWER */}
      {showHistoryModal && (
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex justify-start animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-xs h-full shadow-2xl flex flex-col border-r border-slate-200 animate-in slide-in-from-left duration-200 font-sans">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-violet-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Past Conversations</h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {sessions.length} saved session{sessions.length === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Actions */}
            <div className="p-3 border-b border-slate-100">
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  onStartNewChat?.();
                }}
                className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Start New Chat
              </button>
            </div>

            {/* Sessions List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {sessions.length === 0 ? (
                <div className="text-center py-10 px-4 text-slate-400 space-y-2">
                  <MessageSquare className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-xs font-semibold text-slate-500">No past conversations saved yet</p>
                  <p className="text-[11px] text-slate-400">
                    When you close or reopen the app, your chats are archived here automatically.
                  </p>
                </div>
              ) : (
                sessions.map((session) => {
                  const isCurrent = session.id === currentSessionId;
                  const userMessageCount = session.messages.filter((m) => m.role === 'user').length;

                  return (
                    <div
                      key={session.id}
                      className={`p-3 rounded-xl border transition-all cursor-pointer group relative ${
                        isCurrent
                          ? 'bg-violet-50/80 border-violet-300 shadow-2xs'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'
                      }`}
                      onClick={() => {
                        onSelectSession?.(session);
                        setShowHistoryModal(false);
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-slate-800 line-clamp-1 group-hover:text-violet-600 transition-colors">
                            {session.title || 'Conversation'}
                          </h4>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1 font-medium">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {session.createdAt}
                            </span>
                            <span>•</span>
                            <span>{userMessageCount} prompt{userMessageCount === 1 ? '' : 's'}</span>
                          </div>
                        </div>

                        {onDeleteSession && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteSession(session.id);
                            }}
                            className="p-1 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0 cursor-pointer"
                            title="Delete this session"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
