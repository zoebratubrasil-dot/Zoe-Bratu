import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedBrowserClient: SupabaseClient | null = null;
let cachedKey = '';

export function getBrowserSupabaseClient(
  supabaseUrl: string | null,
  supabaseAnonKey: string | null
): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  const key = `${supabaseUrl}::${supabaseAnonKey}`;
  if (cachedBrowserClient && cachedKey === key) {
    return cachedBrowserClient;
  }
  cachedBrowserClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      flowType: 'implicit',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  cachedKey = key;
  return cachedBrowserClient;
}
