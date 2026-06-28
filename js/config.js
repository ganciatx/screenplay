/**
 * Fallback when config.js is not present.
 * Copy config.example.js → config.js and add your Supabase credentials.
 */
export const SYNC_CONFIG = {
  supabaseUrl: 'https://ouprjgusnfbllqcgsdxc.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91cHJqZ3VzbmZibGxxY2dzZHhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NzczNTYsImV4cCI6MjA5ODI1MzM1Nn0.hiwH1feZuux4YK3M2rpYew-6D7AgAZcK1ZHO-ZpwL-o',
};

export function isSyncConfigured() {
  return Boolean(SYNC_CONFIG.supabaseUrl && SYNC_CONFIG.supabaseAnonKey);
}
