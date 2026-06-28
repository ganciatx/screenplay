/**
 * Fallback when config.js is not present.
 * Copy config.example.js → config.js and add your Supabase credentials.
 */
export const SYNC_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',
};

export function isSyncConfigured() {
  return Boolean(SYNC_CONFIG.supabaseUrl && SYNC_CONFIG.supabaseAnonKey);
}
