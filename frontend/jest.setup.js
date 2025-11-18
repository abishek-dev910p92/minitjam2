// Mock AsyncStorage for tests
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Quiet down console noise from React Native websockets during tests
global.console = {
  ...console,
  warn: (...args) => {
    const msg = String(args?.[0] || '');
    if (msg.includes('Require cycle') || msg.includes('Setting a timer')) return;
    console.warn(...args);
  },
};