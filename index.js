/**
 * @format
 */

import { AppRegistry, LogBox } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { enableScreens } from 'react-native-screens';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, { EventType } from '@notifee/react-native';
import { showTestNotification, notificationId } from './src/widget/notifyee-widget-utils';
import MMKVStorage from "react-native-mmkv-storage";

enableScreens();

// Suppress noisy warnings during development
LogBox.ignoreLogs(['VirtualizedLists should never be nested']);

// Initialize MMKV storage
export const MMkvstorage = new MMKVStorage.Loader().initialize();

// Helper to safely retrieve and parse stored notification data
const getStoredNotificationData = async () => {
  try {
    const storedData = await AsyncStorage.getItem('lastNotificationData');
    if (!storedData) return null;
    return JSON.parse(storedData);
  } catch (error) {
    console.error('Failed to parse stored notification data:', error);
    return null;
  }
};

// Handle foreground notification events
notifee.onForegroundEvent(async ({ type, detail }) => {
  if (type === EventType.DISMISSED && detail.notification?.id === notificationId) {
    const data = await getStoredNotificationData();
    if (data) {
      await showTestNotification(data);
    } else {
      console.warn('No stored notification data to re-push (foreground)');
    }
  }
});

// Handle background notification events
notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.DISMISSED && detail.notification?.id === notificationId) {
    const data = await getStoredNotificationData();
    if (data) {
      await showTestNotification(data);
    } else {
      console.warn('No stored notification data to re-push (background)');
    }
  }
});

// Register foreground service with action handling
notifee.registerForegroundService(notification => {
  return new Promise(resolve => {
    notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'stop') {
        notifee.stopForegroundService().then(resolve);
      }
    });
  });
});

// Register the app
AppRegistry.registerComponent(appName, () => App);
