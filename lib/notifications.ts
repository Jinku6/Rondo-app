import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

type NotificationRouter = {
  push: (href: any) => void;
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const getProjectId = () =>
  Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? null;

export async function registerForPushNotificationsAsync() {
  try {
    if (Platform.OS === 'web' || !Device.isDevice) return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Rondo',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#22C55E',
      });
    }

    const existingPermissions = await Notifications.getPermissionsAsync();
    let finalStatus = existingPermissions.status;

    if (finalStatus !== 'granted') {
      const requestedPermissions = await Notifications.requestPermissionsAsync();
      finalStatus = requestedPermissions.status;
    }

    if (finalStatus !== 'granted') return null;

    const projectId = getProjectId();
    if (!projectId) return null;

    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch (error) {
    if (__DEV__) console.warn('register push notifications error:', error);
    return null;
  }
}

export async function savePushToken(token: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('push_tokens')
      .upsert(
        {
          user_id: user.id,
          token,
          platform: Platform.OS,
          enabled: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'token' },
      );

    if (error && __DEV__) console.warn('save push token error:', error.message);
  } catch (error) {
    if (__DEV__) console.warn('save push token exception:', error);
  }
}

export async function removePushToken() {
  try {
    if (Platform.OS === 'web' || !Device.isDevice) return;

    const projectId = getProjectId();
    if (!projectId) return;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return;

    const { error } = await supabase
      .from('push_tokens')
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .eq('token', token);

    if (error && __DEV__) console.warn('remove push token error:', error.message);
  } catch (error) {
    if (__DEV__) console.warn('remove push token exception:', error);
  }
}

export function handleNotificationNavigation(
  notification: Notifications.Notification,
  router: NotificationRouter,
) {
  try {
    const url = notification.request.content.data?.url;
    if (typeof url !== 'string' || !url.startsWith('/')) return;
    router.push(url);
  } catch (error) {
    if (__DEV__) console.warn('notification navigation error:', error);
  }
}

export async function saveUserLocationPreference(params: {
  city: string;
  latitude: number;
  longitude: number;
}) {
  try {
    const city = params.city.trim();
    if (!city || !Number.isFinite(params.latitude) || !Number.isFinite(params.longitude)) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('user_location_preferences')
      .upsert(
        {
          user_id: user.id,
          city,
          latitude: params.latitude,
          longitude: params.longitude,
          source: 'search',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );

    if (error && __DEV__) console.warn('save location preference error:', error.message);
  } catch (error) {
    if (__DEV__) console.warn('save location preference exception:', error);
  }
}
