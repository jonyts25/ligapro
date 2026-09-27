import * as SecureStore from "expo-secure-store";

import type { SupportedStorage } from "@supabase/supabase-js";

/**
 * Adaptador de almacenamiento para la sesión Auth de Supabase.
 * expo-secure-store cifra tokens en el keychain (iOS) / Keystore (Android).
 */
export const supabaseSecureStore: SupportedStorage = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};
