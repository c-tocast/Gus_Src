/**
 * Violet System & Mobile Chrome Notification Helper
 */

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      return reg;
    } catch (err) {
      console.warn('Service worker registration failed:', err);
    }
  }
  return null;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (e) {
    console.error('Permission request error:', e);
    return 'denied';
  }
}

export async function sendSystemDesktopNotification(title: string, body: string, taskId?: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }

  if (Notification.permission !== 'granted') {
    return;
  }

  const notificationOptions: NotificationOptions = {
    body,
    icon: '/icon_192x192.png',
    badge: '/icon_192x192.png',
    tag: taskId || `violet-notif-${Date.now()}`,
    data: { taskId },
  };

  try {
    // 1. Try Service Worker Notification (Primary for Chrome Mobile / Desktop PWA)
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.active) {
        reg.showNotification(title, notificationOptions);
        return;
      }
    }

    // 2. Fallback to standard Web Notification API (Desktop Browsers)
    const notif = new Notification(title, notificationOptions);
    notif.onclick = () => {
      window.focus();
      notif.close();
    };
  } catch (err) {
    console.warn('System Notification display error:', err);
  }
}
