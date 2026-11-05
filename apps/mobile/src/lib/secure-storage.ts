import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * All persisted session material goes through the OS keychain/keystore.
 * Never use AsyncStorage for cookies, passwords, or tokens.
 */
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export async function readSecureJson<T>(key: string): Promise<T | null> {
  try {
    const value = await SecureStore.getItemAsync(key, OPTIONS);
    if (!value) {
      return null;
    }
    return JSON.parse(value) as T;
  } catch {
    // Corrupt or unavailable storage must not crash the app; treat as absent.
    return null;
  }
}

export async function writeSecureJson(key: string, value: unknown): Promise<void> {
  await SecureStore.setItemAsync(key, JSON.stringify(value), OPTIONS);
}

export async function deleteSecure(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }
  try {
    await SecureStore.deleteItemAsync(key, OPTIONS);
  } catch {
    // Deleting an absent key is not an error we need to surface.
  }
}
