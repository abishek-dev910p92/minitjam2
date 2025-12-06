import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type PartyKey = string; // format: `${type}:${id}`

type UnreadMap = Record<PartyKey, number>;
type FlagMap = Record<PartyKey, boolean>;

interface NotificationState {
  unreadByKey: UnreadMap;
  starred: FlagMap; // important marker
  highlighted: FlagMap; // unread highlight marker
  totalUnread: number;
  lastMessageAt: Record<PartyKey, number>;
  initialized: boolean;
  rehydrateError: string | null;
  // actions
  incrementUnread: (key: PartyKey, opts?: { star?: boolean; previewText?: string; title?: string; force?: boolean; count?: number }) => void;
  markRead: (key: PartyKey) => void;
  markAllRead: () => void;
  setStar: (key: PartyKey, starred: boolean) => void;
  setHighlight: (key: PartyKey, highlighted: boolean) => void;
  setLastMessageAt: (key: PartyKey, ts: number) => void;
  hydrate: () => Promise<void>;
  reset: () => void;
  setUnreadFromServer: (map: UnreadMap) => void;
}

// Track foreground/background to decide local notifications
let isForeground = true;
try {
  isForeground = AppState.currentState === 'active';
  AppState.addEventListener('change', (state) => {
    isForeground = state === 'active';
  });
} catch {}

async function scheduleLocalNotification(title: string, body: string) {
  try {
    // Skip scheduling on web
    if (Platform.OS === 'web') return;
    const Notifications = await import('expo-notifications');
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: null,
    });
  } catch (e) {
    // ignore any scheduling errors
  }
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      unreadByKey: {},
      starred: {},
      highlighted: {},
      totalUnread: 0,
      lastMessageAt: {},
      initialized: false,
      rehydrateError: null,
      incrementUnread: (key, opts) => {
        const now = Date.now();
        const lastTs = get().lastMessageAt[key] ?? 0;
        // De-dup within 800ms for realtime; allow force for offline flush
        if (!opts?.force && (now - lastTs < 800)) {
          return;
        }
        const prev = get().unreadByKey[key] ?? 0;
        const delta = Math.max(1, Number(opts?.count ?? 1));
        const unreadByKey = { ...get().unreadByKey, [key]: prev + delta };
        const totalUnread = Object.values(unreadByKey).reduce((a, b) => a + (b || 0), 0);
        const highlighted = { ...get().highlighted, [key]: true };
        const starred = opts?.star ? { ...get().starred, [key]: true } : get().starred;
        const lastMessageAt = { ...get().lastMessageAt, [key]: now };
        set({ unreadByKey, totalUnread, highlighted, starred, lastMessageAt });

        // Local notification fallback when not foreground
        if (!isForeground) {
          const title = opts?.title || 'New message';
          const body = opts?.previewText || 'You have a new message';
          scheduleLocalNotification(title, body);
        }
      },
      setUnreadFromServer: (map) => {
        const unreadByKey = { ...(map || {}) };
        const totalUnread = Object.values(unreadByKey).reduce((a, b) => a + (b || 0), 0);
        const highlighted: FlagMap = {};
        Object.keys(unreadByKey).forEach((k) => { if ((unreadByKey as any)[k] > 0) highlighted[k] = true; });
        set({ unreadByKey, totalUnread, highlighted });
      },
      markRead: (key) => {
        const unreadByKey = { ...get().unreadByKey };
        delete unreadByKey[key];
        const totalUnread = Object.values(unreadByKey).reduce((a, b) => a + (b || 0), 0);
        const highlighted = { ...get().highlighted };
        delete highlighted[key];
        set({ unreadByKey, totalUnread, highlighted });
      },
      markAllRead: () => {
        set({ unreadByKey: {}, totalUnread: 0, highlighted: {} });
      },
      setStar: (key, value) => {
        const starred = { ...get().starred };
        if (value) starred[key] = true; else delete starred[key];
        set({ starred });
      },
      setHighlight: (key, value) => {
        const highlighted = { ...get().highlighted };
        if (value) highlighted[key] = true; else delete highlighted[key];
        set({ highlighted });
      },
      setLastMessageAt: (key, ts) => {
        const lastMessageAt = { ...get().lastMessageAt, [key]: ts };
        set({ lastMessageAt });
      },
      hydrate: async () => {
        try {
          const anyStore: any = useNotificationStore as any;
          if (anyStore.persist?.rehydrate) {
            await anyStore.persist.rehydrate();
          }
          try {
            const raw = await AsyncStorage.getItem('notification-store');
            if (raw) {
              const persisted = JSON.parse(String(raw));
              const st: any = (persisted && typeof persisted === 'object' && 'state' in persisted) ? (persisted as any).state : (persisted || {});
              const unreadByKey: UnreadMap = st.unreadByKey || {};
              const starred: FlagMap = st.starred || {};
              const lastMessageAt: Record<PartyKey, number> = st.lastMessageAt || {};
              const highlighted: FlagMap = {};
              Object.keys(unreadByKey).forEach((k) => { if ((unreadByKey as any)[k] > 0) highlighted[k] = true; });
              const totalUnread = Object.values(unreadByKey).reduce((a, b) => a + (Number(b) || 0), 0);
              (useNotificationStore as any).setState({ unreadByKey, starred, highlighted, lastMessageAt, totalUnread, initialized: true, rehydrateError: null });
            } else {
              set({ initialized: true, rehydrateError: null });
            }
          } catch {
            set({ initialized: true, rehydrateError: null });
          }
        } catch (e) {
          set({ initialized: true, rehydrateError: (e as any)?.message || 'Failed to rehydrate' });
        }
      },
      reset: () => {
        set({ unreadByKey: {}, starred: {}, highlighted: {}, totalUnread: 0, lastMessageAt: {}, rehydrateError: null });
      },
    }),
    {
      name: 'notification-store',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (state) => ({
        unreadByKey: state.unreadByKey,
        starred: state.starred,
        totalUnread: state.totalUnread,
        lastMessageAt: state.lastMessageAt,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          try { (useNotificationStore as any).setState({ initialized: true, rehydrateError: String(error) }); } catch {}
        } else {
          try {
            const s: any = state || {};
            const unread: UnreadMap = s.unreadByKey || {};
            const starred: FlagMap = s.starred || {};
            const lastMessageAt: Record<PartyKey, number> = s.lastMessageAt || {};
            const highlighted: FlagMap = { ...(s.highlighted || {}) };
            Object.keys(unread).forEach((k) => { if ((unread as any)[k] > 0) highlighted[k] = true; });
            const total = Object.values(unread).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
            (useNotificationStore as any).setState({ unreadByKey: unread, starred, highlighted, lastMessageAt, totalUnread: total, initialized: true, rehydrateError: null });
          } catch {
            try { (useNotificationStore as any).setState({ initialized: true, rehydrateError: null }); } catch {}
          }
        }
      },
    }
  )
);

export function makePartyKey(type: string, id: number | string): PartyKey {
  return `${String(type)}:${String(id)}`;
}
