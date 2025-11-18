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
        await fetch(`${apiEndpoints.baseURL}/api/notifications/register-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userToken}`,
          },
          body: JSON.stringify({ token, platform: Platform.OS, allow_preview: true }),
        }).catch(() => {});

        // Deep-link from notification
        sub = Notifications.addNotificationResponseReceivedListener((response: any) => {
          try {
            const data: any = response?.notification?.request?.content?.data;
            if (data?.screen === 'chats') {
              const { sender_type, sender_id, receiver_type, receiver_id } = data;
              router.push(`/chats?sender_type=${sender_type}&sender_id=${sender_id}&receiver_type=${receiver_type}&receiver_id=${receiver_id}`);
            }
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

        // DM notifications via per-user room
        notifySocketRef.current.on('notify:new_message', (msg: any) => {
          try {
            const currentUserType = (user as any)?.artist_id ? 'artist' : 'club';
            const currentUserId = (user as any)?.artist_id ?? (user as any)?.id ?? '';
            const otherType = (msg.sender_type === currentUserType && Number(msg.sender_id) === Number(currentUserId)) ? msg.receiver_type : msg.sender_type;
            const otherId = (msg.sender_type === currentUserType && Number(msg.sender_id) === Number(currentUserId)) ? msg.receiver_id : msg.sender_id;
            const key = makePartyKey(otherType, otherId);
            incrementUnread(key, { star: true, previewText: String(msg?.message ?? ''), title: 'New message' });
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

        // Group messages: increment unread/star
        notifySocketRef.current.on('group:message', (msg: any) => {
          try {
            const roomId = msg?.room_id;
            if (!roomId) return;
            // Only star for incoming messages; we cannot compute sender reliably here without user data duplication
            const key = makePartyKey('group', String(roomId));
            incrementUnread(key, { star: true, previewText: String(msg?.ciphertext ?? ''), title: 'New group message' });
          } catch {}
        });
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
    </Stack>
    </SafeAreaProvider>
    
  );
}
  