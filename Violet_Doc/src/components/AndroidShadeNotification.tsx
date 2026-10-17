import React, { useEffect, useState } from 'react';
import { CheckCircle2, MessageSquare, X } from 'lucide-react';
import { SystemNotification } from '../types';

interface AndroidShadeNotificationProps {
  notifications: SystemNotification[];
  onDismiss: (id: string) => void;
  onOpenTask?: (taskId: string) => void;
}

interface NotificationItemProps {
  notification: SystemNotification;
  onDismiss: (id: string) => void;
  onOpenTask?: (taskId: string) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onDismiss,
  onOpenTask,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [remainingMs, setRemainingMs] = useState(5000);

  useEffect(() => {
    if (isHovered || isFadingOut) return;

    const tickMs = 100;
    const timer = setInterval(() => {
      setRemainingMs((prev) => {
        if (prev <= tickMs) {
          clearInterval(timer);
          setIsFadingOut(true);
          setTimeout(() => {
            onDismiss(notification.id);
          }, 400); // 400ms fade out before hard deletion
          return 0;
        }
        return prev - tickMs;
      });
    }, tickMs);

    return () => clearInterval(timer);
  }, [isHovered, isFadingOut, notification.id, onDismiss]);

  const progressPercent = Math.max(0, Math.min(100, (remainingMs / 5000) * 100));

  return (
    <div
      onMouseEnter={() => {
        setIsHovered(true);
        setRemainingMs(5000);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
      }}
      onTouchStart={() => {
        setIsHovered(true);
        setRemainingMs(5000);
      }}
      onTouchEnd={() => {
        setIsHovered(false);
      }}
      className={`pointer-events-auto bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-3.5 shadow-2xl border border-slate-700/50 transition-all duration-400 relative overflow-hidden flex items-start gap-3 ${
        isFadingOut
          ? 'opacity-0 -translate-y-3 scale-95'
          : 'opacity-100 translate-y-0 scale-100 animate-slide-down'
      }`}
    >
      <div className="p-2 rounded-xl bg-blue-600/30 text-blue-400 shrink-0">
        {notification.type === 'task_reminder' ? (
          <CheckCircle2 className="w-5 h-5" />
        ) : (
          <MessageSquare className="w-5 h-5" />
        )}
      </div>
      <div className="flex-1 min-w-0 pb-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold tracking-wider text-blue-400 uppercase flex items-center gap-1.5">
            Productivity Assistant
            {isHovered && (
              <span className="text-[9px] text-amber-300 font-normal lowercase bg-amber-500/20 px-1.5 py-0.5 rounded-full border border-amber-500/30">
                paused
              </span>
            )}
          </span>
          <span className="text-[10px] text-slate-400">{notification.timestamp}</span>
        </div>
        <h4 className="text-sm font-semibold text-slate-100 truncate mt-0.5">{notification.title}</h4>
        <p className="text-xs text-slate-300 line-clamp-2 mt-0.5">{notification.message}</p>

        {notification.taskId && onOpenTask && (
          <button
            onClick={() => {
              onOpenTask(notification.taskId!);
              onDismiss(notification.id);
            }}
            className="mt-2 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center gap-1 cursor-pointer"
          >
            View Task Details →
          </button>
        )}
      </div>
      <button
        onClick={() => {
          setIsFadingOut(true);
          setTimeout(() => onDismiss(notification.id), 200);
        }}
        className="text-slate-400 hover:text-slate-200 p-1 shrink-0 rounded-lg cursor-pointer"
        title="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Auto-Dismiss Inactivity Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800/80">
        <div
          className={`h-full transition-all duration-100 ${
            isHovered ? 'bg-amber-400/80' : 'bg-blue-500/80'
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
};

export const AndroidShadeNotification: React.FC<AndroidShadeNotificationProps> = ({
  notifications,
  onDismiss,
  onOpenTask,
}) => {
  const unread = notifications.filter((n) => !n.read);

  if (unread.length === 0) return null;

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md space-y-2 pointer-events-none">
      {unread.slice(-2).map((n) => (
        <NotificationItem
          key={n.id}
          notification={n}
          onDismiss={onDismiss}
          onOpenTask={onOpenTask}
        />
      ))}
    </div>
  );
};

