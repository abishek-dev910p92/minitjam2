import { useEffect, useMemo, useRef } from 'react';

type MessageHandler = (msg: any) => void;

/**
 * Minimal, defensive chat/socket helper.
 * - Dynamically imports socket.io-client at runtime (so bundler won't crash if missing during SSR/build)
 * - Exposes a small API: init(url), send(event, payload), on(event, handler), off(event, handler), disconnect()
 */
export default function useChat() {
  const socketRef = useRef<any | null>(null);

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        try { socketRef.current.disconnect(); } catch { /* ignore */ }
        socketRef.current = null;
      }
    };
  }, []);

  const init = async (url: string, token?: string) => {
    if (socketRef.current) return socketRef.current;
    try {
      const { io } = await import('socket.io-client');
      const s = io(url, {
        autoConnect: true,
        auth: token ? { token } : undefined,
        transports: ['websocket', 'polling'],
        withCredentials: true,
        path: '/socket.io',
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 500,
        timeout: 5000,
      });
      socketRef.current = s;
      return s;
    } catch {
      return null;
    }
  };

  const send = (event: string, payload?: any) => {
    if (!socketRef.current) return;
    try { socketRef.current.emit(event, payload); } catch { /* ignore */ }
  };

  const on = (event: string, handler: MessageHandler) => {
    if (!socketRef.current) return;
    try { socketRef.current.on(event, handler); } catch { /* ignore */ }
  };

  const off = (event: string, handler?: MessageHandler) => {
    if (!socketRef.current) return;
    try { socketRef.current.off(event, handler); } catch { /* ignore */ }
  };

  const disconnect = () => {
    if (!socketRef.current) return;
    try { socketRef.current.disconnect(); } catch { /* ignore */ }
    socketRef.current = null;
  };

  const joinConversation = (conversationId: string) => {
    if (!socketRef.current) return;
    try { socketRef.current.emit('join_conversation', conversationId); } catch { /* ignore */ }
  };

  const leaveConversation = (conversationId: string) => {
    if (!socketRef.current) return;
    try { socketRef.current.emit('leave_conversation', conversationId); } catch { /* ignore */ }
  };

  const typingStart = (conversationId: string) => {
    if (!socketRef.current) return;
    try { socketRef.current.emit('typing_start', { conversationId }); } catch { /* ignore */ }
  };

  const typingStop = (conversationId: string) => {
    if (!socketRef.current) return;
    try { socketRef.current.emit('typing_stop', { conversationId }); } catch { /* ignore */ }
  };

  // Return a stable object so callers can safely use it in effect dependency arrays
  const api = useMemo(() => ({ init, send, on, off, disconnect, joinConversation, leaveConversation, typingStart, typingStop, socketRef }), []);
  return api;
}
