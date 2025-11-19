import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    SectionList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    Dimensions
} from 'react-native';
import { ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import apiEndpoints from './api/baseUrl';
import useUserData from './_utils/Localstorage';
import io from 'socket.io-client';
import { useNotificationStore, makePartyKey } from '../utils/notificationStore';
import { encryptMessage, decryptMessage } from '../utils/e2e';
// ... imports consolidated above

const SOCKET_SERVER_URL = apiEndpoints.baseURL.replace(/\/api\/?$/, '').replace(/\/$/, '');

const ChatScreen = () => {
    const params = useLocalSearchParams() as any;
    const sender_type = params.sender_type ?? params.get?.('sender_type') ?? '';
    const sender_id = params.sender_id ?? params.get?.('sender_id') ?? '';
    const receiver_type = params.receiver_type ?? params.get?.('receiver_type') ?? '';
    const receiver_id = params.receiver_id ?? params.get?.('receiver_id') ?? '';
    const receiver_name = params.receiver_name ?? params.get?.('receiver_name') ?? '';
    const receiver_avatar = params.receiver_avatar ?? params.get?.('receiver_avatar') ?? '';
    const receiver_username = params.receiver_username ?? params.get?.('receiver_username') ?? '';
    const receiver_category = params.receiver_category ?? params.get?.('receiver_category') ?? '';
    const receiver_meta = params.receiver_meta ?? params.get?.('receiver_meta') ?? '';
    const partyKey = useMemo(() => makePartyKey(receiver_type || 'user', receiver_id || ''), [receiver_type, receiver_id]);
    const storeInitialized = useNotificationStore((s) => s.initialized);
    const [messages, setMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentUserType, setCurrentUserType] = useState<string | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | number | null>(null);
    const [inputText, setInputText] = useState('');
    const [sending, setSending] = useState(false);
    const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const socketRef = useRef<any>(null);
    const [socketReady, setSocketReady] = useState(false);
    const [seenIds, setSeenIds] = useState<Set<string | number>>(new Set());
    const [receiverDisplayName, setReceiverDisplayName] = useState<string>(receiver_name || '');
    // Auto-scroll management
    const sectionListRef = useRef<SectionList<any> | null>(null);
    const autoScrollEnabledRef = useRef<boolean>(true);
    const scrollScheduleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastContentHeightRef = useRef<number>(0);
    const listHeightRef = useRef<number>(0);
    const currentOffsetRef = useRef<number>(0);
    const prevLenRef = useRef<number>(0);
    const sendTimestampsRef = useRef<number[]>([]);
    const queueKey = useMemo(() => `chat-queue:${partyKey}`, [partyKey]);
    const messagesKey = useMemo(() => `messages:${partyKey}`, [partyKey]);

    // Clear unread/highlight for this conversation on entry
    useEffect(() => {
        try {
            if (!storeInitialized) return;
            const { markRead } = useNotificationStore.getState();
            markRead(partyKey);
        } catch {}
    }, [partyKey, storeInitialized]);

    // Pagination state
    const perPageRef = useRef<number>(20);
    const pageRef = useRef<number>(1);
    const hasMoreRef = useRef<boolean>(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const getLastLocation = React.useCallback(() => {
        // Compute sections in the same way as the SectionList
        const groups: Record<string, any[]> = {};
        const pad = (n: number) => String(n).padStart(2, '0');
        (messages || []).forEach((m) => {
            const d = m.sent_at ? new Date(m.sent_at) : new Date();
            const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(m);
        });
        const keys = Object.keys(groups).sort((a, b) => (a < b ? -1 : 1));
        const lastSectionIndex = keys.length - 1;
        const lastItemIndex = lastSectionIndex >= 0 ? (groups[keys[lastSectionIndex]]?.length ?? 0) - 1 : -1;
        return { lastSectionIndex, lastItemIndex };
    }, [messages]);

    const scrollToBottom = React.useCallback((animated: boolean = true) => {
        const list = sectionListRef.current;
        if (!list) return;
        const { lastSectionIndex, lastItemIndex } = getLastLocation();
        if (lastSectionIndex < 0 || lastItemIndex < 0) {
            // Fallback to offset-based scrolling when indices cannot be computed
            try {
                (list as any).scrollToOffset?.({ offset: Math.max(0, lastContentHeightRef.current), animated });
            } catch {}
            return;
        }
        try {
            // Preferred: location-based scroll (reliable on native)
            list.scrollToLocation({
                sectionIndex: lastSectionIndex,
                itemIndex: lastItemIndex,
                viewPosition: 1,
                animated,
            });
            // Backup: end-based scroll (works on RN Web)
            (list as any).scrollToEnd?.({ animated });
        } catch (err) {
            // If layout not ready yet, schedule a retry
            if (scrollScheduleRef.current) clearTimeout(scrollScheduleRef.current);
            scrollScheduleRef.current = setTimeout(() => {
                try {
                    list.scrollToLocation({
                        sectionIndex: lastSectionIndex,
                        itemIndex: lastItemIndex,
                        viewPosition: 1,
                        animated,
                    });
                    (list as any).scrollToEnd?.({ animated });
                    // Also attempt offset-based scroll as a backup (RN Web reliability)
                    (list as any).scrollToOffset?.({ offset: Math.max(0, lastContentHeightRef.current), animated });
                } catch {}
            }, 50);
        }
    }, [getLastLocation]);

    const scheduleScrollToBottom = React.useCallback((delayMs: number = 16) => {
        if (!autoScrollEnabledRef.current) return;
        if (scrollScheduleRef.current) clearTimeout(scrollScheduleRef.current);
        scrollScheduleRef.current = setTimeout(() => {
            // Use rAF chaining to ensure layout has settled across platforms
            if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        scrollToBottom(true);
                    });
                });
            } else {
                scrollToBottom(true);
            }
        }, delayMs);
    }, [scrollToBottom]);

    const appendMessage = React.useCallback((m: any) => {
        const id = m?.chat_id ?? `${m?.room_id ?? 'group'}:${m?.sent_at ?? Math.random()}`;
        setMessages(prev => {
            if (m?.chat_id && prev.some(x => String(x.chat_id) === String(m.chat_id))) {
                return prev;
            }
            const next = [...prev, m];
            try { AsyncStorage.setItem(messagesKey, JSON.stringify(next.slice(-200))); } catch {}
            return next;
        });
        setSeenIds(prev => new Set([...prev, id]));
    }, []);

    // Helper: ensure an incoming DM belongs to the current conversation
    const isSameDMConversation = React.useCallback((m: any) => {
        if (!m) return false;
        const a = {
            st: String(m.sender_type),
            sid: String(m.sender_id),
            rt: String(m.receiver_type),
            rid: String(m.receiver_id),
        };
        const cur = {
            me_t: String(currentUserType),
            me_id: String(currentUserId),
            you_t: String(receiver_type),
            you_id: String(receiver_id),
        };
        const dir1 = a.st === cur.me_t && a.sid === cur.me_id && a.rt === cur.you_t && a.rid === cur.you_id;
        const dir2 = a.st === cur.you_t && a.sid === cur.you_id && a.rt === cur.me_t && a.rid === cur.me_id;
        return dir1 || dir2;
    }, [currentUserType, currentUserId, receiver_type, receiver_id]);

    // Get user data from local storage
    const { user } = useUserData();

    // Determine current user type and ID based on user data
    useEffect(() => {
        if (user) {
            const isArtist = Boolean((user as any)?.artist_id);
            const userType = isArtist ? 'artist' : 'club';
            const userId = (user as any)?.artist_id ?? (user as any)?.club_id ?? (user as any)?.id ?? null;
            setCurrentUserType(userType);
            setCurrentUserId(userId);
            if (!userId) {
                console.warn('[chat] currentUserId not found. Expected artist_id or club_id on user object.');
            }
        } else {
            setCurrentUserType(null);
            setCurrentUserId(null);
        }
    }, [user]);

    // Initial auto-scroll on mount (after first render)
    useEffect(() => {
        scheduleScrollToBottom(32);
    }, [scheduleScrollToBottom]);

    // --- Auto-scroll to bottom on new messages, initial load, and resize ---
    const prevMessagesLenRef = useRef<number>(0);
    const todayPreloadDoneRef = useRef<boolean>(false);
    const pagesPreloadedRef = useRef<number>(0);
    useEffect(() => {
        // Only scroll if new messages are appended and user is near the bottom
        const prevLen = prevMessagesLenRef.current;
        const currLen = messages.length;
        prevMessagesLenRef.current = currLen;
        if (currLen > prevLen && autoScrollEnabledRef.current) {
            // Wait for layout to settle
            setTimeout(() => {
                try {
                    const h = lastContentHeightRef.current || 0;
                    const listH = listHeightRef.current || 0;
                    const targetOffset = Math.max(0, h - listH);
                    (sectionListRef.current as any)?.scrollToOffset?.({ offset: targetOffset, animated: true });
                } catch {
                    (sectionListRef.current as any)?.scrollToEnd?.({ animated: true });
                }
            }, 32);
        }
    }, [messages]);

    const dateKeyFor = React.useCallback((d: Date) => {
        const p = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    }, []);

    const getEarliestDateKey = React.useCallback(() => {
        let earliest: string | null = null;
        (messages || []).forEach((m) => {
            const dt = m.sent_at ? new Date(m.sent_at) : new Date();
            const k = dateKeyFor(dt);
            if (earliest == null || k < earliest) earliest = k;
        });
        return earliest;
    }, [messages, dateKeyFor]);

    useEffect(() => {
        if (pageRef.current !== 1) return;
        if (todayPreloadDoneRef.current) return;
        const now = new Date();
        const todayKey = dateKeyFor(now);
        const earliest = getEarliestDateKey();
        if (!earliest) return;
        if (earliest === todayKey && hasMoreRef.current && !loading && !loadingMore) {
            const beforeH = lastContentHeightRef.current;
            setLoadingMore(true);
            loadMessagesPage(pageRef.current + 1, { append: true })
                .then(() => {
                    pageRef.current += 1;
                    pagesPreloadedRef.current += 1;
                    const afterH = lastContentHeightRef.current;
                    const delta = Math.max(0, afterH - beforeH);
                    const target = (currentOffsetRef.current || 0) + delta;
                    try {
                        (sectionListRef.current as any)?.scrollToOffset?.({ offset: target, animated: false });
                    } catch {}
                })
                .finally(() => {
                    setLoadingMore(false);
                    const e2 = getEarliestDateKey();
                    const done = e2 !== todayKey || pagesPreloadedRef.current >= 5 || !hasMoreRef.current;
                    if (done) todayPreloadDoneRef.current = true;
                });
        }
    }, [messages, loading, loadingMore, getEarliestDateKey, dateKeyFor]);

    useEffect(() => {
        // Initial scroll on mount
        if (messages.length > 0 && autoScrollEnabledRef.current) {
            setTimeout(() => {
                try {
                    const h = lastContentHeightRef.current || 0;
                    const listH = listHeightRef.current || 0;
                    const targetOffset = Math.max(0, h - listH);
                    (sectionListRef.current as any)?.scrollToOffset?.({ offset: targetOffset, animated: true });
                } catch {
                    (sectionListRef.current as any)?.scrollToEnd?.({ animated: true });
                }
            }, 32);
        }
    }, []);

    useEffect(() => {
        const s = socketRef.current;
        if (!s || !socketReady || !currentUserType || currentUserId == null) return;
        try {
            (messages || []).forEach((m) => {
                const incoming = !(String(m.sender_type) === String(currentUserType) && String(m.sender_id) === String(currentUserId));
                const meIsReceiver = String(m.receiver_type) === String(currentUserType) && String(m.receiver_id) === String(currentUserId);
                if (incoming && meIsReceiver && !m.read_status && m.chat_id) {
                    s.emit('read', {
                        sender_type: m.sender_type,
                        sender_id: m.sender_id,
                        receiver_type: m.receiver_type,
                        receiver_id: m.receiver_id,
                        chat_id: m.chat_id,
                    });
                }
            });
        } catch {}
    }, [messages, socketReady, currentUserType, currentUserId]);

    useEffect(() => {
        // Scroll on window resize
        const onResize = () => {
            if (autoScrollEnabledRef.current) {
                setTimeout(() => {
                    try {
                        const h = lastContentHeightRef.current || 0;
                        const listH = listHeightRef.current || 0;
                        const targetOffset = Math.max(0, h - listH);
                        (sectionListRef.current as any)?.scrollToOffset?.({ offset: targetOffset, animated: true });
                    } catch {
                        (sectionListRef.current as any)?.scrollToEnd?.({ animated: true });
                    }
                }, 32);
            }
        };
        if (Platform.OS === 'web') {
            window.addEventListener('resize', onResize);
        }
        return () => {
            if (Platform.OS === 'web') {
                window.removeEventListener('resize', onResize);
            }
        };
    }, []);

    // Fetch receiver name for DM conversations so we display names instead of IDs
    useEffect(() => {
        // If name provided via navigation params, prefer it and skip network fetch
        if (receiver_name) {
            setReceiverDisplayName(String(receiver_name));
            return;
        }
        const rt = String(receiver_type || '').toLowerCase();
        const isGroup = rt === 'group' || rt === 'room' || rt.includes('chat');
        const loadName = async () => {
            try {
                if (isGroup || !receiver_type || !receiver_id) { setReceiverDisplayName(''); return; }
                const base = apiEndpoints.baseURL;
                const token = await AsyncStorage.getItem('userToken');
                const headers: any = token ? { Authorization: `Bearer ${token}` } : undefined;
                let url = '';
                if (rt === 'artist') url = `${base}artists/${encodeURIComponent(String(receiver_id))}`;
                else if (rt === 'club' || rt === 'venue') url = `${base}venues/${encodeURIComponent(String(receiver_id))}`;
                else if (rt === 'band') url = `${base}bands/${encodeURIComponent(String(receiver_id))}/details`;
                if (!url) { setReceiverDisplayName(''); return; }
                const res = await fetch(url, { headers });
                if (!res.ok) { setReceiverDisplayName(''); return; }
                const j = await res.json();
                const name = j?.name || j?.display_name || j?.venue_name || '';
                setReceiverDisplayName(name || '');
            } catch {
                setReceiverDisplayName('');
            }
        };
        loadName();
    }, [receiver_type, receiver_id, receiver_name]);

    // Build URL for a given page
    const buildMessagesUrl = (page: number, perPage: number) => {
        const rt = String(receiver_type || '').toLowerCase();
        const isGroup = rt === 'group' || rt === 'room' || rt.includes('chat');
        let apiUrl: string;
        if (isGroup && receiver_id) {
            // Group room messages
            apiUrl = `${apiEndpoints.chat}/rooms/${encodeURIComponent(String(receiver_id))}/messages?page=${page}&per_page=${perPage}&order=desc`;
        } else {
            // Direct conversation messages
            apiUrl = `${apiEndpoints.chat}`;
            apiUrl += `?sender_type=${encodeURIComponent(String(currentUserType))}`;
            apiUrl += `&sender_id=${encodeURIComponent(String(currentUserId))}`;
            apiUrl += `&receiver_type=${encodeURIComponent(String(receiver_type))}`;
            apiUrl += `&receiver_id=${encodeURIComponent(String(receiver_id))}`;
            apiUrl += `&page=${page}&per_page=${perPage}&order=desc`;
        }
        return { apiUrl, isGroup };
    };

    // Merge and sort messages, deduping by chat_id
    const mergeMessages = (prev: any[], next: any[]) => {
        const byId = new Map<string, any>();
        const put = (m: any) => {
            const k = String(m.chat_id ?? `${m.sender_id}:${m.sent_at}`);
            if (!byId.has(k)) byId.set(k, m);
        };
        prev.forEach(put);
        next.forEach(put);
        const all = Array.from(byId.values());
        all.sort((a: any, b: any) => {
            const at = new Date(a.sent_at ?? a.created_at ?? 0).getTime();
            const bt = new Date(b.sent_at ?? b.created_at ?? 0).getTime();
            return at - bt; // oldest first for stable day grouping
        });
        return all;
    };

    const normalizeMessage = React.useCallback((raw: any) => {
        const m = { ...raw };
        try { if (m.sent_at) m.sent_at = new Date(m.sent_at).toISOString(); } catch {}
        try { if (m.read_at) m.read_at = new Date(m.read_at).toISOString(); } catch {}
        if (!m.optimistic) {
            const isOutgoing = (
                String(m.sender_type) === String(currentUserType) &&
                String(m.sender_id) === String(currentUserId)
            );
            const readFlag = Number(m.read_status || 0) === 1 || !!m.read_at;
            const deliveredFlag = Number(m.delivered_status || 0) === 1;
            if (isOutgoing) {
                if (readFlag) {
                    m.status = 'read';
                } else if (deliveredFlag) {
                    m.status = 'delivered';
                } else {
                    m.status = m.status || 'sending';
                }
            }
            m.optimistic = false;
        }
        return m;
    }, [currentUserType, currentUserId]);

    // Load a specific page (append when loading older)
    const loadMessagesPage = async (page: number, { append }: { append: boolean }) => {
        if (!currentUserType || !currentUserId) return;

        // Only show full-screen loader when not appending older
        if (!append) setLoading(true);
        setError(null);

        try {
            // Get auth token
            const authToken = await AsyncStorage.getItem('userToken');

            if (!authToken) {
                setError('Authentication token not found');
                if (!append) setLoading(false);
                return;
            }
            // If receiver is missing for DM, skip fetch to avoid 400
            const rt = String(receiver_type || '').toLowerCase();
            const isGroup = rt === 'group' || rt === 'room' || rt.includes('chat');
            if (!isGroup && (!receiver_type || !receiver_id)) {
                setError('Select a conversation to view messages');
                if (!append) setLoading(false);
                return;
            }
            const { apiUrl } = buildMessagesUrl(page, perPageRef.current);

            console.log('[chat] Fetching messages from:', apiUrl);
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const msgs = Array.isArray(data.messages) ? data.messages : [];

            const decrypted = await Promise.all(
                msgs.map(async (m: any) => {
                    const rtMsg = isGroup ? 'group' : m.receiver_type;
                    const recvId = isGroup ? (m.room_id ?? receiver_id) : m.receiver_id;
                    const cipher = isGroup ? m.ciphertext : m.message;
                    const text = await decryptMessage(
                        cipher,
                        m.sender_type,
                        m.sender_id,
                        rtMsg,
                        recvId,
                    );
                    console.log('[chat] decrypt fetch ok', { chat_id: m.chat_id, isGroup });
                    return { ...m, message: text };
                })
            );
            // Strict filter: only messages for the active conversation
            const filtered = decrypted.filter((m: any) => {
                if (isGroup) {
                    return String(m.room_id) === String(receiver_id);
                }
                const st = String(m.sender_type), sid = String(m.sender_id);
                const rt2 = String(m.receiver_type), rid2 = String(m.receiver_id);
                const me_t = String(currentUserType), me_id = String(currentUserId);
                const you_t = String(receiver_type), you_id = String(receiver_id);
                const dir1 = st === me_t && sid === String(me_id) && rt2 === you_t && rid2 === String(you_id);
                const dir2 = st === you_t && sid === String(you_id) && rt2 === me_t && rid2 === String(me_id);
                return dir1 || dir2;
            });
            const normalized = filtered.map(normalizeMessage);
            setMessages(prev => append ? mergeMessages(prev, normalized) : mergeMessages([], normalized));
            // Update pagination state: if received full batch, assume there may be more
            hasMoreRef.current = (filtered.length >= perPageRef.current);
            if (!append) pageRef.current = 1; // reset on initial load
        } catch (err) {
            console.error('[chat] Error fetching messages:', err);
            // Friendly message for group chats when backend migration hasn't been applied yet
            if (String(receiver_type || '').toLowerCase() === 'group') {
                setError('Group chat history unavailable. Please try again later.');
            } else {
                setError('Failed to load messages');
            }
        } finally {
            if (!append) setLoading(false);
        }
    };

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const raw = await AsyncStorage.getItem(messagesKey);
                if (!raw) return;
                const arr = JSON.parse(raw);
                if (Array.isArray(arr) && !cancelled) setMessages(arr);
            } catch {}
        })();
        return () => { cancelled = true; };
    }, [messagesKey]);

    const queueMessage = async (m: any) => {
        try {
            const raw = await AsyncStorage.getItem(queueKey);
            const arr = raw ? JSON.parse(raw) : [];
            arr.push(m);
            await AsyncStorage.setItem(queueKey, JSON.stringify(arr));
        } catch {}
    };

    const flushQueue = async () => {
        try {
            const raw = await AsyncStorage.getItem(queueKey);
            const arr = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(arr) || arr.length === 0) return;
            const s = socketRef.current;
            if (!s || !socketReady) return;
            const remaining: any[] = [];
            for (const q of arr) {
                try {
                    const cipher = await encryptMessage(q.message, q.sender_type, q.sender_id, q.receiver_type, q.receiver_id);
                    await new Promise<void>((resolve) => {
                        s.emit('message', { sender_type: q.sender_type, sender_id: q.sender_id, receiver_type: q.receiver_type, receiver_id: q.receiver_id, message: cipher }, (_ack: any) => { resolve(); });
                    });
                } catch {
                    remaining.push(q);
                }
            }
            await AsyncStorage.setItem(queueKey, JSON.stringify(remaining));
        } catch {}
    };

    // Send message function
    const sendMessage = async () => {
        if (!inputText.trim() || !currentUserType || !currentUserId) return;
        
        setSending(true);

        try {
            // Get auth token
            const authToken = await AsyncStorage.getItem('userToken');

            if (!authToken) {
                setError('Authentication token not found');
                setSending(false);
                return;
            }

            const response = await fetch(apiEndpoints.chat, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sender_type: currentUserType,
                    sender_id: currentUserId,
                    receiver_type: receiver_type,
                    receiver_id: receiver_id,
                    message: inputText.trim(),
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const newMessage = await response.json();
            
            // Add the new message only if it belongs to this conversation
            setMessages(prev => (
                (newMessage && (
                    (String(newMessage.sender_type) === String(currentUserType) && String(newMessage.sender_id) === String(currentUserId) && String(newMessage.receiver_type) === String(receiver_type) && String(newMessage.receiver_id) === String(receiver_id)) ||
                    (String(newMessage.sender_type) === String(receiver_type) && String(newMessage.sender_id) === String(receiver_id) && String(newMessage.receiver_type) === String(currentUserType) && String(newMessage.receiver_id) === String(currentUserId))
                ))
                    ? [...prev, normalizeMessage(newMessage)]
                    : prev
            ));
            
            // Clear input
            setInputText('');
        } catch (err) {
            console.error('Error sending message:', err);
            setError('Failed to send message');
        } finally {
            setSending(false);
        }
    };

    // Fetch messages when component mounts or when user data changes
    useEffect(() => {
        // Reset pagination when conversation changes
        pageRef.current = 1;
        hasMoreRef.current = true;
        loadMessagesPage(1, { append: false });
    }, [currentUserType, currentUserId, receiver_type, receiver_id]);

    // Socket connection setup
    useEffect(() => {
        let cancelled = false;
        // Ensure any previous socket is torn down before creating a new one
        if (socketRef.current) {
            try { socketRef.current.disconnect(); } catch {}
            socketRef.current = null;
        }
        (async () => {
            const token = await AsyncStorage.getItem('userToken');
            if (cancelled) return;
            const s = io(SOCKET_SERVER_URL, {
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionAttempts: 10,
                reconnectionDelay: 1000,
                timeout: 20000,
                auth: { token: token || '' },
            });
            socketRef.current = s;

            // Join DM or Group room depending on receiver_type
            const rt = String(receiver_type || '').toLowerCase();
            const isGroup = rt === 'group' || rt === 'room' || rt.includes('chat');
            if (isGroup && receiver_id) {
                s.emit('group:join', { room_id: Number(receiver_id) });
                s.on('group:joined', (_payload: any) => {
                    setError(null);
                });
            } else {
                s.emit('join', {
                    sender_type: currentUserType,
                    sender_id: currentUserId,
                    receiver_type,
                    receiver_id,
                });
                s.on('joined', (payload: any) => {
                    console.log('[socket] joined DM room', payload);
                    setError(null);
                });
            }

            // Listen for incoming messages (DM)
            s.on('message', async (msg: any) => {
                if (!isSameDMConversation(msg)) return; // guard against leakage
                const isOwn = (
                    String(msg.sender_type) === String(currentUserType) &&
                    String(msg.sender_id) === String(currentUserId)
                );
                try {
                    const decrypted = await decryptMessage(
                        msg.message,
                        msg.sender_type,
                        msg.sender_id,
                        msg.receiver_type,
                        msg.receiver_id,
                    );
                    console.log('[socket] message recv', { chat_id: msg.chat_id });
                    if (isOwn) {
                        // Finalize the last optimistic outgoing message
                        setMessages((prev) => {
                            const updated = [...prev];
                            for (let i = updated.length - 1; i >= 0; i--) {
                                const m = updated[i] as any;
                                const isOutgoing = (
                                    String(m.sender_type) === String(currentUserType) &&
                                    String(m.sender_id) === String(currentUserId)
                                );
                                if (isOutgoing && (m.status === 'sending' || m.optimistic)) {
                                    updated[i] = {
                                        ...m,
                                        chat_id: msg.chat_id,
                                        sent_at: msg.sent_at,
                                        message: decrypted,
                                        status: 'delivered',
                                        optimistic: false,
                                    };
                                    break;
                                }
                            }
                            return updated;
                        });
                        try { s.emit('client:received', { chat_id: msg.chat_id, kind: 'dm' }); } catch {}
                    } else {
                        appendMessage(normalizeMessage({ ...msg, message: decrypted }));
                        try { s.emit('client:received', { chat_id: msg.chat_id, kind: 'dm' }); } catch {}
                        // Immediately acknowledge read when displaying incoming DM in active conversation
                        try {
                            s.emit('read', {
                                sender_type: msg.sender_type,
                                sender_id: msg.sender_id,
                                receiver_type,
                                receiver_id,
                                chat_id: msg.chat_id,
                            });
                        } catch {}
                        // Also clear unread/highlight in global store for this party
                        try {
                            const s = useNotificationStore.getState();
                            if (s.initialized) s.markRead(partyKey);
                        } catch {}
                    }
                } catch {
                    console.warn('[socket] decrypt failed for message', msg?.chat_id);
                    if (isOwn) {
                        setMessages((prev) => {
                            const updated = [...prev];
                            for (let i = updated.length - 1; i >= 0; i--) {
                                const m = updated[i] as any;
                                const isOutgoing = (
                                    String(m.sender_type) === String(currentUserType) &&
                                    String(m.sender_id) === String(currentUserId)
                                );
                                if (isOutgoing && (m.status === 'sending' || m.optimistic)) {
                                    updated[i] = {
                                        ...m,
                                        chat_id: msg.chat_id,
                                        sent_at: msg.sent_at,
                                        status: 'delivered',
                                        optimistic: false,
                                    };
                                    break;
                                }
                            }
                            return updated;
                        });
                        try { s.emit('client:received', { chat_id: msg.chat_id, kind: 'dm' }); } catch {}
                    } else {
                        appendMessage(normalizeMessage(msg));
                        try { s.emit('client:received', { chat_id: msg.chat_id, kind: 'dm' }); } catch {}
                        try {
                            s.emit('read', {
                                sender_type: msg.sender_type,
                                sender_id: msg.sender_id,
                                receiver_type,
                                receiver_id,
                                chat_id: msg.chat_id,
                            });
                        } catch {}
                        try {
                            const s = useNotificationStore.getState();
                            if (s.initialized) s.markRead(partyKey);
                        } catch {}
                    }
                }
            });

            // Read receipts: mark outgoing message as read when other party broadcasts
            s.on('read', (payload: any) => {
                const { chat_id, reader_type, reader_id, read_at } = payload || {};
                setMessages((prev) => prev.map((m: any) => (
                    String(m.chat_id) === String(chat_id) &&
                    String(m.sender_type) === String(currentUserType) &&
                    String(m.sender_id) === String(currentUserId)
                        ? { ...m, status: 'read', read_at }
                        : m
                )));
            });

            // Typing events
            s.on('typing', (user: string) => {
                setTypingUsers(prev => new Set([...prev, user]));
            });
            s.on('stop_typing', (user: string) => {
                setTypingUsers(prev => {
                    const updated = new Set(prev);
                    updated.delete(user);
                    return updated;
                });
            });

            // Group messages
            s.on('group:message', async (msg: any) => {
                // Only append if viewing the same group room
                const sameRoom = String(msg.room_id) === String(receiver_id);
                if (!sameRoom) return;
                try {
                    const decrypted = await decryptMessage(
                        msg.ciphertext,
                        msg.sender_type,
                        msg.sender_id,
                        'group',
                        msg.room_id ?? receiver_id,
                    );
                    console.log('[socket] group:message recv', { room_id: msg.room_id, sent_at: msg.sent_at });
                    appendMessage(normalizeMessage({ ...msg, message: decrypted }));
                    try { s.emit('client:received', { room_id: msg.room_id, kind: 'group' }); } catch {}
                    // Clear unread/highlight for this group conversation
                    try {
                        const s = useNotificationStore.getState();
                        if (s.initialized) s.markRead(makePartyKey('group', msg.room_id ?? receiver_id));
                    } catch {}
                } catch {
                    console.warn('[socket] decrypt failed for group message', msg?.room_id);
                    appendMessage(normalizeMessage(msg));
                    try { s.emit('client:received', { room_id: msg.room_id, kind: 'group' }); } catch {}
                    try {
                        const s = useNotificationStore.getState();
                        if (s.initialized) s.markRead(makePartyKey('group', msg.room_id ?? receiver_id));
                    } catch {}
                }
            });

            // Push-like notifications for DMs (guarded)
            s.on('notify:new_message', async (msg: any) => {
                if (!isSameDMConversation(msg)) return; // guard
                try {
                    const decrypted = await decryptMessage(
                        msg.message,
                        msg.sender_type,
                        msg.sender_id,
                        msg.receiver_type,
                        msg.receiver_id,
                    );
                    console.log('[socket] notify:new_message', { chat_id: msg.chat_id });
                    appendMessage(normalizeMessage({ ...msg, message: decrypted }));
                    try { s.emit('client:received', { chat_id: msg.chat_id, kind: 'notify' }); } catch {}
                    // Clear unread/highlight if notification arrives while viewing
                    try {
                        const s = useNotificationStore.getState();
                        if (s.initialized) s.markRead(partyKey);
                    } catch {}
                } catch (e) {
                    console.warn('[socket] notify decrypt failed', (e as any)?.message || e);
                }
            });

            // Connection lifecycle
            s.on('connect', () => {
                setError(null);
                setSocketReady(true);
                flushQueue();
                try { s.emit('user-online', currentUserId); } catch {}
            });
            // Heartbeat: respond to server pings to keep connection healthy
            s.on('heartbeat:ping', (_payload: any) => {
                try {
                    s.emit('heartbeat:pong', { ts: Date.now() });
                } catch {}
            });
            s.on('connect_error', (_err: any) => {
                setError('Socket connection error');
                setSocketReady(false);
            });
            s.on('reconnect', () => {
                setError(null);
                setSocketReady(true);
                try { s.emit('user-online', currentUserId); } catch {}
            });
            s.on('reconnect_error', () => {
                setError('Socket reconnection failed');
                setSocketReady(false);
            });
            s.on('disconnect', (reason: string) => {
                if (reason !== 'io client disconnect') {
                    setError('Socket disconnected');
                }
                setSocketReady(false);
            });

            s.on('new-message', async (msg: any) => {
                try {
                    if (!msg || msg.chat_id == null || msg.sender_id == null || msg.receiver_id == null) return;
                    const same = isSameDMConversation(msg);
                    if (!same) return;
                    appendMessage(normalizeMessage(msg));
                    try { s.emit('client:received', { chat_id: msg.chat_id, kind: 'flush' }); } catch {}
                    try {
                        s.emit('read', {
                            sender_type: msg.sender_type,
                            sender_id: msg.sender_id,
                            receiver_type,
                            receiver_id,
                            chat_id: msg.chat_id,
                        });
                    } catch {}
                    try {
                        const st = useNotificationStore.getState();
                        if (st.initialized) st.markRead(partyKey);
                    } catch {}
                } catch {}
            });
        })();
        return () => {
            cancelled = true;
            const s = socketRef.current;
            if (s) {
                try { s.disconnect(); } catch {}
                socketRef.current = null;
            }
        };
    }, [currentUserType, currentUserId, receiver_type, receiver_id]);

    // Clear messages when switching conversations to avoid residual display
    useEffect(() => {
        setMessages([]);
    }, [currentUserType, currentUserId, receiver_type, receiver_id]);

    // Send message via socket with optimistic UI status
    const sendMessageSocket = async () => {
        if (!inputText.trim() || !currentUserType || !currentUserId) return;
        setSending(true);
        const s = socketRef.current;
        if (!s || !socketReady) {
            const plaintext = inputText.trim();
            const optimisticMsg: any = {
                sender_type: currentUserType,
                sender_id: currentUserId,
                receiver_type,
                receiver_id,
                message: plaintext,
                sent_at: new Date().toISOString(),
                status: 'queued',
                optimistic: true,
            };
            appendMessage(optimisticMsg);
            await queueMessage(optimisticMsg);
            setInputText('');
            setSending(false);
            return;
        }
        const now = Date.now();
        sendTimestampsRef.current = (sendTimestampsRef.current || []).filter((t) => now - t < 10000);
        if (sendTimestampsRef.current.length >= 5) {
            setError('Too many messages. Please wait a moment.');
            setSending(false);
            return;
        }
        sendTimestampsRef.current.push(now);
        const banned = ['spam', 'abuse', 'scam'];
        const plaintext = inputText.trim();
        if (plaintext.length > 2000) {
            setError('Message too long');
            setSending(false);
            return;
        }
        if (banned.some((w) => plaintext.toLowerCase().includes(w))) {
            setError('Message contains restricted content');
            setSending(false);
            return;
        }
        // Optimistically add the outgoing message with temporary status
        const optimisticMsg: any = {
            sender_type: currentUserType,
            sender_id: currentUserId,
            receiver_type,
            receiver_id,
            message: plaintext,
            sent_at: new Date().toISOString(),
            status: 'sending',
            optimistic: true,
        };
        appendMessage(optimisticMsg);
        setInputText('');

        try {
            const ciphertext = await encryptMessage(
                plaintext,
                currentUserType,
                currentUserId,
                receiver_type,
                receiver_id,
            );
            s.emit('message', {
                sender_type: currentUserType,
                sender_id: currentUserId,
                receiver_type,
                receiver_id,
                message: ciphertext,
            }, (ack: any) => {
                if (ack?.ok && ack?.message) {
                    console.log('[socket] send ack', { chat_id: ack.message.chat_id });
                    // Finalize last optimistic message to delivered
                    setMessages((prev) => {
                        const updated = [...prev];
                        for (let i = updated.length - 1; i >= 0; i--) {
                            const m = updated[i] as any;
                            const isOutgoing = (
                                String(m.sender_type) === String(currentUserType) &&
                                String(m.sender_id) === String(currentUserId)
                            );
                            if (isOutgoing && (m.status === 'sending' || m.optimistic)) {
                                updated[i] = {
                                    ...m,
                                    chat_id: ack.message.chat_id,
                                    sent_at: ack.message.sent_at,
                                    status: 'delivered',
                                    optimistic: false,
                                };
                                break;
                            }
                        }
                        return updated;
                    });
                } else {
                    console.warn('[socket] send ack error', ack?.error);
                    setError('Message send failed');
                    // Mark last optimistic message as failed
                    setMessages((prev) => {
                        const updated = [...prev];
                        for (let i = updated.length - 1; i >= 0; i--) {
                            const m = updated[i] as any;
                            const isOutgoing = (
                                String(m.sender_type) === String(currentUserType) &&
                                String(m.sender_id) === String(currentUserId)
                            );
                            if (isOutgoing && (m.status === 'sending' || m.optimistic)) {
                                updated[i] = { ...m, status: 'error', optimistic: false };
                                break;
                            }
                        }
                        return updated;
                    });
                }
            });
        } catch (e) {
            console.warn('[socket] encrypt or send error', (e as any)?.message || e);
            setError('Message send failed');
            setMessages((prev) => {
                const updated = [...prev];
                for (let i = updated.length - 1; i >= 0; i--) {
                    const m = updated[i] as any;
                    const isOutgoing = (
                        String(m.sender_type) === String(currentUserType) &&
                        String(m.sender_id) === String(currentUserId)
                    );
                    if (isOutgoing && (m.status === 'sending' || m.optimistic)) {
                        updated[i] = { ...m, status: 'error', optimistic: false };
                        break;
                    }
                }
                return updated;
            });
        } finally {
            setSending(false);
        }
    };

    // Typing indicator
    useEffect(() => {
        const s = socketRef.current;
        if (!s || !socketReady || currentUserId == null) return;
        if (!inputText.trim()) {
            s.emit('stop_typing', currentUserId);
        } else {
            s.emit('typing', currentUserId);
        }
        return () => {
            const sc = socketRef.current;
            if (sc && socketReady && currentUserId != null) {
                sc.emit('stop_typing', currentUserId);
            }
        };
    }, [inputText, socketReady, currentUserId]);

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <View style={styles.header}>
                    <TouchableOpacity style={styles.headerIcon} onPress={() => router.back()}>
                        <Svg width="24" height="24" viewBox="0 0 256 256" fill="currentColor">
                            <Path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z" fill="#111" />
                        </Svg>
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                        <Text style={styles.headerTitle}>{receiverDisplayName || 'Chat'}</Text>
                        {(() => {
                            const rt = String(receiver_type || '').toLowerCase();
                            const isGroup = rt === 'group' || rt === 'room' || rt.includes('chat');
                            const othersTyping = Array.from(typingUsers).filter((u) => String(u) !== String(currentUserId));
                            const showDMTyping = !isGroup && typingUsers.has(String(receiver_id));
                            const showGroupTyping = isGroup && othersTyping.length > 0;
                            if (!showDMTyping && !showGroupTyping) return null;
                            return (
                                <View style={styles.headerTypingBubble}>
                                    <Text style={styles.headerTypingText}>
                                        {showDMTyping ? 'Typing…' : `${othersTyping.length} typing…`}
                                    </Text>
                                </View>
                            );
                        })()}
                    </View>
                </View>

                {/* Group messages into sections by date and use SectionList for sticky day headers */}
                {loading && <Text style={{ margin: 16 }}>Loading messages...</Text>}
                {error && <Text style={{ margin: 16, color: 'red' }}>{error}</Text>}
                
                {/* Typing indicator moved to header */}
                
                <SectionList
                    ref={(ref) => { sectionListRef.current = ref as any; }}
                    sections={useMemo(() => {
                        // group messages by local date (yyyy-mm-dd) using local timezone
                        const groups: Record<string, any[]> = {};
                        const pad = (n: number) => String(n).padStart(2, '0');
                        (messages || []).forEach((m) => {
                            const d = m.sent_at ? new Date(m.sent_at) : new Date();
                            // local date key
                            const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                            if (!groups[key]) groups[key] = [];
                            groups[key].push(m);
                        });
                        // build sorted sections (oldest first)
                        const keys = Object.keys(groups).sort((a, b) => (a < b ? -1 : 1));
                        return keys.map((k) => ({ title: k, data: groups[k] }));
                    }, [messages])}
                    ListHeaderComponent={loadingMore ? (
                        <View style={styles.loadingMore}>
                            <ActivityIndicator size="small" color="#666" />
                            <Text style={styles.loadingMoreText}>Loading older messages…</Text>
                        </View>
                    ) : null}
                    keyExtractor={(item: any) => String(item.chat_id ?? item.sent_at ?? Math.random())}
                    onContentSizeChange={(w: number, h: number) => {
                        // Track latest content height and keep pinned to bottom when enabled
                        lastContentHeightRef.current = h || 0;
                        if (autoScrollEnabledRef.current) {
                            const targetOffset = Math.max(0, (h || 0) - (listHeightRef.current || 0));
                            try {
                                (sectionListRef.current as any)?.scrollToOffset?.({ offset: targetOffset, animated: true });
                            } catch {
                                // Fallbacks
                                (sectionListRef.current as any)?.scrollToEnd?.({ animated: true });
                                scheduleScrollToBottom(16);
                            }
                        }
                    }}
                    onLayout={(e: any) => {
                        const h = e?.nativeEvent?.layout?.height ?? 0;
                        listHeightRef.current = h;
                        if (autoScrollEnabledRef.current) {
                            const targetOffset = Math.max(0, (lastContentHeightRef.current || 0) - h);
                            try {
                                (sectionListRef.current as any)?.scrollToOffset?.({ offset: targetOffset, animated: true });
                            } catch {
                                (sectionListRef.current as any)?.scrollToEnd?.({ animated: true });
                            }
                        }
                    }}
                    onScroll={(e: any) => {
                        const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent || {};
                        if (!contentOffset || !contentSize || !layoutMeasurement) return;
                        currentOffsetRef.current = contentOffset.y || 0;
                        const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
                        const threshold = 80; // px tolerance (slightly relaxed for web)
                        const atBottom = distanceFromBottom <= threshold;
                        autoScrollEnabledRef.current = atBottom;
                        // Top detection: lazy-load older when user scrolls near the top
                        const topThreshold = 24;
                        const atTop = (contentOffset.y || 0) <= topThreshold;
                        if (atTop && hasMoreRef.current && !loading && !loadingMore) {
                            // Preserve current scroll by offsetting after content grows
                            const beforeH = lastContentHeightRef.current;
                            setLoadingMore(true);
                            loadMessagesPage(pageRef.current + 1, { append: true })
                                .then(() => {
                                    pageRef.current += 1;
                                    setTimeout(() => {
                                        const afterH = lastContentHeightRef.current;
                                        const delta = Math.max(0, afterH - beforeH);
                                        const target = (currentOffsetRef.current || 0) + delta;
                                        try {
                                            (sectionListRef.current as any)?.scrollToOffset?.({ offset: target, animated: false });
                                        } catch {}
                                        setLoadingMore(false);
                                    }, 0);
                                })
                                .catch((err) => {
                                    console.warn('[chat] load older failed', err?.message || err);
                                    setError('Failed to load older messages');
                                    setLoadingMore(false);
                                });
                        }
                    }}
                    onScrollBeginDrag={() => {
                        // User is interacting; prevent forced auto-scroll until they return near bottom
                        autoScrollEnabledRef.current = false;
                    }}
                    onMomentumScrollEnd={(e: any) => {
                        // Recalculate at-bottom state after fling
                        const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent || {};
                        if (!contentOffset || !contentSize || !layoutMeasurement) return;
                        const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
                        autoScrollEnabledRef.current = distanceFromBottom <= 80;
                    }}
                    onScrollToIndexFailed={(info: any) => {
                        const list = sectionListRef.current as any;
                        if (!list) return;
                        // Wait a bit for measurements and retry scrolling
                        setTimeout(() => {
                            try {
                                list.scrollToLocation({
                                    sectionIndex: info?.sectionIndex ?? 0,
                                    itemIndex: info?.index ?? 0,
                                    viewPosition: 1,
                                    animated: true,
                                });
                                list.scrollToEnd?.({ animated: true });
                            } catch {}
                        }, 100);
                    }}
                    scrollEventThrottle={16}
                    renderItem={({ item }: { item: any }) => {
                        const m = item as any;
                        const isOutgoing = currentUserType && currentUserId && (String(m.sender_type) === String(currentUserType) && String(m.sender_id) === String(currentUserId));
                        const name = m.sender_name ?? '';
                        const time = m.sent_at ? new Date(m.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                        const readTime = m.read_at ? new Date(m.read_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                        const statusText = isOutgoing
                            ? (m.status === 'read'
                                ? (readTime ? `Read • ${readTime}` : 'Read')
                                : m.status === 'delivered' 
                                    ? 'Delivered'
                                    : m.status === 'error'
                                        ? 'Send failed'
                                        : 'Sending…')
                            : '';
                        return (
                            <View style={[styles.messageRow, isOutgoing ? styles.messageRowSender : styles.messageRowReceiver]}>
                                <View style={[styles.messageContent, isOutgoing ? styles.messageContentSender : styles.messageContentReceiver]}>
                                    {/* Clear visual indicator of message ownership */}
                                    <Text style={[styles.messageRole, isOutgoing ? styles.messageRoleSender : styles.messageRoleReceiver]}>
                                        {isOutgoing
                                            ? 'You'
                                            : (() => {
                                                const rt = String(receiver_type || '').toLowerCase();
                                                const isGroup = rt === 'group' || rt === 'room' || rt.includes('chat');
                                                return isGroup
                                                    ? `${String(m.sender_type).charAt(0).toUpperCase() + String(m.sender_type).slice(1)} ${m.sender_id}`
                                                    : (receiverDisplayName || 'Receiver');
                                            })()}
                                    </Text>
                                    {/* show sender name or nothing */}
                                    {name ? <Text style={styles.messageName}>{name}</Text> : null}
                                    <View style={[styles.messageBubble, isOutgoing ? styles.messageBubbleSender : styles.messageBubbleReceiver]}>
                                        <Text style={styles.messageText}>{m.message ?? m.body ?? ''}</Text>
                                    </View>
                                    {time ? <Text style={styles.sentAt}>{time}</Text> : null}
                                    {isOutgoing ? <Text style={styles.sentAt}>{statusText}</Text> : null}
                                </View>
                            </View>
                        );
                    }}
                    renderSectionHeader={({ section }: { section: any }) => {
                        const { title } = section;
                        const pad = (n: number) => String(n).padStart(2, '0');
                        const now = new Date();
                        const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
                        const y = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                        const yesterday = `${y.getFullYear()}-${pad(y.getMonth() + 1)}-${pad(y.getDate())}`;
                        let label = title;
                        if (title === today) label = 'Today';
                        else if (title === yesterday) label = 'Yesterday';
                        else {
                            // parse title (yyyy-mm-dd) as local date for display
                            const parts = String(title).split('-').map((p) => parseInt(p, 10));
                            if (parts.length === 3) {
                                const dt = new Date(parts[0], parts[1] - 1, parts[2]);
                                label = dt.toLocaleDateString();
                            }
                        }
                        return <View style={styles.sectionHeader}><Text style={styles.sectionHeaderText}>{label}</Text></View>;
                    }}
                    stickySectionHeadersEnabled
                    contentContainerStyle={styles.chatContainer}
                />

                <View style={styles.inputArea}>
                    <View style={styles.textInputContainer}>
                        <TextInput
                            placeholder="Type a message"
                            placeholderTextColor="#b1adaa"
                            style={styles.textInput}
                            value={inputText}
                            onChangeText={setInputText}
                            onSubmitEditing={sendMessageSocket}
                            returnKeyType="send"
                        />
                        <View style={styles.inputIcons}>
                            <TouchableOpacity style={styles.iconButton}>
                                <Svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor">
                                    <Path d="M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm0,16V158.75l-26.07-26.06a16,16,0,0,0-22.63,0l-20,20-44-44a16,16,0,0,0-22.62,0L40,149.37V56ZM40,172l52-52,80,80H40Zm176,28H194.63l-36-36,20-20L216,181.38V200ZM144,100a12,12,0,1,1,12,12A12,12,0,0,1,144,100Z" fill="#b1adaa" />
                                </Svg>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.sendButton} disabled={sending || !inputText.trim()} onPress={sendMessageSocket}>
                                <Text style={styles.sendButtonText}>{sending ? 'Sending...' : 'Send'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fffbf8',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        paddingBottom: 8,
        backgroundColor: '#fffbf8',
    },
    headerIcon: {
        width: 48,
        height: 48,
        justifyContent: 'center',
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111',
        // margin moved to headerCenter for stacking
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
        marginRight: 48,
    },
    headerTypingBubble: {
        marginTop: 4,
        backgroundColor: '#eee',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    headerTypingText: {
        fontSize: 12,
        color: '#666',
        fontStyle: 'italic',
    },
    chatContainer: {
        flexGrow: 1,
        paddingBottom: 20,
      
    },
    messageRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    messageRowSender: {
        justifyContent: 'flex-end',
    },
    messageRowReceiver: {
        justifyContent: 'flex-start',
    },
    // profilePic removed — avatars hidden inside chat
    messageContent: {
        flex: 1,
        flexDirection: 'column',
        gap: 4,
        maxWidth: '80%',
    },
    messageContentSender: {
        alignItems: 'flex-end',
        marginLeft: 12,
    },
    messageContentReceiver: {
        alignItems: 'flex-start',
        marginRight: 12,
    },
    messageRole: {
        fontSize: 13,
        color: '#111',
    },
    messageRoleSender: {
        textAlign: 'right',
    },
    messageRoleReceiver: {
        textAlign: 'left',
    },
    messageBubble: {
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    messageBubbleSender: {
        backgroundColor: '#111',
    },
    messageBubbleReceiver: {
        backgroundColor: '#444',
    },
    messageText: {
        fontSize: 16,
        color: '#fff',
    },
    sentAt: {
        fontSize: 12,
        color: '#6b6b6b',
        marginTop: 4,
    },
    messageName: {
        fontSize: 13,
        color: '#333',
        marginBottom: 4,
        fontWeight: '600',
    },
    sectionHeader: {
        paddingVertical: 8,
        alignItems: 'center',
    },
    sectionHeaderText: {
        backgroundColor: '#e9e9e9',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        color: '#333',
        fontWeight: '600',
    },
    loadingMore: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        gap: 8,
    },
    loadingMoreText: {
        fontSize: 12,
        color: '#666',
    },
    typingIndicatorContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    typingIndicatorBubble: {
        backgroundColor: '#444',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 8,
        maxWidth: '80%',
    },
    typingIndicatorText: {
        fontSize: 14,
        color: '#fff',
        fontStyle: 'italic',
    },
    inputArea: {
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
    },
    textInputContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        backgroundColor: '#111',
        height: 48,
    },
    textInput: {
        flex: 1,
        color: '#fff',
        paddingHorizontal: 16,
        fontSize: 16,
    },
    inputIcons: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingRight: 8,
    },
    iconButton: {
        padding: 6,
    },
    sendButton: {
        minWidth: 84,
        height: 32,
        borderRadius: 12,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    sendButtonText: {
        color: '#111',
        fontSize: 14,
        fontWeight: '800',
    },
});

export default ChatScreen;
// Utility: fetch and cache user names by type/id
const userNameCache: Record<string, string | null> = {};
async function fetchUserName(type: string, id: string | number): Promise<string | null> {
  const cacheKey = `${type}:${id}`;
  if (userNameCache[cacheKey]) return userNameCache[cacheKey];
  let url = '';
  if (type === 'artist') url = `/api/artists/${id}`;
  else if (type === 'club' || type === 'venue') url = `/api/venues/${id}`;
  else if (type === 'band') url = `/api/bands/${id}/details`;
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Not found');
    const data = await res.json();
    const name = data.name || null;
    userNameCache[cacheKey] = name;
    return name;
  } catch {
    userNameCache[cacheKey] = null;
    return null;
  }
}

// In message rendering logic (inside JSX):
// Replace direct ID display with name lookup
// Example for each message:
// const senderIsCurrentUser = msg.sender_type === currentUserType && msg.sender_id === currentUserId;
// const senderName = senderIsCurrentUser ? 'You' : (await fetchUserName(msg.sender_type, msg.sender_id)) || 'Unknown';
// const recipientName = (await fetchUserName(msg.receiver_type, msg.receiver_id)) || 'Unknown';
// ... use senderName and recipientName in UI ...
