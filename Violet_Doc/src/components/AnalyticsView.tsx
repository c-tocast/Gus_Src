import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  Trash2,
  PieChart as PieIcon,
  Pin,
  RefreshCw,
  MessageSquare,
  Bot,
  AlertTriangle,
  Copy,
  Check,
  Terminal,
} from 'lucide-react';
import { Task, Person, AnalyticsChatMessage, AnalyticsChartSpec } from '../types';
import { DynamicChartRenderer } from './DynamicChartRenderer';
import {
  loadPinnedAnalyticsCharts,
  savePinnedAnalyticsCharts,
  loadAnalyticsChatMessages,
  saveAnalyticsChatMessages,
  getLegacyAnalyticsChips,
} from '../utils/analyticsStorage';
import { classifyError, isHighDemandError } from '../utils/errorTracker';
import { generateDeterministicAnalytics } from '../utils/deterministicAnalytics';

interface AnalyticsViewProps {
  tasks: Task[];
  people: Person[];
  stopwatchTimers?: any;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  tasks,
  people,
  stopwatchTimers = {},
}) => {
  const [messages, setMessages] = useState<AnalyticsChatMessage[]>([]);
  const [pinnedCharts, setPinnedCharts] = useState<AnalyticsChartSpec[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const legacyChips = useRef<string[]>(getLegacyAnalyticsChips());

  // Load saved state on mount
  useEffect(() => {
    const savedPinned = loadPinnedAnalyticsCharts();
    setPinnedCharts(savedPinned);

    const savedMessages = loadAnalyticsChatMessages();
    if (savedMessages.length > 0) {
      setMessages(savedMessages);
    } else {
      // Auto-Seeded Initial Welcome Message (Approach 4A & 1B)
      const welcomeMsg: AnalyticsChatMessage = {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content:
          "Hello! I'm Prism, your dedicated Analytics AI Advisor. What metrics or insights would you like to visualize today? You can select a quick prompt below or type any custom chart request.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedFollowUps: legacyChips.current,
      };
      setMessages([welcomeMsg]);
      saveAnalyticsChatMessages([welcomeMsg]);
    }
  }, []);

  // Save messages whenever updated
  useEffect(() => {
    if (messages.length > 0) {
      saveAnalyticsChatMessages(messages);
    }
  }, [messages]);

  // Save pinned charts whenever updated
  useEffect(() => {
    savePinnedAnalyticsCharts(pinnedCharts);
  }, [pinnedCharts]);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Toggle chart pin state (Approach 6A)
  const handleTogglePin = (chart: AnalyticsChartSpec) => {
    setPinnedCharts((prev) => {
      const isAlreadyPinned = prev.some((c) => c.id === chart.id || c.title === chart.title);
      if (isAlreadyPinned) {
        return prev.filter((c) => c.id !== chart.id && c.title !== chart.title);
      } else {
        if (prev.length >= 3) {
          // Keep max 3 pinned charts
          return [...prev.slice(1), { ...chart, isPinned: true }];
        }
        return [...prev, { ...chart, isPinned: true }];
      }
    });
  };

  // Send message to /api/analytics-chat
  const handleSendMessage = async (promptText: string) => {
    if (!promptText.trim() || isLoading) return;

    const userMsgText = promptText.trim();
    setInputText('');

    const timestampStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: AnalyticsChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: userMsgText,
      timestamp: timestampStr,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Offline mode detected.');
      }

      const response = await fetch('/api/analytics-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userMsgText,
          tasks,
          people,
          timers: stopwatchTimers,
          history: messages.slice(-5).map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        let errCode = `ERR_HTTP_${response.status}`;
        let details = `HTTP error ${response.status}`;
        if (response.status === 503) {
          errCode = 'ERR_MODEL_HIGH_DEMAND';
          details = 'The AI model is experiencing a high-demand capacity spike.';
        }
        try {
          const errData = await response.json();
          if (errData.errorCode) errCode = errData.errorCode;
          if (errData.errorDetails) details = errData.errorDetails;
        } catch (_) {}

        // Approach 4A & Question 2: Deterministic Analytics Fallback on 503
        if (response.status === 503 || isHighDemandError(errCode)) {
          const det = generateDeterministicAnalytics(userMsgText, tasks, people);
          const assistantMsg: AnalyticsChatMessage = {
            id: `ast-${Date.now()}`,
            role: 'assistant',
            content: `AI servers are currently experiencing high demand. I computed these statistical charts deterministically from your workspace (${tasks.length} total tasks).`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            charts: det.charts,
            suggestedFollowUps: det.suggestedFollowUps,
            isDeterministicFallback: true,
          };
          setMessages((prev) => [...prev, assistantMsg]);
          return;
        }

        const errorMsg: AnalyticsChatMessage = {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: 'Oops, something happened :C',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isError: true,
          errorCode: errCode,
          errorDetails: details,
          retryPrompt: userMsgText,
        };
        setMessages((prev) => [...prev, errorMsg]);
        return;
      }

      const data = await response.json();

      if (data.isError) {
        if (isHighDemandError(data.errorCode)) {
          const det = generateDeterministicAnalytics(userMsgText, tasks, people);
          const assistantMsg: AnalyticsChatMessage = {
            id: `ast-${Date.now()}`,
            role: 'assistant',
            content: `AI servers are currently experiencing high demand. I computed these statistical charts deterministically from your workspace (${tasks.length} total tasks).`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            charts: det.charts,
            suggestedFollowUps: det.suggestedFollowUps,
            isDeterministicFallback: true,
          };
          setMessages((prev) => [...prev, assistantMsg]);
          return;
        }

        const errorMsg: AnalyticsChatMessage = {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: data.replyText || 'Oops, something happened :C',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isError: true,
          errorCode: data.errorCode || 'ERR_UNKNOWN_WORKFLOW_FAIL',
          errorDetails: data.errorDetails || 'Error generating analytics charts.',
          retryPrompt: userMsgText,
        };
        setMessages((prev) => [...prev, errorMsg]);
        return;
      }

      const assistantMsg: AnalyticsChatMessage = {
        id: `ast-${Date.now()}`,
        role: 'assistant',
        content: data.replyText || 'Here are the requested analytics graphs:',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        charts: Array.isArray(data.charts) ? data.charts : [],
        suggestedFollowUps: Array.isArray(data.suggestedFollowUps) ? data.suggestedFollowUps : [],
        isDeterministicFallback: Boolean(data.isDeterministicFallback),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('Analytics AI error:', err);
      const errCode = classifyError(err, 'ERR_UNKNOWN_WORKFLOW_FAIL');

      if (isHighDemandError(errCode)) {
        const det = generateDeterministicAnalytics(userMsgText, tasks, people);
        const assistantMsg: AnalyticsChatMessage = {
          id: `ast-${Date.now()}`,
          role: 'assistant',
          content: `AI servers are currently experiencing high demand. I computed these statistical charts deterministically from your workspace (${tasks.length} total tasks).`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          charts: det.charts,
          suggestedFollowUps: det.suggestedFollowUps,
          isDeterministicFallback: true,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        return;
      }

      const errorMsg: AnalyticsChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'Oops, something happened :C',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true,
        errorCode: errCode,
        errorDetails: err?.message || 'Error communicating with Prism Analytics AI.',
        retryPrompt: userMsgText,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    const freshWelcome: AnalyticsChatMessage = {
      id: `welcome-${Date.now()}`,
      role: 'assistant',
      content:
        "Analytics chat reset! I'm Prism, your Analytics Advisor. What would you like to explore or graph next?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      suggestedFollowUps: legacyChips.current,
    };
    setMessages([freshWelcome]);
    saveAnalyticsChatMessages([freshWelcome]);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Top Banner / Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 shadow-md border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shrink-0 shadow-2xs">
              <Bot className="w-6 h-6 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-white">Prism Analytics AI</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  SQL & Chart Specialist
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Ask for custom metrics, SQL breakdowns, and visual trends matching your goals.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClearChat}
            className="px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 self-start sm:self-auto shrink-0"
            title="Reset analytics conversation"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            <span>New Chat Session</span>
          </button>
        </div>
      </div>

      {/* Pinned Dashboard Section (Approach 6A) */}
      {pinnedCharts.length > 0 && (
        <div className="bg-slate-50 border border-slate-200/90 rounded-3xl p-5 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-violet-100 text-violet-700">
                <Pin className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Active Dashboard (Pinned)</h3>
                <p className="text-xs text-slate-500">
                  Your top {pinnedCharts.length} pinned graphs stay visible across sessions.
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-full">
              {pinnedCharts.length} / 3 Pinned
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pinnedCharts.map((chart) => (
              <DynamicChartRenderer
                key={`pinned-${chart.id}`}
                spec={chart}
                isPinned={true}
                onTogglePin={handleTogglePin}
              />
            ))}
          </div>
        </div>
      )}

      {/* Analytics Chat Area */}
      <div className="bg-white border border-slate-200/90 rounded-3xl shadow-xs overflow-hidden flex flex-col min-h-[500px]">
        {/* Chat History */}
        <div className="flex-1 p-4 sm:p-6 space-y-6 overflow-y-auto max-h-[650px]">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            const errorCode = msg.errorCode || 'ERR_UNKNOWN_WORKFLOW_FAIL';

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-3xl ${
                  isUser ? 'ml-auto' : 'mr-auto'
                } space-y-1.5`}
              >
                {/* Author Label */}
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 px-1">
                  {!isUser && <Bot className="w-3.5 h-3.5 text-indigo-600" />}
                  <span>{isUser ? 'You' : 'Prism Analytics'}</span>
                  <span>• {msg.timestamp}</span>
                </div>

                {/* Error Card or Message Content */}
                {msg.isError ? (
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
                          An error occurred while evaluating your analytics query.
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

                      <button
                        type="button"
                        onClick={() => handleCopyCode(errorCode)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 shadow-2xs ${
                          copiedCode === errorCode
                            ? 'bg-emerald-600 text-white border border-emerald-600'
                            : 'bg-rose-100 hover:bg-rose-200 text-rose-900 border border-rose-300'
                        }`}
                        title="Copy error code"
                      >
                        {copiedCode === errorCode ? (
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

                    {msg.retryPrompt && (
                      <div className="pt-1 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const det = generateDeterministicAnalytics(msg.retryPrompt!, tasks, people);
                            const assistantMsg: AnalyticsChatMessage = {
                              id: `ast-${Date.now()}`,
                              role: 'assistant',
                              content: `Computed deterministically from local tasks:`,
                              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                              charts: det.charts,
                              suggestedFollowUps: det.suggestedFollowUps,
                              isDeterministicFallback: true,
                            };
                            setMessages((prev) => [...prev, assistantMsg]);
                          }}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Generate Deterministic Charts</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSendMessage(msg.retryPrompt!)}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                          <span>Retry Query</span>
                        </button>
                      </div>
                    )}

                    {msg.errorDetails && (
                      <div className="text-[11px] text-rose-800/80 bg-rose-100/50 p-2 rounded-lg font-mono truncate">
                        Details: {msg.errorDetails}
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-xs ${
                      isUser
                        ? 'bg-indigo-600 text-white rounded-tr-xs'
                        : 'bg-slate-50 border border-slate-200/80 text-slate-800 rounded-tl-xs'
                    }`}
                  >
                    {msg.isDeterministicFallback && !isUser && (
                      <div className="mb-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-900 border border-indigo-200 shadow-2xs">
                        <Sparkles className="w-3 h-3 text-indigo-600" />
                        <span>Deterministic Engine Active • Zero External API Dependency</span>
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                )}

                {/* Render Generated Charts (Up to 3) */}
                {msg.charts && msg.charts.length > 0 && (
                  <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                    {msg.charts.map((chartSpec) => {
                      const isPinned = pinnedCharts.some(
                        (p) => p.id === chartSpec.id || p.title === chartSpec.title
                      );
                      return (
                        <DynamicChartRenderer
                          key={chartSpec.id}
                          spec={chartSpec}
                          isPinned={isPinned}
                          onTogglePin={handleTogglePin}
                        />
                      );
                    })}
                  </div>
                )}

                {/* Suggested Follow-up Chips */}
                {msg.suggestedFollowUps && msg.suggestedFollowUps.length > 0 && (
                  <div className="w-full flex flex-wrap gap-2 pt-2">
                    {msg.suggestedFollowUps.map((chip, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(chip)}
                        disabled={isLoading}
                        className="text-xs bg-indigo-50/80 hover:bg-indigo-100/80 text-indigo-900 border border-indigo-200/90 px-3 py-1.5 rounded-xl font-medium transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                      >
                        <Sparkles className="w-3 h-3 text-indigo-600 shrink-0" />
                        <span>"{chip}"</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex items-center gap-3 text-xs text-slate-500 p-3 bg-slate-50 rounded-2xl border border-slate-200/60 max-w-xs">
              <Bot className="w-4 h-4 text-indigo-600 animate-bounce" />
              <span>Prism is running SQL aggregations...</span>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-slate-200/80 bg-slate-50/50 space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputText);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="e.g., 'Show my focus time vs intended time by category' or 'Graph completed tasks by day'..."
              disabled={isLoading}
              className="flex-1 bg-white border border-slate-300 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 text-slate-800 placeholder-slate-400 shadow-2xs disabled:bg-slate-100"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white p-3 rounded-2xl transition-all cursor-pointer shadow-2xs disabled:cursor-not-allowed shrink-0"
              title="Send prompt to Prism Analytics"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
