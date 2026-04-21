import React, { useEffect, useState } from 'react';
import {
  Animated,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useNotification, Notification } from '@/hooks/use-notification';
import { AppColors } from '@/constants/theme';

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingHorizontal: 0,
  },
  notificationCard: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  successCard: {
    backgroundColor: '#d4edda',
    borderLeftWidth: 4,
    borderLeftColor: '#28a745',
  },
  errorCard: {
    backgroundColor: '#f8d7da',
    borderLeftWidth: 4,
    borderLeftColor: '#dc3545',
  },
  warningCard: {
    backgroundColor: '#fff3cd',
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  infoCard: {
    backgroundColor: '#d1ecf1',
    borderLeftWidth: 4,
    borderLeftColor: '#17a2b8',
  },
  icon: {
    fontSize: 20,
    marginRight: 12,
    marginTop: 2,
  },
  content: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    color: AppColors.onSurface,
  },
  message: {
    fontSize: 13,
    color: AppColors.onSurface,
    lineHeight: 18,
  },
  actionButton: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.onSurface,
  },
  closeButton: {
    padding: 4,
  },
  closeIcon: {
    fontSize: 20,
    color: AppColors.onSurface,
  },
});

function NotificationItem({ notification, onDismiss }: { notification: Notification; onDismiss: () => void }) {
  const getCardStyle = () => {
    switch (notification.type) {
      case 'success':
        return styles.successCard;
      case 'error':
        return styles.errorCard;
      case 'warning':
        return styles.warningCard;
      case 'info':
        return styles.infoCard;
      default:
        return styles.infoCard;
    }
  };

  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      default:
        return 'ℹ';
    }
  };

  return (
    <View style={[styles.notificationCard, getCardStyle()]}>
      <Text style={styles.icon}>{getIcon()}</Text>
      <View style={styles.content}>
        <Text style={styles.title}>{notification.title}</Text>
        <Text style={styles.message}>{notification.message}</Text>
        {notification.action && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              notification.action?.onPress();
              onDismiss();
            }}
          >
            <Text style={styles.actionButtonText}>{notification.action.label}</Text>
          </TouchableOpacity>
        )}
      </View>
      <TouchableOpacity style={styles.closeButton} onPress={onDismiss}>
        <Text style={styles.closeIcon}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

export function NotificationDisplay() {
  const { notifications, dismiss } = useNotification();

  return (
    <View style={styles.container}>
      {notifications.map(notification => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onDismiss={() => dismiss(notification.id)}
        />
      ))}
    </View>
  );
}
