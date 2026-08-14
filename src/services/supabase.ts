/**
 * Supabase client — the ONLY server Aira talks to, and only for accounts (create-account + login).
 * No clinical data ever goes here; patient records stay device-local behind the vault seam.
 *
 * The client is created lazily and only when a real URL + publishable key are configured
 * (see config/env). When absent, `getSupabase()` returns null and the AuthService falls back to
 * the on-device mock. Session persistence uses localStorage on web; on native we keep the session
 * in-memory (no AsyncStorage dependency in this demo) which is fine for the walkthrough.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { env, hasSupabase } from '../config/env';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!hasSupabase) return null;
  if (client) return client;
  client = createClient(env.supabase.url, env.supabase.publishableKey, {
    auth: {
      persistSession: Platform.OS === 'web',
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}

/**
 * The signed-in counselor's Supabase access token (a short-lived JWT), or null when Supabase isn't
 * configured or no one is signed in. This is the bearer the groq-proxy Edge Function verifies before
 * spending Groq quota — the transcription/summarization services attach it to every proxy call.
 */
export async function getAccessToken(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
