import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@ligapro/database";

import { supabaseSecureStore } from "./secure-store";

let supabase: SupabaseClient<Database> | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.EXPO_PUBLIC_SUPABASE_URL &&
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function getSupabase(): SupabaseClient<Database> {
  if (supabase) {
    return supabase;
  }

  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Faltan EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_ANON_KEY. Copia mobile/.env.example a mobile/.env.",
    );
  }

  supabase = createClient<Database>(url, anonKey, {
    auth: {
      storage: supabaseSecureStore,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  return supabase;
}
