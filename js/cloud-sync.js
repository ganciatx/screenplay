import { SYNC_CONFIG as FILE_CONFIG } from './config.js';
import {
  idbPutScript,
  idbGetScript,
  idbGetAllScripts,
  idbDeleteScript,
  idbGetMeta,
  idbSetMeta,
  idbPushSyncQueue,
  idbClearSyncQueueItem,
  idbGetSyncQueue,
} from './idb.js';

let supabase = null;
let realtimeChannel = null;
let onRemoteUpdate = null;

const CONFIG_KEY = 'supabase-config';

/** Load Supabase client from CDN (no build step). */
async function loadSupabaseClient() {
  if (supabase) return supabase;
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.49.1');
  const config = getEffectiveConfig();
  supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: localStorage,
    },
  });
  return supabase;
}

/** Config from config.js or localStorage (setup modal). */
export function getEffectiveConfig() {
  if (FILE_CONFIG.supabaseUrl && FILE_CONFIG.supabaseAnonKey) {
    return FILE_CONFIG;
  }

  const stored = localStorage.getItem(CONFIG_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed.supabaseUrl && parsed.supabaseAnonKey) return parsed;
    } catch { /* ignore */ }
  }

  if (window.__SYNC_CONFIG?.supabaseUrl) return window.__SYNC_CONFIG;

  return { supabaseUrl: '', supabaseAnonKey: '' };
}

export function saveConfigToStorage(url, anonKey) {
  const config = { supabaseUrl: url.trim(), supabaseAnonKey: anonKey.trim() };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  window.__SYNC_CONFIG = config;
  supabase = null;
  return config;
}

export function isCloudConfigured() {
  const cfg = getEffectiveConfig();
  return Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey);
}

export async function getClient() {
  if (!isCloudConfigured()) return null;
  return loadSupabaseClient();
}

export async function getSession() {
  const client = await getClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session;
}

/** Wait for Supabase to restore the session from storage before cloud writes. */
export async function waitForInitialAuth() {
  const client = await getClient();
  if (!client) return null;

  const { data: { session } } = await client.auth.getSession();
  if (session?.user) {
    const auth = await requireAuth();
    return auth?.user ?? null;
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (user) => {
      if (settled) return;
      settled = true;
      subscription.unsubscribe();
      resolve(user);
    };

    const { data: { subscription } } = client.auth.onAuthStateChange(async (event, nextSession) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        if (nextSession?.user) {
          const auth = await requireAuth();
          finish(auth?.user ?? nextSession.user);
        } else {
          finish(null);
        }
      }
    });

    setTimeout(() => finish(null), 4000);
  });
}

/** Validate JWT with Supabase before database writes. */
export async function requireAuth() {
  const client = await getClient();
  if (!client) return null;

  let { data: { user }, error } = await client.auth.getUser();
  if (error || !user) {
    const { data: refreshed, error: refreshError } = await client.auth.refreshSession();
    if (refreshError || !refreshed.session?.user) return null;
    user = refreshed.session.user;
  }

  return { client, user };
}

export async function getUser() {
  const auth = await requireAuth();
  return auth?.user ?? null;
}

export async function signIn(email, password) {
  const client = await getClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const auth = await requireAuth();
  if (!auth) throw new Error('Sign-in succeeded but session could not be verified. Try again.');
  return auth.user;
}

export async function signUp(email, password) {
  const client = await getClient();
  const { data, error } = await client.auth.signUp({ email, password });
  if (error) throw error;

  if (data.session) return data.user;

  const signInResult = await client.auth.signInWithPassword({ email, password });
  if (signInResult.error) throw signInResult.error;
  return signInResult.data.user;
}

export async function signOut() {
  unsubscribeRealtime();
  const client = await getClient();
  if (client) await client.auth.signOut();
}

export async function onAuthChange(callback) {
  const client = await getClient();
  if (!client) return () => {};
  const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
  return () => subscription.unsubscribe();
}

function rowToScript(row) {
  return {
    id: row.id,
    title: row.title,
    titlePage: row.title_page || {},
    lines: row.lines || [],
    updatedAt: row.updated_at,
    userId: row.user_id,
  };
}

export async function listCloudScripts() {
  const client = await getClient();
  if (!client) return [];

  const { data, error } = await client
    .from('scripts')
    .select('id, title, updated_at, title_page')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    title: row.title,
    updatedAt: row.updated_at,
    titlePage: row.title_page,
  }));
}

export async function fetchScript(id) {
  if (isLocalScriptId(id)) {
    return idbGetScript(id);
  }

  const cached = await idbGetScript(id);
  const client = await getClient();

  if (!client || !navigator.onLine) {
    return cached;
  }

  try {
    const { data, error } = await client.from('scripts').select('*').eq('id', id).single();
    if (error) throw error;
    const script = rowToScript(data);
    await idbPutScript(script);
    return script;
  } catch {
    return cached;
  }
}

export async function saveCloudScript(script) {
  const updatedAt = new Date().toISOString();
  const localId = script.id;

  await idbPutScript({ ...script, updatedAt });

  if (!navigator.onLine) {
    await idbPushSyncQueue(buildQueueItem(script, updatedAt, localId));
    return { offline: true, script: { ...script, updatedAt } };
  }

  const auth = await requireAuth();
  if (!auth) {
    await idbPushSyncQueue(buildQueueItem(script, updatedAt, localId));
    return { offline: true, script: { ...script, updatedAt } };
  }

  const { client, user } = auth;

  try {
    let saved;

    if (isLocalScriptId(localId)) {
      const { data, error } = await client
        .from('scripts')
        .insert({
          title: script.title,
          title_page: script.titlePage,
          lines: script.lines,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      saved = rowToScript(data);
      await idbDeleteScript(localId);
    } else {
      const { data, error } = await client
        .from('scripts')
        .upsert({
          id: localId,
          title: script.title,
          title_page: script.titlePage,
          lines: script.lines,
          updated_at: updatedAt,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      saved = rowToScript(data);
    }

    await idbClearSyncQueueItem(localId);
    await idbPutScript(saved);
    return { offline: false, script: saved, migrated: isLocalScriptId(localId) };
  } catch (error) {
    await idbPushSyncQueue(buildQueueItem(script, updatedAt, localId));
    throw error;
  }
}

function buildQueueItem(script, updatedAt, id) {
  return {
    id,
    title: script.title,
    title_page: script.titlePage,
    lines: script.lines,
    updated_at: updatedAt,
  };
}

export async function createCloudScript(title = 'Untitled Screenplay') {
  const auth = await requireAuth();
  if (!auth) throw new Error('Not signed in');

  const { client } = auth;
  const { data, error } = await client
    .from('scripts')
    .insert({
      title,
      title_page: { title, author: '', basedOn: '', contact: '', draftDate: '' },
      lines: [
        { type: 'scene-heading', text: 'INT. LOCATION - DAY' },
        { type: 'action', text: '' },
      ],
      user_id: auth.user.id,
    })
    .select()
    .single();

  if (error) throw error;
  const script = rowToScript(data);
  await idbPutScript(script);
  return script;
}

export async function deleteCloudScript(id) {
  await idbDeleteScript(id);
  const client = await getClient();
  if (client && navigator.onLine) {
    const { error } = await client.from('scripts').delete().eq('id', id);
    if (error) throw error;
  }
}

export async function flushSyncQueue() {
  if (!navigator.onLine || !isCloudConfigured()) return;

  const queue = await idbGetSyncQueue();
  for (const item of queue) {
    try {
      const auth = await requireAuth();
      if (!auth) break;

      const { client } = auth;

      if (isLocalScriptId(item.id)) {
        await client.from('scripts').insert({
          title: item.title,
          title_page: item.title_page,
          lines: item.lines,
          user_id: auth.user.id,
        });
      } else {
        await client.from('scripts').upsert({ ...item, user_id: auth.user.id });
      }
      await idbClearSyncQueueItem(item.id);
    } catch {
      break;
    }
  }
}

export function subscribeToScript(scriptId, callback) {
  unsubscribeRealtime();
  onRemoteUpdate = callback;

  if (isLocalScriptId(scriptId)) return;

  getClient().then((client) => {
    if (!client || !scriptId) return;

    realtimeChannel = client
      .channel(`script:${scriptId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'scripts', filter: `id=eq.${scriptId}` },
        (payload) => {
          const script = rowToScript(payload.new);
          idbPutScript(script);
          if (onRemoteUpdate) onRemoteUpdate(script);
        }
      )
      .subscribe();
  });
}

export function unsubscribeRealtime() {
  if (realtimeChannel) {
    realtimeChannel.unsubscribe();
    realtimeChannel = null;
  }
  onRemoteUpdate = null;
}

export async function getLastOpenedScriptId() {
  return idbGetMeta('lastOpenedScriptId');
}

export async function setLastOpenedScriptId(id) {
  return idbSetMeta('lastOpenedScriptId', id);
}

export async function mergeLocalAndCloud() {
  const cloudList = await listCloudScripts().catch(() => []);
  const localList = await idbGetAllScripts();
  return { cloudList, localList };
}

export function generateLocalId() {
  return `local-${crypto.randomUUID()}`;
}

export function isLocalScriptId(id) {
  return typeof id === 'string' && id.startsWith('local-');
}
