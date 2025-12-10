import { Stack, router } from "expo-router";
import { SafeAreaProvider } from 'react-native-safe-area-context';
import useAuthStore from './_utils/authStore';
import "./global.css";
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiEndpoints from './api/baseUrl';
import { useNotificationStore, makePartyKey } from '../utils/notificationStore';
import useUserData from './_utils/Localstorage';
import io from 'socket.io-client';

export default function RootLayout() {

const {isLoggedIn, shouldCreateAccount, hasCreatedAccount} = useAuthStore();
const { user } = useUserData();
const notifySocketRef = React.useRef<any>(null);
const incrementUnread = useNotificationStore((s) => s.incrementUnread);
const storeInitialized = useNotificationStore((s) => s.initialized);
const rehydrateError = useNotificationStore((s) => s.rehydrateError);

  // Register push notifications and deep-link handling on app mount
  useEffect(() => {
    let sub: any;
    const init = async () => {
      try {
        const isWeb = Platform.OS === 'web';
        const isExpoGo = Constants.appOwnership === 'expo';
        if (isWeb || isExpoGo) {
          // Skip push registration in web or Expo Go (use a dev build for push)
          return;
        }

        const Notifications = await import('expo-notifications');

        // Show foreground notifications
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });

        const perm = await Notifications.getPermissionsAsync();
        if (!perm.granted) {
          const req = await Notifications.requestPermissionsAsync();
          if (!req.granted) return;
        }

        if (Platform.OS === 'android') {
          try {
            await Notifications.setNotificationChannelAsync('messages', {
              name: 'Messages',
              importance: Notifications.AndroidImportance.MAX,
              sound: 'default',
              vibrationPattern: [0, 250, 250, 250],
              lightColor: '#FF231F7C',
            } as any);
          } catch {}
        } else {
          try {
            await Notifications.setNotificationCategoryAsync('MESSAGE', [{
              identifier: 'OPEN',
              buttonTitle: 'Open',
              options: { opensAppToForeground: true },
            }]);
          } catch {}
        }

        // Resolve projectId for Expo push token
        const projectId =
          (Constants as any)?.expoConfig?.extra?.eas?.projectId ??
          (Constants as any)?.expoConfig?.projectId ??
          (Constants as any)?.easConfig?.projectId ?? null;

        if (!projectId) {
          // Without projectId, Expo push token cannot be fetched
          console.log('Skipping Expo push token: missing projectId');
          return;
        }

        const expoToken = await Notifications.getExpoPushTokenAsync({ projectId });
        const token = (expoToken as any).data;
        const userToken = await AsyncStorage.getItem('userToken');
        if (!userToken || !token) return;
        await AsyncStorage.setItem('expoPushToken', String(token));
        await fetch(`${apiEndpoints.baseURL}notifications/register-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userToken}`,
          },
          body: JSON.stringify({ token, platform: Platform.OS, allow_preview: true }),
        }).catch(() => {});

        Notifications.addNotificationReceivedListener((notification: any) => {
          try {
            const data: any = notification?.request?.content?.data;
            if (data?.screen === 'chats') {
              const currentUserType = (user as any)?.artist_id ? 'artist' : 'club';
              const currentUserId = (user as any)?.artist_id ?? (user as any)?.id ?? '';
              const isIncoming = !(data.sender_type === currentUserType && Number(data.sender_id) === Number(currentUserId));
              const addressedToCurrentUser = (data.receiver_type === currentUserType && Number(data.receiver_id) === Number(currentUserId));
              if (!isIncoming || !addressedToCurrentUser) return;
              const key = makePartyKey(data.sender_type, data.sender_id);
              incrementUnread(key, { star: true, previewText: String(notification?.request?.content?.body ?? ''), title: String(notification?.request?.content?.title ?? 'New message'), force: true });
              try {
                const total = useNotificationStore.getState().totalUnread || 0;
                Notifications.setBadgeCountAsync?.(total);
              } catch {}
            }
          } catch {}
        });

        // Deep-link from notification
        sub = Notifications.addNotificationResponseReceivedListener((response: any) => {
          try {
            const data: any = response?.notification?.request?.content?.data;
            if (data?.screen === 'chats') {
              const { sender_type, sender_id, receiver_type, receiver_id } = data;
              router.push(`/chats?sender_type=${sender_type}&sender_id=${sender_id}&receiver_type=${receiver_type}&receiver_id=${receiver_id}`);
            }
            try {
              const total = useNotificationStore.getState().totalUnread || 0;
              Notifications.setBadgeCountAsync?.(total);
            } catch {}
          } catch (e) {}
        });
      } catch (e) {
        console.log('Push token registration failed', e);
      }
    };
    init();

    return () => {
      try { if (sub) sub.remove(); } catch (e) {}
    };
  }, []);

  // Global realtime notifications listener: DM notify channel + group rooms
  useEffect(() => {
    let cancelled = false;
    const setup = async () => {
      try {
        if (!isLoggedIn || !storeInitialized) return;
        if (rehydrateError) {
          console.warn('[notifications] State restore failed; continuing with empty state:', rehydrateError);
        }
        const token = await AsyncStorage.getItem('userToken');
        const baseHost = apiEndpoints.featuredVenues.replace(/\/venues\/featured\/?$/, '').replace(/\/api\/?$/, '').replace(/\/$/, '');
        notifySocketRef.current = io(baseHost, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 1000,
          timeout: 20000,
          auth: { token: token || '' },
        });
        notifySocketRef.current.on('connect', () => {
          try {
            const currentUserId = (user as any)?.artist_id ?? (user as any)?.id ?? '';
            notifySocketRef.current.emit('user-online', currentUserId);
          } catch {}
        });
        notifySocketRef.current.on('reconnect', () => {
          try {
            const currentUserId = (user as any)?.artist_id ?? (user as any)?.id ?? '';
            notifySocketRef.current.emit('user-online', currentUserId);
          } catch {}
        });

        // DM notifications via per-user room — count only when current user is receiver
        notifySocketRef.current.on('notify:new_message', async (msg: any) => {
          try {
            const currentUserType = (user as any)?.artist_id ? 'artist' : 'club';
            const currentUserId = (user as any)?.artist_id ?? (user as any)?.id ?? '';
            const isIncoming = !(msg.sender_type === currentUserType && Number(msg.sender_id) === Number(currentUserId));
            const addressedToCurrentUser = (msg.receiver_type === currentUserType && Number(msg.receiver_id) === Number(currentUserId));
            if (!isIncoming || !addressedToCurrentUser) return;
            const otherType = msg.sender_type;
            const otherId = msg.sender_id;
            const key = makePartyKey(otherType, otherId);
            incrementUnread(key, { star: true, previewText: String(msg?.message ?? ''), title: 'New message' });
            try {
              if (Constants.appOwnership !== 'expo') {
                const Notifications = await import('expo-notifications');
                const total = useNotificationStore.getState().totalUnread || 0;
                Notifications.setBadgeCountAsync?.(total);
              }
            } catch {}
          } catch {}
        });

        // Fetch groups and join their rooms for global group notifications
        try {
          const base = apiEndpoints.featuredVenues.replace('venues/featured', '');
          const headers: Record<string, string> = {};
          if (token) headers.Authorization = `Bearer ${token}`;
          const res = await fetch(base + 'rooms', { headers });
          if (res.ok) {
            const rooms = await res.json();
            rooms.forEach((g: any) => {
              const roomId = g?.room_id ?? g?.id;
              if (roomId) notifySocketRef.current.emit('group:join', { room_id: roomId });
            });
          }
        } catch {}

        // Group messages — count only when sent by someone else
        notifySocketRef.current.on('group:message', async (msg: any) => {
          try {
            const roomId = msg?.room_id;
            if (!roomId) return;
            const currentUserType = (user as any)?.artist_id ? 'artist' : 'club';
            const currentUserId = (user as any)?.artist_id ?? (user as any)?.id ?? '';
            const isIncoming = !(msg.sender_type === currentUserType && Number(msg.sender_id) === Number(currentUserId));
            if (!isIncoming) return;
            const key = makePartyKey('group', String(roomId));
            incrementUnread(key, { star: true, previewText: String(msg?.ciphertext ?? ''), title: 'New group message' });
            try {
              if (Constants.appOwnership !== 'expo') {
                const Notifications = await import('expo-notifications');
                const total = useNotificationStore.getState().totalUnread || 0;
                Notifications.setBadgeCountAsync?.(total);
              }
            } catch {}
          } catch {}
        });

        notifySocketRef.current.on('new-message', async (msg: any) => {
          try {
            if (!msg || msg.chat_id == null || msg.sender_id == null || msg.receiver_id == null) return;
            const currentUserType = (user as any)?.artist_id ? 'artist' : 'club';
            const currentUserId = (user as any)?.artist_id ?? (user as any)?.id ?? '';
            const isIncoming = !(msg.sender_type === currentUserType && Number(msg.sender_id) === Number(currentUserId));
            const addressedToCurrentUser = (msg.receiver_type === currentUserType && Number(msg.receiver_id) === Number(currentUserId));
            if (!isIncoming || !addressedToCurrentUser) return;
            const key = makePartyKey(msg.sender_type, msg.sender_id);
            incrementUnread(key, { star: true, previewText: String(msg?.message ?? ''), title: 'New message', force: true });
            try {
              if (Constants.appOwnership !== 'expo') {
                const Notifications = await import('expo-notifications');
                const total = useNotificationStore.getState().totalUnread || 0;
                Notifications.setBadgeCountAsync?.(total);
              }
            } catch {}
          } catch {}
        });

        // Initial unread reconciliation from server on app open
        try {
          const headers: Record<string, string> = {};
          if (token) headers.Authorization = `Bearer ${token}`;
          const res = await fetch(apiEndpoints.chat + '/unread', { headers });
          if (res.ok) {
            const json = await res.json();
            const map: Record<string, number> = {};
            (json?.conversations || []).forEach((c: any) => {
              const key = makePartyKey(c?.other_party_type, c?.other_party_id);
              map[key] = Number(c?.unread_count || 0);
            });
            try { (useNotificationStore as any).setState?.({}); } catch {}
            try { useNotificationStore.getState().setUnreadFromServer(map); } catch {}
            try {
              if (Constants.appOwnership !== 'expo') {
                const Notifications = await import('expo-notifications');
                const total = useNotificationStore.getState().totalUnread || 0;
                Notifications.setBadgeCountAsync?.(total);
              }
            } catch {}
          }
        } catch {}
      } catch {}
    };
    setup();

    return () => {
      try { notifySocketRef.current?.disconnect?.(); } catch {}
      notifySocketRef.current = null;
    };
  }, [isLoggedIn, storeInitialized, (user as any)?.id, rehydrateError]);
  return (
  
  <SafeAreaProvider>
  <Stack>
  <Stack.Protected guard={isLoggedIn}>
  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
  <Stack.Screen name="venue_details/[id]" options={{ headerShown: false }} />
  <Stack.Screen name="artist_details/[id]" options={{ headerShown: false }} />
  <Stack.Screen name="gig_details/[id]" options={{ headerShown: false }} />
  <Stack.Screen name="gig_details/apply_gig" options={{ headerShown: false }} />
  <Stack.Screen name="gig_details/myopportunities" options={{ headerShown: false }} />
  <Stack.Screen name="bands/create_band" options={{ headerShown: false }} />
  <Stack.Screen name="bands/band_profile_view" options={{ headerShown: false }} />
  <Stack.Screen name="bands/band_profile" options={{ headerShown: false }} />
  <Stack.Screen name="settings" options={{ headerShown: false }} /> 

    </Stack.Protected>
    {/* Sign-in screen */} 
    <Stack.Protected guard={!isLoggedIn && hasCreatedAccount}> 
    <Stack.Screen name="sign-in" options={{ headerShown: false }} />
    </Stack.Protected>
    {/* Create account screen */} 
    <Stack.Protected guard={shouldCreateAccount}>
    <Stack.Screen name="create-account" options={{ headerShown: false }} />
    </Stack.Protected>
    <Stack.Protected guard={!hasCreatedAccount}>
    <Stack.Screen name="onboarding" options={{ headerShown: false }} />
    </Stack.Protected>
    <Stack.Screen name="chats" options={{ headerShown: false }} />
    <Stack.Screen name="Accounts" options={{ headerShown: false }} />
    <Stack.Screen name="notifications" options={{ headerShown: false }} />
    <Stack.Screen name="notificationSettings" options={{ headerShown: false }} />
    <Stack.Screen name="helpSupport" options={{ headerShown: false }} />
    <Stack.Screen name="linkedAccounts" options={{ headerShown: false }} />
    <Stack.Screen name="Aboutus" options={{ headerShown: false }} />
    <Stack.Screen name="privacy" options={{ headerShown: false }} />
    </Stack>
    </SafeAreaProvider>
    
  );
}
  
