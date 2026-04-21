import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onPress: () => void;
  };
}

interface NotificationContextType {
  notifications: Notification[];
  show: (notification: Omit<Notification, 'id'>) => void;
  dismiss: (id: string) => void;
  clear: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const show = useCallback((notification: Omit<Notification, 'id'>) => {
    const id = Date.now().toString();
    const fullNotification: Notification = {
      ...notification,
      id,
      duration: notification.duration ?? 3000,
    };

    setNotifications(prev => [...prev, fullNotification]);

    if (fullNotification.duration > 0) {
      setTimeout(() => {
        dismiss(id);
      }, fullNotification.duration);
    }
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clear = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, show, dismiss, clear }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
}
