import { DeviceEventEmitter } from 'react-native';

export const REFRESH_EVENT = 'app:pullToRefresh';

export const emitRefresh = () => {
  try {
    DeviceEventEmitter.emit(REFRESH_EVENT);
  } catch (e) {
    // best-effort
    console.warn('emitRefresh failed', e);
  }
};

export const subscribeRefresh = (cb: () => void) => {
  const sub = DeviceEventEmitter.addListener(REFRESH_EVENT, cb);
  return () => sub.remove();
};

export default { emitRefresh, subscribeRefresh };
