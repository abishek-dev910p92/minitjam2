import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, FlatList, Platform, LayoutAnimation, UIManager, StyleSheet, Text, TouchableOpacity, View, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import useUserData from '../_utils/Localstorage';
import apiEndpoints from '../api/baseUrl';
import io from 'socket.io-client';
import { useNotificationStore, makePartyKey } from '../../utils/notificationStore';


// --- Icon Component ---
const ArrowLeftIcon = () => (
  <Svg height="24" width="24" viewBox="0 0 256 256">
    <Path fill="black" d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z" />
  </Svg>
);

// --- Icons ---
const StarIcon = ({ filled }: { filled?: boolean }) => (
  <Svg height="20" width="20" viewBox="0 0 24 24">
    <Path
      fill={filled ? '#F59E0B' : '#9CA3AF'}
      d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
    />
  </Svg>
);

// --- Reusable Component ---
const MessageListItem = ({
  name,
  imageUrl,
  href,
  online,
  highlight = false,
  onPress,
  showStar = false,
}: {
  name: string,
  imageUrl: string,
  href?: string,
  online?: boolean,
  highlight?: boolean,
  onPress?: () => void,
  showStar?: boolean,
}) => {
  const highlightBg = Platform.OS === 'ios' ? 'rgba(10, 132, 255, 0.08)' : 'rgba(59, 130, 246, 0.12)';
  return (
    <View style={[styles.listItem, highlight ? { backgroundColor: highlightBg, borderLeftWidth: 3, borderLeftColor: '#3B82F6' } : null]}>
      <Link href={(href ?? '/chats') as any} asChild>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 16, flex: 1 }} onPress={onPress}>
          <View style={{ position: 'relative' }}>
            <Image style={styles.avatar} source={{ uri: imageUrl }} />
            {online ? <View style={styles.onlineDot} /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.textPrimary}>{name}</Text>
          </View>
        </TouchableOpacity>
      </Link>
      {showStar ? (
        <View style={styles.starIndicator}>
          <StarIcon filled />
        </View>
      ) : null}
    </View>
  );
};

// Group item component
const GroupListItem = ({
  name,
  href,
  showStar = false,
  onPress,
  onManage,
}: {
  name: string,
  href?: string,
  showStar?: boolean,
  onPress?: () => void,
  onManage?: () => void,
}) => {
  return (
    <View style={styles.listItem}>
      <Link href={(href ?? '/chats') as any} asChild>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 16, flex: 1 }} onPress={onPress}>
          <View style={{ height: 40, width: 40, borderRadius: 20, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#111827', fontWeight: '600' }}>G</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.textPrimary}>{name}</Text>
          </View>
        </TouchableOpacity>
      </Link>
      {showStar ? (
        <View style={styles.starIndicator}>
          <StarIcon filled />
        </View>
      ) : null}
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={'Manage group'} style={styles.manageButton} onPress={onManage}>
        <Text style={{ color: '#3B82F6', fontWeight: '600' }}>Manage</Text>
      </TouchableOpacity>
    </View>
  );
};

export default function MessagesScreen() {
    const { user } = useUserData();
    const [conversations, setConversations] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const socketRef = React.useRef<any>(null);
    // Notification store selectors
    const unreadByKey = useNotificationStore((s) => s.unreadByKey);
    const starred = useNotificationStore((s) => s.starred);
    const highlighted = useNotificationStore((s) => s.highlighted);
    const incrementUnread = useNotificationStore((s) => s.incrementUnread);
    const markRead = useNotificationStore((s) => s.markRead);
    const setStar = useNotificationStore((s) => s.setStar);
    const setHighlight = useNotificationStore((s) => s.setHighlight);
    const storeInitialized = useNotificationStore((s) => s.initialized);
    const restoreError = useNotificationStore((s) => s.rehydrateError);
    const hydrateStore = useNotificationStore((s) => s.hydrate);
    // New message notification stars (groups only managed via store, keep local list for UI performance minimal footprint)
    const [groups, setGroups] = useState<any[]>([]);
    // Group creation UI state
    const [groupModalOpen, setGroupModalOpen] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
    const [groupCreating, setGroupCreating] = useState(false);
    const [groupCreateError, setGroupCreateError] = useState<string | null>(null);
    const [managingGroupId, setManagingGroupId] = useState<number | null>(null);
    const [memberAddLoading, setMemberAddLoading] = useState(false);
    const [memberAddError, setMemberAddError] = useState<string | null>(null);
    React.useEffect(() => {
      try {
        const isNewArch = (Platform as any)?.constants?.isNewArchEnabled ?? true;
        if (Platform.OS === 'android' && !isNewArch && (UIManager as any)?.setLayoutAnimationEnabledExperimental) {
          (UIManager as any).setLayoutAnimationEnabledExperimental(true);
        }
      } catch {}
    }, []);
    const sortConversations = React.useCallback((list: any[]) => {
      return [...list].sort((a, b) => {
        const at = Number(a?.lastActivityAt ?? 0);
        const bt = Number(b?.lastActivityAt ?? 0);
        if (at !== bt) return bt - at;
        if (!!a?.online && !b?.online) return -1;
        if (!!b?.online && !a?.online) return 1;
        const an = (a?.name ?? '').toLowerCase();
        const bn = (b?.name ?? '').toLowerCase();
        return an.localeCompare(bn);
      });
    }, []);

    const nameCacheRef = React.useRef<Map<string, { name: string; image: string }>>(new Map());
    const cacheKey = 'contact-cache';
    const cachePut = React.useCallback(async (type: string, id: string | number, name: string, image: string) => {
      const key = `${String(type)}:${String(id)}`;
      nameCacheRef.current.set(key, { name, image });
      try {
        const raw = await AsyncStorage.getItem(cacheKey);
        const obj = raw ? JSON.parse(raw) : {};
        obj[key] = { name, image };
        const keys = Object.keys(obj);
        if (keys.length > 200) {
          delete obj[keys[0]];
        }
        await AsyncStorage.setItem(cacheKey, JSON.stringify(obj));
      } catch {}
    }, []);
    const cacheGet = React.useCallback((type: string, id: string | number) => {
      const key = `${String(type)}:${String(id)}`;
      return nameCacheRef.current.get(key) || null;
    }, []);
    useEffect(() => {
      let cancelled = false;
      (async () => {
        try {
          const raw = await AsyncStorage.getItem(cacheKey);
          const obj = raw ? JSON.parse(raw) : {};
          Object.keys(obj || {}).forEach((k) => {
            if (!cancelled) nameCacheRef.current.set(k, obj[k]);
          });
        } catch {}
      })();
      return () => { cancelled = true; };
    }, []);

    const getContactInfo = React.useCallback(async (type: string, id: string | number) => {
      const base = apiEndpoints.featuredVenues.replace('venues/featured', '');
      const token = await AsyncStorage.getItem('userToken');
      const headers: any = token ? { Authorization: `Bearer ${token}` } : undefined;
      let url = '';
      if (String(type) === 'artist') url = base + `artists/${encodeURIComponent(String(id))}`;
      else url = base + `venues/${encodeURIComponent(String(id))}`;
      const r = await fetch(url, { headers });
      if (!r.ok) return null;
      const j = await r.json();
      const name = j?.name || j?.display_name || j?.venue_name || (String(type) === 'artist' ? 'Unknown Artist' : 'Unknown Venue');
      const image = j?.profile_image_url || j?.avatar || j?.image || 'https://picsum.photos/seed/fallback/100';
      return { name, image };
    }, []);

    const ensureConversation = React.useCallback((otherType: string, otherId: string | number) => {
      const currentUserType = (user as any)?.artist_id ? 'artist' : 'club';
      const currentUserId = (user as any)?.artist_id ?? (user as any)?.club_id ?? (user as any)?.id ?? '';
      setConversations((prev) => {
        const exists = prev.some((c) => String(c.other_party_type) === String(otherType) && String(c.other_party_id) === String(otherId));
        if (exists) return prev;
        const cached = cacheGet(String(otherType), otherId);
        const n = cached?.name || (String(otherType) === 'artist' ? 'Loading Artist…' : 'Loading Venue…');
        const img = cached?.image || 'https://picsum.photos/seed/fallback/100';
        const href = `/chats?receiver_type=${otherType}&receiver_id=${otherId}&sender_type=${currentUserType}&sender_id=${currentUserId}&receiver_name=${encodeURIComponent(n)}&receiver_avatar=${encodeURIComponent(img)}`;
        const next = [{ other_party_type: otherType, other_party_id: otherId, name: n, image: img, href, lastActivityAt: Date.now(), message_count: 1 }, ...prev];
        return sortConversations(next);
      });
      (async () => {
        const cached = cacheGet(String(otherType), otherId);
        if (cached) return;
        try {
          const info = await getContactInfo(String(otherType), otherId);
          if (!info) return;
          await cachePut(String(otherType), otherId, info.name, info.image);
          setConversations((prev) => prev.map((c) => (
            String(c.other_party_type) === String(otherType) && String(c.other_party_id) === String(otherId)
              ? { ...c, name: info.name, image: info.image }
              : c
          )));
        } catch {}
      })();
    }, [user, cacheGet, cachePut, getContactInfo, sortConversations]);

    // Highlights are managed in global store now, persisted automatically

    // Fetch groups list
    useEffect(() => {
      let cancelled = false;
      const controller = new AbortController();
      (async () => {
        try {
          const base = apiEndpoints.featuredVenues.replace('venues/featured', '');
          const token = await AsyncStorage.getItem('userToken');
          const headers: Record<string, string> = {};
          if (token) headers['Authorization'] = `Bearer ${token}`;
          const res = await fetch(base + 'rooms', { signal: controller.signal, headers });
          if (res.ok) {
            const rooms = await res.json();
            if (!cancelled) setGroups(rooms || []);
          }
        } catch {}
      })();
      return () => { cancelled = true; controller.abort(); };
    }, [user]);
  

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const loadConversations = async () => {
      setLoading(true);
      setError(null);
      try {
        const base = apiEndpoints.featuredVenues.replace('venues/featured', '');
        const token = await AsyncStorage.getItem('userToken');
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const convRes = await fetch(base + 'chats/conversations', { signal: controller.signal, headers });
        if (!convRes.ok) {
          const txt = await convRes.text().catch(() => '');
          throw new Error(txt || `Failed to load conversations (${convRes.status})`);
        }
        const convJson = await convRes.json();
        const convs = Array.isArray(convJson) ? convJson : (convJson?.items ?? []);

        const detailed = await Promise.all(convs.map(async (c: any) => {
          try {
            if (c.other_party_type === 'artist') {
              const r = await fetch(base + `artists/${c.other_party_id}`, { signal: controller.signal, headers });
              const j = r.ok ? await r.json() : null;
              const currentUserType = (user as any)?.artist_id ? 'artist' : 'club';
              const currentUserId = (user as any)?.artist_id ?? (user as any)?.club_id ?? (user as any)?.id ?? '';
              return {
                ...c,
                name: j?.name || j?.display_name || 'Unknown Artist',
                image: j?.profile_image_url || j?.avatar || 'https://picsum.photos/seed/artist/100',
                href: `/chats?receiver_type=artist&receiver_id=${c.other_party_id}&sender_type=${currentUserType}&sender_id=${currentUserId}`,
                lastActivityAt: c?.last_message_at ? Number(new Date(c.last_message_at).getTime()) : (c?.updated_at ? Number(new Date(c.updated_at).getTime()) : 0),
              };
            } else {
              const r = await fetch(base + `venues/${c.other_party_id}`, { signal: controller.signal, headers });
              const j = r.ok ? await r.json() : null;
              const currentUserType = (user as any)?.artist_id ? 'artist' : 'club';
              const currentUserId = (user as any)?.artist_id ?? (user as any)?.club_id ?? (user as any)?.id ?? '';
              return {
                ...c,
                name: j?.name || j?.venue_name || 'Unknown Venue',
                image: j?.profile_image_url || j?.image || 'https://picsum.photos/seed/venue/100',
                href: `/chats?receiver_type=club&receiver_id=${c.other_party_id}&sender_type=${currentUserType}&sender_id=${currentUserId}`,
                lastActivityAt: c?.last_message_at ? Number(new Date(c.last_message_at).getTime()) : (c?.updated_at ? Number(new Date(c.updated_at).getTime()) : 0),
              };
            }
          } catch (e) {
            const currentUserType = (user as any)?.artist_id ? 'artist' : 'club';
            const currentUserId = (user as any)?.artist_id ?? (user as any)?.club_id ?? (user as any)?.id ?? '';
            return {
              ...c,
              name: c.other_party_type === 'artist' ? 'Unknown Artist' : 'Unknown Venue',
              image: 'https://picsum.photos/seed/fallback/100',
              href: c.other_party_type === 'artist' ? `/chats?receiver_type=artist&receiver_id=${c.other_party_id}&sender_type=${currentUserType}&sender_id=${currentUserId}` : `/chats?receiver_type=club&receiver_id=${c.other_party_id}&sender_type=${currentUserType}&sender_id=${currentUserId}`,
              lastActivityAt: c?.last_message_at ? Number(new Date(c.last_message_at).getTime()) : (c?.updated_at ? Number(new Date(c.updated_at).getTime()) : 0),
            };
          }
        }));

        if (!cancelled) {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setConversations(sortConversations(detailed));
          try {
            const obj: any = {};
            detailed.forEach((c: any) => {
              const key = `${String(c.other_party_type)}:${String(c.other_party_id)}`;
              obj[key] = { name: c.name, image: c.image };
              nameCacheRef.current.set(key, { name: c.name, image: c.image });
            });
            const raw = await AsyncStorage.getItem(cacheKey);
            const old = raw ? JSON.parse(raw) : {};
            await AsyncStorage.setItem(cacheKey, JSON.stringify({ ...old, ...obj }));
          } catch {}
        }
      } catch (_e: any) {
        if (_e?.name === 'AbortError') return;
        setError(_e?.message || 'Failed to load conversations');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadConversations();

    // Setup socket for real-time message notifications & presence
    const setupSocket = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const baseHost = apiEndpoints.featuredVenues.replace(/\/venues\/featured\/?$/, '').replace(/\/api\/?$/, '').replace(/\/$/, '');
        socketRef.current = io(baseHost, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 1000,
          timeout: 20000,
          auth: { token: token || '' },
        });

        socketRef.current.on('connect', () => {
          setError(null);
        });

        socketRef.current.on('connect_error', () => {
          setError('Realtime connection unavailable');
        });

        // Presence updates
        socketRef.current.on('presence:update', (p: any) => {
          setConversations((prev) => prev.map((c) => (
            c.other_party_type === p.user_type && c.other_party_id === p.user_id
              ? { ...c, online: !!p.online }
              : c
          )));
        });

        // Message notifications increment unread/star via store (DM room broadcast)
        socketRef.current.on('message', (msg: any) => {
          if (!msg || !msg.sender_type || msg.sender_id == null || !msg.receiver_type || msg.receiver_id == null) return;
          const currentUserType = (user as any)?.artist_id ? 'artist' : 'club';
          const currentUserId = (user as any)?.artist_id ?? (user as any)?.id ?? '';
          const otherType = (msg.sender_type === currentUserType && msg.sender_id === currentUserId)
            ? msg.receiver_type
            : msg.sender_type;
          const otherId = (msg.sender_type === currentUserType && msg.sender_id === currentUserId)
            ? msg.receiver_id
            : msg.sender_id;

          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setConversations((prev) => {
            const updated = prev.map((c) => (
              c.other_party_type === otherType && c.other_party_id === otherId
                ? { ...c, message_count: Number(c.message_count ?? 0) + 1, lastActivityAt: Date.now() }
                : c
            ));
            return sortConversations(updated);
          });
          ensureConversation(String(otherType), otherId);
          // Store-backed star/unread only for incoming messages
          if (!(msg.sender_type === currentUserType && Number(msg.sender_id) === Number(currentUserId))) {
            const key = makePartyKey(otherType, otherId);
            try { incrementUnread(key, { star: true, previewText: String(msg?.message ?? ''), title: 'New message' }); } catch {}
          }
        });

        // User-specific notification channel toggles star/unread even if not joined to DM room
        socketRef.current.on('notify:new_message', (msg: any) => {
          if (!msg || !msg.sender_type || msg.sender_id == null || !msg.receiver_type || msg.receiver_id == null) return;
          const currentUserType = (user as any)?.artist_id ? 'artist' : 'club';
          const currentUserId = (user as any)?.artist_id ?? (user as any)?.id ?? '';
          // Determine the other participant
          const otherType = (msg.sender_type === currentUserType && Number(msg.sender_id) === Number(currentUserId))
            ? msg.receiver_type
            : msg.sender_type;
          const otherId = (msg.sender_type === currentUserType && Number(msg.sender_id) === Number(currentUserId))
            ? msg.receiver_id
            : msg.sender_id;
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setConversations((prev) => {
            const updated = prev.map((c) => (
              c.other_party_type === otherType && Number(c.other_party_id) === Number(otherId)
                ? { ...c, message_count: Number(c.message_count ?? 0) + 1, lastActivityAt: Date.now() }
                : c
            ));
            return sortConversations(updated);
          });
          try {
            const key = makePartyKey(otherType, otherId);
            incrementUnread(key, { star: true, previewText: String(msg?.message ?? ''), title: 'New message' });
          } catch {}
          ensureConversation(String(otherType), otherId);
        });

        socketRef.current.on('dm:started', (payload: any) => {
          const t = payload?.other_party_type;
          const i = payload?.other_party_id;
          if (!t || i == null) return;
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          ensureConversation(String(t), i);
        });

        // Group message notifications
        socketRef.current.on('group:message', (msg: any) => {
          const currentUserType = (user as any)?.artist_id ? 'artist' : 'club';
          const currentUserId = (user as any)?.artist_id ?? (user as any)?.id ?? '';
          const roomId = msg?.room_id;
          if (!roomId) return;
          // Star only for incoming
          if (!(msg.sender_type === currentUserType && Number(msg.sender_id) === Number(currentUserId))) {
            const key = makePartyKey('group', String(roomId));
            try { incrementUnread(key, { star: true, previewText: String(msg?.ciphertext ?? ''), title: 'New group message' }); } catch {}
          }
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setGroups((prev) => {
            const updated = prev.map((g) => (
              String(g?.room_id ?? g?.id) === String(roomId)
                ? { ...g, lastActivityAt: Date.now() }
                : g
            ));
            return [...updated].sort((a: any, b: any) => Number(b?.lastActivityAt ?? 0) - Number(a?.lastActivityAt ?? 0));
          });
        });
      } catch (_e) {
        // optional dependency or failure — ignore
      }
    };

    setupSocket();
 
  }, [user]);

  // Join DM rooms whenever conversations list updates
  useEffect(() => {
    const currentUserType = (user as any)?.artist_id ? 'artist' : 'club';
    const currentUserId = (user as any)?.artist_id ?? (user as any)?.id ?? '';
    if (socketRef.current && socketRef.current.connected && conversations.length && currentUserId) {
      conversations.forEach((c) => {
        socketRef.current.emit('join', {
          sender_type: currentUserType,
          sender_id: currentUserId,
          receiver_type: c.other_party_type,
          receiver_id: c.other_party_id,
        });
      });
    }
  }, [conversations, user]);

  // Join group rooms whenever groups list updates
  useEffect(() => {
    if (socketRef.current && socketRef.current.connected && groups.length) {
      groups.forEach((g) => {
        const roomId = g?.room_id ?? g?.id;
        if (roomId) socketRef.current.emit('group:join', { room_id: roomId });
      });
    }
  }, [groups]);

  // Cleanup socket on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
         
        <Text style={styles.headerTitle}>Messages</Text>
        {/* <TouchableOpacity style={styles.createGroupButton} onPress={() => setGroupModalOpen(true)}>
          <Text style={styles.createGroupButtonText}>Create Group Chat</Text>
        </TouchableOpacity> */}
      </View>

      {/* Store Restore Error Banner */}
      {restoreError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>Message state couldn’t be restored: {restoreError}</Text>
          <TouchableOpacity style={styles.errorBannerRetry} onPress={() => { try { hydrateStore(); } catch {} }}>
            <Text style={styles.errorBannerRetryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Message List */}
      {!storeInitialized ? (
        <View style={{ padding: 20 }}>
          <ActivityIndicator size="small" />
          <Text style={[styles.textSecondary, { marginTop: 8 }]}>Restoring message state…</Text>
        </View>
      ) : loading ? (
        <View style={{ padding: 20 }}>
          <ActivityIndicator size="small" />
        </View>
      ) : error ? (
        <Text style={[styles.textSecondary, { marginLeft: 16 }]}>{error}</Text>
      ) : (
        <FlatList
          data={[ { __header: 'Direct Messages' }, ...conversations.map((c) => ({ __type: 'dm', item: c }))]}
          keyExtractor={(item, index) => {
            if ((item as any)?.__header) return `header-${(item as any).__header}-${index}`;
            if ((item as any)?.__type === 'group') {
              const g = (item as any).item || {};
              const roomId = String(g.room_id ?? g.id ?? index);
              return `group-${roomId}`;
            }
            const c = (item as any).item || {};
            return `dm-${c.other_party_type}:${c.other_party_id}`;
          }}
          renderItem={({ item }) => {
            if ((item as any)?.__header) {
              return <Text style={styles.sectionHeader}>{item.__header}</Text>;
            }
            if ((item as any)?.__type === 'group') {
              const g = (item as any).item;
              const roomId = String(g.room_id ?? g.id);
              const href = `/chats?room_id=${roomId}`;
              return (
                <GroupListItem
                  name={g.name}
                  href={href as any}
                  showStar={!!starred[makePartyKey('group', roomId)]}
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    const key = makePartyKey('group', roomId);
                    markRead(key);
                    setStar(key, false);
                    setHighlight(key, false);
                  }}
                  onManage={() => setManagingGroupId(Number(roomId))}
                />
              );
            }
            const c = (item as any).item;
            return (
              <MessageListItem
                name={c.name}
                imageUrl={c.image}
                href={c.href}
                online={!!c.online}
                highlight={!!highlighted[makePartyKey(c.other_party_type, c.other_party_id)]}
                showStar={!!starred[makePartyKey(c.other_party_type, c.other_party_id)]}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  const key = makePartyKey(c.other_party_type, c.other_party_id);
                  markRead(key);
                  setStar(key, false);
                  setHighlight(key, false);
                }}
              />
            );
          }}
          ListEmptyComponent={<Text style={[styles.textSecondary, { marginLeft: 16 }]}>No conversations yet.</Text>}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#fff' }} />}
          initialNumToRender={12}
          maxToRenderPerBatch={8}
          windowSize={7}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews={true}
          keyboardShouldPersistTaps="always"
          contentContainerStyle={{ paddingBottom: 16 }}
        />
      )}

      {/* Create Group Modal */}
      {groupModalOpen && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Create Group Chat</Text>
            <TextInput
              placeholder="Group name"
              value={groupName}
              onChangeText={setGroupName}
              placeholderTextColor="#9CA3AF"
              style={styles.input}
            />
            <Text style={styles.modalSubtitle}>Select members</Text>
            <FlatList
              data={conversations}
              keyExtractor={(c) => `${c.other_party_type}:${c.other_party_id}`}
              style={{ maxHeight: 220 }}
              renderItem={({ item }) => {
                const key = `${item.other_party_type}:${item.other_party_id}`;
                const selected = selectedMembers.has(key);
                return (
                  <TouchableOpacity
                    style={[styles.memberRow, selected ? styles.memberRowSelected : null]}
                    onPress={() => {
                      setSelectedMembers((prev) => {
                        const next = new Set(prev);
                        if (next.has(key)) next.delete(key); else next.add(key);
                        return next;
                      });
                    }}
                  >
                    <View style={{ position: 'relative' }}>
                      <Image style={[styles.avatar, { height: 36, width: 36 }]} source={{ uri: item.image }} />
                      {item.online ? <View style={[styles.onlineDot, { height: 10, width: 10, borderRadius: 5 }]} /> : null}
                    </View>
                    <Text style={[styles.textPrimary, { flex: 1 }]}>{item.name}</Text>
                    <View style={[styles.checkbox, selected ? styles.checkboxChecked : null]} />
                  </TouchableOpacity>
                );
              }}
            />
            {groupCreateError ? <Text style={[styles.textSecondary, { color: '#ef4444', marginTop: 8 }]}>{groupCreateError}</Text> : null}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
              <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => { setGroupModalOpen(false); setSelectedMembers(new Set()); setGroupName(''); setGroupCreateError(null); }}>
                <Text style={styles.btnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={async () => {
                  try {
                    setGroupCreating(true);
                    setGroupCreateError(null);
                    const base = apiEndpoints.featuredVenues.replace('venues/featured', '');
                    const token = await AsyncStorage.getItem('userToken');
                    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                    if (token) headers['Authorization'] = `Bearer ${token}`;
                    const members = Array.from(selectedMembers).map((k) => {
                      const [member_type, member_id] = k.split(':');
                      return { member_type, member_id };
                    });
                    const res = await fetch(base + 'rooms', {
                      method: 'POST',
                      headers,
                      body: JSON.stringify({ name: groupName.trim() || 'New Group', members }),
                    });
                    if (!res.ok) {
                      const txt = await res.text().catch(() => '');
                      throw new Error(txt || 'Failed to create group');
                    }
                    const created = await res.json();
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setGroups((prev) => [{ ...created }, ...prev]);
                    setGroupModalOpen(false);
                    setSelectedMembers(new Set());
                    setGroupName('');
                  } catch (e: any) {
                    setGroupCreateError(e?.message || 'Failed to create group');
                  } finally {
                    setGroupCreating(false);
                  }
                }}
              >
                {groupCreating ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnPrimaryText}>Create</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Manage group overlay: add members */}
      {managingGroupId ? (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Manage Group</Text>
            <Text style={styles.modalSubtitle}>Add members</Text>
            <FlatList
              data={conversations}
              keyExtractor={(c) => `${c.other_party_type}:${c.other_party_id}`}
              style={{ maxHeight: 220 }}
              renderItem={({ item }) => {
                const key = `${item.other_party_type}:${item.other_party_id}`;
                const selected = selectedMembers.has(key);
                return (
                  <TouchableOpacity
                    style={[styles.memberRow, selected ? styles.memberRowSelected : null]}
                    onPress={() => {
                      setSelectedMembers((prev) => {
                        const next = new Set(prev);
                        if (next.has(key)) next.delete(key); else next.add(key);
                        return next;
                      });
                    }}
                  >
                    <View style={{ position: 'relative' }}>
                      <Image style={[styles.avatar, { height: 36, width: 36 }]} source={{ uri: item.image }} />
                      {item.online ? <View style={[styles.onlineDot, { height: 10, width: 10, borderRadius: 5 }]} /> : null}
                    </View>
                    <Text style={[styles.textPrimary, { flex: 1 }]}>{item.name}</Text>
                    <View style={[styles.checkbox, selected ? styles.checkboxChecked : null]} />
                  </TouchableOpacity>
                );
              }}
            />
            {memberAddError ? <Text style={[styles.textSecondary, { color: '#ef4444', marginTop: 8 }]}>{memberAddError}</Text> : null}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
              <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => { setManagingGroupId(null); setSelectedMembers(new Set()); setMemberAddError(null); }}>
                <Text style={styles.btnSecondaryText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={async () => {
                  try {
                    setMemberAddLoading(true);
                    setMemberAddError(null);
                    const base = apiEndpoints.featuredVenues.replace('venues/featured', '');
                    const token = await AsyncStorage.getItem('userToken');
                    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                    if (token) headers['Authorization'] = `Bearer ${token}`;
                    for (const k of Array.from(selectedMembers)) {
                      const [member_type, member_id] = k.split(':');
                      const res = await fetch(base + `rooms/${managingGroupId}/members`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ member_type, member_id }),
                      });
                      if (!res.ok) {
                        const txt = await res.text().catch(() => '');
                        throw new Error(txt || 'Failed to add member');
                      }
                    }
                    setSelectedMembers(new Set());
                  } catch (e: any) {
                    setMemberAddError(e?.message || 'Failed to add members');
                  } finally {
                    setMemberAddLoading(false);
                  }
                }}
              >
                {memberAddLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnPrimaryText}>Add</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

// --- Stylesheet (Updated for Light Theme) ---
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f3ede6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#fff', // Light separator line
  },
  iconContainer: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#000000',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 48, // Balance the left icon
  },
  createGroupButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
  },
  createGroupButtonText: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    minHeight: 72,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#fff', // Light separator line
    backgroundColor: '#fffbf7',
    elevation: 1,
    shadowColor: '#666',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2.84,
    marginTop:1,
     
  },
  avatar: {
    height: 56,
    width: 56,
    borderRadius: 28,
  },
  onlineDot: {
    position: 'absolute',
    height: 12,
    width: 12,
    borderRadius: 6,
    backgroundColor: '#16a34a',
    bottom: 0,
    right: 0,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  textPrimary: {
    color: '#1F2937', // Dark gray
    fontSize: 16,
    fontWeight: '500',
  },
  textSecondary: {
    color: '#6B7280', // Medium gray
    fontSize: 14,
  },
  starIndicator: {
    height: 40,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageButton: {
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    color: '#111827',
    fontWeight: '700',
  },
  modalOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginTop: 8,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#111827',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  memberRowSelected: {
    backgroundColor: '#F3F4F6',
  },
  checkbox: {
    height: 20,
    width: 20,
    borderWidth: 1,
    borderColor: '#9CA3AF',
    borderRadius: 4,
  },
  checkboxChecked: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  btn: {
    minWidth: 96,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: '#3B82F6',
  },
  btnSecondary: {
    backgroundColor: '#E5E7EB',
  },
  btnPrimaryText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  btnSecondaryText: {
    color: '#111827',
    fontWeight: '600',
  },
  errorBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#ef4444',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  errorBannerText: {
    color: '#7f1d1d',
    flex: 1,
    fontSize: 14,
  },
  errorBannerRetry: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#ef4444',
  },
  errorBannerRetryText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
