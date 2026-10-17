import React, { useState } from 'react';
import {
  Bell,
  BellOff,
  Smartphone,
  Sliders,
  CheckCircle2,
  Clock,
  Sparkles,
  ShieldCheck,
  Send,
  AlertCircle,
  Plus,
  RotateCcw,
  X,
  User as UserIcon,
  LogOut,
  Globe,
} from 'lucide-react';
import { AppSettings, Task, SystemNotification } from '../types';
import { CustomDropdown, DropdownOption } from './CustomDropdown';
import { resetAllAppData } from '../utils/storage';
import {
  requestNotificationPermission,
  getNotificationPermission,
  sendSystemDesktopNotification,
} from '../utils/notifications';
import { User } from '../firebase';

interface RemindersSettingsViewProps {
  settings: AppSettings;
  tasks: Task[];
  notifications: SystemNotification[];
  onUpdateSettings: (newSettings: AppSettings) => void;
  onTriggerTestNotification: (title: string, message: string) => void;
  onSendChatMessage?: (prompt: string) => void;
  onResetAllData?: () => void;
  onOpenDuplicatesModal?: () => void;
  simulatedOffsetMs?: number;
  onFastForwardTime?: (additionalMs: number) => void;
  onResetSimulatedTime?: () => void;
  currentUser?: User | null;
  onSignOut?: () => void;
}

const FREQUENCY_OPTIONS: DropdownOption[] = [
  { value: 'adaptive', label: 'Adaptive (ASAP = 3h, Urgent = 1d)', emoji: '⚡' },
  { value: 'regular', label: 'Regular Daily Reminders', emoji: '📅' },
  { value: 'silent', label: 'Silent / Off-Peak Only', emoji: '🔕' },
];

const STYLE_OPTIONS: DropdownOption[] = [
  { value: 'android_shade', label: 'Android Notification Shade Banner', emoji: '📱' },
  { value: 'heads_up', label: 'Heads-Up Popup', emoji: '🔔' },
  { value: 'in_app_only', label: 'In-App Toast Only', emoji: '💬' },
];

export const RemindersSettingsView: React.FC<RemindersSettingsViewProps> = ({
  settings,
  tasks,
  notifications,
  onUpdateSettings,
  onTriggerTestNotification,
  onSendChatMessage,
  onResetAllData,
  onOpenDuplicatesModal,
  simulatedOffsetMs = 0,
  onFastForwardTime,
  onResetSimulatedTime,
  currentUser,
  onSignOut,
}) => {
  const [customReminderText, setCustomReminderText] = useState('');
  const [customTimeText, setCustomTimeText] = useState('in 1 hour');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDisableConfirmModal, setShowDisableConfirmModal] = useState(false);
  const [sysPermission, setSysPermission] = useState<string>(() => getNotificationPermission());

  // Compute simulated date display
  const simulatedDate = new Date(Date.now() + simulatedOffsetMs);
  const daysPassed = Math.round(simulatedOffsetMs / (1000 * 60 * 60 * 24));
  const hoursPassed = Math.round(simulatedOffsetMs / (1000 * 60 * 60));

  const handleCreateCustomReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customReminderText.trim()) return;

    if (onSendChatMessage) {
      onSendChatMessage(
        `Set custom reminder "${customReminderText.trim()}" scheduled for ${customTimeText}`
      );
      setCustomReminderText('');
    }
  };

  const handleConfirmReset = () => {
    // Approach 2B: Second "Are you sure?" confirmation alert right after the user confirms the first step
    const doubleConfirm = window.confirm(
      "PERMANENT ACTION WARNING:\n\nAre you absolutely sure you want to permanently reset all workspace data?\n\nThis will permanently wipe all tasks, people contacts, chat sessions, and settings from BOTH this device and your Cloud Firestore database. This action CANNOT be undone."
    );
    if (doubleConfirm) {
      setShowResetConfirm(false);
      resetAllAppData();
      if (onResetAllData) {
        onResetAllData();
      } else {
        window.location.reload();
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative overflow-y-auto p-4 space-y-4 font-sans">
      {/* Account Management Card */}
      {currentUser && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-5 shadow-lg border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName || 'User Avatar'}
                  className="w-12 h-12 rounded-2xl border-2 border-violet-400 shadow-md object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-violet-600 text-white flex items-center justify-center font-bold text-lg border-2 border-violet-400">
                  {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : 'U'}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-extrabold truncate text-white">
                    {currentUser.displayName || 'Google User'}
                  </h3>
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Active Session
                  </span>
                </div>
                <p className="text-xs text-slate-300 truncate mt-0.5">{currentUser.email}</p>
                <p className="text-[10px] text-violet-300 mt-0.5 font-mono">
                  App URL: ai-task-violet.ai.studio
                </p>
              </div>
            </div>

            {onSignOut && (
              <button
                onClick={onSignOut}
                className="bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-rose-300" />
                <span>Sign Out</span>
              </button>
            )}
          </div>
          <div className="bg-slate-800/60 rounded-2xl p-3 border border-slate-700/50 flex items-center justify-between text-xs text-slate-300">
            <span className="flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-violet-400" />
              Cross-Device Cloud Sync Enabled
            </span>
            <span className="text-emerald-400 font-semibold">● Connected</span>
          </div>
        </div>
      )}
      {/* Phone Settings Master Toggle */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Phone Master Notification Switch</h3>
              <p className="text-xs text-slate-500">
                System level control from Android phone settings
              </p>
            </div>
          </div>

          <button
            onClick={() =>
              onUpdateSettings({
                ...settings,
                globalNotificationsEnabled: !settings.globalNotificationsEnabled,
              })
            }
            className={`w-12 h-6.5 rounded-full transition-colors relative cursor-pointer ${
              settings.globalNotificationsEnabled ? 'bg-violet-600' : 'bg-slate-300'
            }`}
          >
            <div
              className={`w-5.5 h-5.5 rounded-full bg-white shadow-md absolute top-0.5 transition-transform ${
                settings.globalNotificationsEnabled ? 'left-6' : 'left-0.5'
              }`}
            />
          </button>
        </div>

        {!settings.globalNotificationsEnabled && (
          <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-2xl text-amber-900 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              All notifications are silenced by Android Phone Settings. In-app notifications & shade alerts won't pop up.
            </span>
          </div>
        )}
      </div>

      {/* PC Desktop & Chrome Mobile System Popups Permission Switch */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">PC Desktop & Mobile Chrome System Alerts</h3>
              <p className="text-xs text-slate-500">
                Native OS popups & Mobile Chrome alerts when Violet is minimized
              </p>
            </div>
          </div>

          <button
            onClick={async () => {
              const res = await requestNotificationPermission();
              setSysPermission(res);
              if (res === 'granted') {
                sendSystemDesktopNotification(
                  '🔔 System Alerts Activated!',
                  'Violet will now notify you on Desktop PC & Chrome Mobile.'
                );
              }
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
              sysPermission === 'granted'
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : sysPermission === 'denied'
                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            {sysPermission === 'granted'
              ? '✓ System Alerts Granted'
              : sysPermission === 'denied'
              ? 'Blocked in Browser'
              : 'Enable System Popups'}
          </button>
        </div>
      </div>

      {/* Safety & Crisis Helpline Support Banner Toggle */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Crisis Helpline Support Banner</h3>
              <p className="text-xs text-slate-500">
                Display persistent crisis support and hotline links when emotional distress is detected
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              if (settings.safetyHelplineBannerEnabled) {
                // Intercept disabling and show orange cat confirmation popup
                setShowDisableConfirmModal(true);
              } else {
                // Re-enable directly
                onUpdateSettings({
                  ...settings,
                  safetyHelplineBannerEnabled: true,
                });
              }
            }}
            className={`w-12 h-6.5 rounded-full transition-colors relative cursor-pointer ${
              settings.safetyHelplineBannerEnabled ? 'bg-rose-600' : 'bg-slate-300'
            }`}
            title={settings.safetyHelplineBannerEnabled ? 'Click to disable' : 'Click to enable'}
          >
            <div
              className={`w-5.5 h-5.5 rounded-full bg-white shadow-md absolute top-0.5 transition-transform ${
                settings.safetyHelplineBannerEnabled ? 'left-6' : 'left-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Smiling Orange Cat Confirmation Modal for Disabling Crisis Banner */}
      {showDisableConfirmModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center space-y-4 relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowDisableConfirmModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Smiling Orange Cat Emoji */}
            <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto text-3xl shadow-inner border border-amber-200">
              😸
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-900">
                Are you sure you want to turn this off? 😸
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed px-1">
                Hi friend! 😸 The Crisis Helpline Support Banner provides quick, confidential 24/7 hotline links whenever distress is detected. Keeping it active ensures help is always within reach!
              </p>
            </div>

            <div className="p-3 bg-amber-50/90 rounded-2xl border border-amber-200/80 text-[11px] text-amber-900 text-left flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>We recommend keeping this support banner enabled for peace of mind.</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                onClick={() => setShowDisableConfirmModal(false)}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                Keep Enabled 😸
              </button>
              <button
                onClick={() => {
                  onUpdateSettings({
                    ...settings,
                    safetyHelplineBannerEnabled: false,
                  });
                  setShowDisableConfirmModal(false);
                }}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold py-2.5 rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                Turn Off Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review & Merge Duplicates Tools */}
      {onOpenDuplicatesModal && (
        <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-600" /> Depurate & Anti-Duplicate Review
              </h3>
              <p className="text-[11px] text-slate-500">
                Scan your workspace for duplicate tasks, contacts, or formatting tag variations.
              </p>
            </div>

            <button
              onClick={onOpenDuplicatesModal}
              className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Review & Merge Duplicates
            </button>
          </div>
        </div>
      )}

      {/* Time Machine & Date Travel Simulator */}
      <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white rounded-3xl p-5 shadow-md space-y-3.5 border border-indigo-700/50">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-xs font-bold text-indigo-200 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-indigo-400" /> Time Travel Simulator (Testing Tool)
            </h3>
            <p className="text-[11px] text-indigo-300/80">
              Simulate time passing to test task deadlines, overdue alerts, and daily check-ins.
            </p>
          </div>

          <div className="text-right">
            <div className="text-xs font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-800/80 inline-block font-mono">
              {simulatedDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
            {simulatedOffsetMs > 0 && (
              <p className="text-[10px] text-indigo-300 mt-0.5 font-medium">
                +{daysPassed >= 1 ? `${daysPassed} day${daysPassed === 1 ? '' : 's'}` : `${hoursPassed}h`} ahead
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          <button
            type="button"
            onClick={() => onFastForwardTime?.(1000 * 60 * 60)}
            className="bg-indigo-800/80 hover:bg-indigo-700 border border-indigo-600/60 text-white text-xs font-bold py-2 rounded-xl transition-colors cursor-pointer text-center"
          >
            +1 Hour ⏱️
          </button>
          <button
            type="button"
            onClick={() => onFastForwardTime?.(1000 * 60 * 60 * 24)}
            className="bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/80 text-white text-xs font-bold py-2 rounded-xl transition-colors cursor-pointer text-center shadow-2xs"
          >
            +1 Day (+24h) 📅
          </button>
          <button
            type="button"
            onClick={() => onFastForwardTime?.(1000 * 60 * 60 * 24 * 3)}
            className="bg-indigo-800/80 hover:bg-indigo-700 border border-indigo-600/60 text-white text-xs font-bold py-2 rounded-xl transition-colors cursor-pointer text-center"
          >
            +3 Days 🗓️
          </button>
          <button
            type="button"
            onClick={() => onFastForwardTime?.(1000 * 60 * 60 * 24 * 7)}
            className="bg-indigo-800/80 hover:bg-indigo-700 border border-indigo-600/60 text-white text-xs font-bold py-2 rounded-xl transition-colors cursor-pointer text-center"
          >
            +1 Week 🚀
          </button>
        </div>

        {simulatedOffsetMs > 0 && (
          <div className="flex items-center justify-between pt-1 border-t border-indigo-800/60">
            <span className="text-[11px] text-indigo-300">Active offset: +{hoursPassed} hours simulated</span>
            <button
              type="button"
              onClick={onResetSimulatedTime}
              className="text-xs font-bold text-amber-300 hover:text-amber-200 underline cursor-pointer flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> Reset to Real Time
            </button>
          </div>
        )}
      </div>

      {/* AI Follow-Up Automation Settings */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-violet-600" />
              Automated AI Task Follow-Ups
            </h3>
            <p className="text-[11px] text-slate-500">
              Violet automatically follows up with check-ins based on task urgency or custom intervals.
            </p>
          </div>
          <button
            onClick={() =>
              onUpdateSettings({
                ...settings,
                autoFollowUpsEnabled: !settings.autoFollowUpsEnabled,
              })
            }
            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
              settings.autoFollowUpsEnabled ? 'bg-violet-600' : 'bg-slate-300'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-md absolute top-0.5 transition-transform ${
                settings.autoFollowUpsEnabled ? 'left-5.5' : 'left-0.5'
              }`}
            />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <CustomDropdown
            label="Default Follow-Up Pace"
            options={FREQUENCY_OPTIONS}
            value={settings.notificationFrequency}
            onChange={(val) =>
              onUpdateSettings({
                ...settings,
                notificationFrequency: val as any,
              })
            }
          />

          <CustomDropdown
            label="Shade Display Style"
            options={STYLE_OPTIONS}
            value={settings.notificationStyle}
            onChange={(val) =>
              onUpdateSettings({
                ...settings,
                notificationStyle: val as any,
              })
            }
          />
        </div>
      </div>

      {/* Ask AI for Custom Reminder */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-2xs space-y-3">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
          <Bell className="w-4 h-4 text-violet-600" /> Ask Violet to Schedule Custom Reminder
        </h3>
        <p className="text-[11px] text-slate-500">
          Request custom reminders showing in the style & frequency you specify.
        </p>

        <form onSubmit={handleCreateCustomReminder} className="space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              required
              value={customReminderText}
              onChange={(e) => setCustomReminderText(e.target.value)}
              placeholder="e.g. Drink water & check presentation"
              className="sm:col-span-2 bg-slate-50 border border-slate-200 text-xs text-slate-800 rounded-xl p-2.5 outline-none focus:border-violet-600"
            />
            <input
              type="text"
              value={customTimeText}
              onChange={(e) => setCustomTimeText(e.target.value)}
              placeholder="in 1 hour / daily at 9am"
              className="bg-slate-50 border border-slate-200 text-xs text-slate-800 rounded-xl p-2.5 outline-none focus:border-violet-600"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() =>
                onTriggerTestNotification(
                  'Task Reminder Test',
                  'This is a sample Android system shade notification!'
                )
              }
              className="text-xs text-violet-700 hover:text-violet-900 underline font-semibold cursor-pointer"
            >
              Test Android Notification Shade
            </button>

            <button
              type="submit"
              className="bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" /> Schedule in Chat
            </button>
          </div>
        </form>
      </div>

      {/* Active System Notifications Log */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-2xs space-y-3">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-violet-600" /> System Notification Logs ({notifications.length})
        </h3>

        {notifications.length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-4">No recent notification history.</p>
        ) : (
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {notifications.slice().reverse().map((n) => (
              <div
                key={n.id}
                className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs flex items-start justify-between gap-2"
              >
                <div>
                  <h5 className="font-bold text-slate-800">{n.title}</h5>
                  <p className="text-slate-600 text-[11px]">{n.message}</p>
                </div>
                <span className="text-[10px] text-slate-400 shrink-0">{n.timestamp}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reset Clean Slate Section */}
      <div className="bg-red-50/60 border border-red-200 rounded-3xl p-5 space-y-2">
        <h3 className="text-xs font-bold text-red-900 uppercase tracking-wider flex items-center gap-1.5">
          <RotateCcw className="w-4 h-4 text-red-600" /> Clean Slate Reset
        </h3>
        <p className="text-[11px] text-red-800/80">
          Reset all tasks, people profiles, chat sessions, and user settings to test from a brand-new clean slate version.
        </p>

        {showResetConfirm ? (
          <div className="flex items-center gap-2 pt-2">
            <span className="text-xs font-bold text-red-700">Are you sure?</span>
            <button
              onClick={handleConfirmReset}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-2xs cursor-pointer"
            >
              Yes, Reset Everything
            </button>
            <button
              onClick={() => setShowResetConfirm(false)}
              className="text-xs font-bold text-slate-600 hover:bg-slate-200/60 px-3 py-1.5 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowResetConfirm(true)}
            className="bg-white hover:bg-red-100 text-red-700 border border-red-300 text-xs font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer shadow-2xs"
          >
            Reset All Workspace Data
          </button>
        )}
      </div>
    </div>
  );
};
