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

  const init = async (url: string) => {
    if (socketRef.current) return socketRef.current;
    try {
      // dynamic import keeps metro bundler from failing when server-side or package missing
      const { io } = await import('socket.io-client');
      const s = io(url, { autoConnect: true });
      socketRef.current = s;
      return s;
    } catch {
      // If socket.io-client is not installed or import fails, return null safely
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

  // Return a stable object so callers can safely use it in effect dependency arrays
  const api = useMemo(() => ({ init, send, on, off, disconnect, socketRef }), []);
  return api;
}
