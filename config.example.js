/**
 * Cloud sync configuration.
 *
 * Copy this file to config.js and fill in your Supabase project credentials.
 * Get them free at https://supabase.com (Project Settings → API).
 *
 * The anon key is safe to include in client-side code — access is protected
 * by Row Level Security in the database.
 */
export const SYNC_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',
};

export function isSyncConfigured() {
  return Boolean(SYNC_CONFIG.supabaseUrl && SYNC_CONFIG.supabaseAnonKey);
}
