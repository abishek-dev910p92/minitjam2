import { encryptMessage, decryptMessage } from '../utils/e2e';
import { test, expect } from '@jest/globals';

test('encrypt/decrypt roundtrip (fallback or web)', async () => {
  const sender_type = 'artist';
  const sender_id = '1';
  const receiver_type = 'artist';
  const receiver_id = '2';
  const plaintext = 'hello world';
  const ct = await encryptMessage(plaintext, sender_type, sender_id, receiver_type, receiver_id);
  const dec = await decryptMessage(ct, sender_type, sender_id, receiver_type, receiver_id);
  expect(typeof ct).toBe('string');
  expect(typeof dec).toBe('string');
  expect(dec).toBe(plaintext);
});