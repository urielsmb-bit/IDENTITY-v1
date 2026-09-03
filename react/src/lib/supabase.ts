import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CONFIG } from '@/config';

export const supabase: SupabaseClient | null = CONFIG.hayBackend()
  ? createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

export function hasBackend(): boolean {
  return !!supabase;
}
