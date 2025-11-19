import AsyncStorage from '@react-native-async-storage/async-storage';

// Utility to re-import the store module fresh (simulates app restart)
async function importFreshStore() {
  jest.resetModules();
  const mod = require('../utils/notificationStore');
  return mod;
}

describe('notificationStore persistence and restore', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.resetModules();
  });

  test('persists and restores starred/highlighted/unread across restart', async () => {
    let { useNotificationStore, makePartyKey } = require('../utils/notificationStore');
    const key = makePartyKey('artist', '123');

    useNotificationStore.getState().setHighlight(key, true);
    useNotificationStore.getState().setStar(key, true);
    useNotificationStore.getState().incrementUnread(key, { star: true, previewText: 'hi' });
    // Allow async persist writes to complete
    await new Promise((r) => setTimeout(r, 200));
    // Proceed to restart and hydrate, then assert restored state

    // Simulate app restart by re-importing the store and hydrating
    ({ useNotificationStore, makePartyKey } = await importFreshStore());
    await useNotificationStore.getState().hydrate();
    // Wait until hydration completes
    for (let i = 0; i < 20; i++) {
      if (useNotificationStore.getState().initialized) break;
      await new Promise((r) => setTimeout(r, 10));
    }

    const s = useNotificationStore.getState();
    expect(s.highlighted[key]).toBe(true);
    expect(s.starred[key]).toBe(true);
    expect(s.unreadByKey[key]).toBe(1);
    expect(s.totalUnread).toBe(1);
    expect(s.initialized).toBe(true);
    expect(s.rehydrateError).toBeNull();
  });

  test('markRead clears unread and highlight and persists across restart', async () => {
    let { useNotificationStore, makePartyKey } = require('../utils/notificationStore');
    const key = makePartyKey('club', '999');
    useNotificationStore.getState().incrementUnread(key, { star: true });
    useNotificationStore.getState().setHighlight(key, true);
    await new Promise((r) => setTimeout(r, 200));
    const raw2 = await AsyncStorage.getItem('notification-store');
    const persisted2 = JSON.parse(String(raw2));
    expect(persisted2?.state?.highlighted?.[key]).toBeUndefined(); // markRead cleared

    // Clear unread/highlight
    useNotificationStore.getState().markRead(key);

    // Re-import fresh and hydrate
    ({ useNotificationStore } = await importFreshStore());
    await useNotificationStore.getState().hydrate();
    for (let i = 0; i < 20; i++) {
      if (useNotificationStore.getState().initialized) break;
      await new Promise((r) => setTimeout(r, 10));
    }

    const s = useNotificationStore.getState();
    expect(s.unreadByKey[key]).toBeUndefined();
    expect(s.highlighted[key]).toBeUndefined();
    expect(s.totalUnread).toBe(0);
  });

  test('works across distinct conversations and sessions', async () => {
    let { useNotificationStore, makePartyKey } = require('../utils/notificationStore');
    const keyA = makePartyKey('artist', '1');
    const keyB = makePartyKey('club', '2');

    useNotificationStore.getState().incrementUnread(keyA, { star: true });
    useNotificationStore.getState().setHighlight(keyA, true);
    useNotificationStore.getState().incrementUnread(keyB, { star: false });
    await new Promise((r) => setTimeout(r, 25));
    // Restart should hydrate from persisted state

    // Restart and hydrate
    ({ useNotificationStore } = await importFreshStore());
    await useNotificationStore.getState().hydrate();
    for (let i = 0; i < 20; i++) {
      if (useNotificationStore.getState().initialized) break;
      await new Promise((r) => setTimeout(r, 10));
    }
    let s = useNotificationStore.getState();
    expect(s.unreadByKey[keyA]).toBe(1);
    expect(s.starred[keyA]).toBe(true);
    expect(s.highlighted[keyA]).toBe(true);
    expect(s.unreadByKey[keyB]).toBe(1);
    expect(s.starred[keyB]).toBeUndefined();

    // Mark A read, leave B unread; restart and verify
    useNotificationStore.getState().markRead(keyA);

    ({ useNotificationStore } = await importFreshStore());
    await useNotificationStore.getState().hydrate();
    s = useNotificationStore.getState();
    expect(s.unreadByKey[keyA]).toBeUndefined();
    expect(s.highlighted[keyA]).toBeUndefined();
    expect(s.unreadByKey[keyB]).toBe(1);
    expect(s.totalUnread).toBe(1);
  });

  test('deduplicates rapid increments and accumulates unread correctly', async () => {
    let { useNotificationStore, makePartyKey } = require('../utils/notificationStore');
    const key = makePartyKey('artist', '42');
    useNotificationStore.getState().incrementUnread(key, { star: true });
    useNotificationStore.getState().incrementUnread(key, { star: true });
    // Within 800ms, the second increment should be ignored
    await new Promise((r) => setTimeout(r, 10));
    expect(useNotificationStore.getState().unreadByKey[key]).toBe(1);
    // After 800ms, further increments should count
    await new Promise((r) => setTimeout(r, 820));
    useNotificationStore.getState().incrementUnread(key, { star: true });
    expect(useNotificationStore.getState().unreadByKey[key]).toBe(2);
    expect(useNotificationStore.getState().totalUnread).toBe(2);
  });
});