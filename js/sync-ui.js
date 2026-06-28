import {
  isCloudConfigured,
  getEffectiveConfig,
  saveConfigToStorage,
  getUser,
  signIn,
  signUp,
  signOut,
  onAuthChange,
  listCloudScripts,
  fetchScript,
  saveCloudScript,
  createCloudScript,
  deleteCloudScript,
  flushSyncQueue,
  subscribeToScript,
  unsubscribeRealtime,
  setLastOpenedScriptId,
  getLastOpenedScriptId,
  generateLocalId,
} from './cloud-sync.js';
import { SYNC_CONFIG } from './config.js';

/**
 * Sync UI and orchestration — auth, script library, status.
 */
export function initSyncManager(handlers) {
  const {
    loadScript,
    getSnapshot,
    setDirty,
    setSyncStatus,
    confirmDiscard,
  } = handlers;

  let currentScriptId = null;
  let currentUpdatedAt = null;
  let cloudSaveTimer = null;
  let scriptList = [];
  let isApplyingRemote = false;

  const els = {
    library: document.getElementById('script-library'),
    accountBtn: document.getElementById('btn-account'),
    syncDot: document.getElementById('sync-dot'),
    authModal: document.getElementById('auth-modal'),
    setupModal: document.getElementById('setup-modal'),
  };

  function applyConfigFromModule() {
    if (SYNC_CONFIG.supabaseUrl && SYNC_CONFIG.supabaseAnonKey) {
      window.__SYNC_CONFIG = SYNC_CONFIG;
    }
  }

  function updateSyncDot(state) {
    if (!els.syncDot) return;
    els.syncDot.dataset.state = state;
    els.syncDot.title = {
      synced: 'Synced',
      syncing: 'Syncing…',
      offline: 'Offline — changes saved locally',
      error: 'Sync error',
      local: 'Local only — sign in to sync',
    }[state] || '';
  }

  function formatRelativeTime(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(iso).toLocaleDateString();
  }

  async function refreshLibrary() {
    if (!els.library) return;

    const user = await getUser();
    if (!user || !isCloudConfigured()) {
      els.library.innerHTML = '<p class="empty-state">Sign in to sync scripts across devices</p>';
      return;
    }

    try {
      scriptList = await listCloudScripts();
    } catch {
      els.library.innerHTML = '<p class="empty-state">Could not load scripts</p>';
      return;
    }

    if (!scriptList.length) {
      els.library.innerHTML = '<p class="empty-state">No scripts yet — click New</p>';
      return;
    }

    els.library.innerHTML = '';
    scriptList.forEach((s) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'library-item' + (s.id === currentScriptId ? ' active' : '');
      btn.innerHTML = `<span class="library-title">${escapeHtml(s.title || 'Untitled')}</span><span class="library-meta">${formatRelativeTime(s.updatedAt)}</span>`;
      btn.addEventListener('click', () => openScriptById(s.id));
      els.library.appendChild(btn);
    });
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  async function openScriptById(id) {
    if (id === currentScriptId) return;
    if (handlers.isDirty?.() && !confirmDiscard?.()) return;

    updateSyncDot('syncing');
    try {
      const script = await fetchScript(id);
      if (!script) throw new Error('Script not found');

      currentScriptId = id;
      currentUpdatedAt = script.updatedAt;
      await setLastOpenedScriptId(id);

      loadScript({
        id: script.id,
        title: script.title,
        lines: script.lines,
        titlePage: script.titlePage,
      });

      subscribeToScript(id, handleRemoteUpdate);
      await refreshLibrary();
      updateSyncDot('synced');
      setSyncStatus?.('Synced');
    } catch (err) {
      updateSyncDot('error');
      alert('Could not open script: ' + err.message);
    }
  }

  function handleRemoteUpdate(script) {
    if (isApplyingRemote) return;
    if (script.updatedAt === currentUpdatedAt) return;

    if (handlers.isDirty?.()) {
      const useRemote = confirm(
        'This script was updated on another device.\n\nOK = load their version\nCancel = keep your changes'
      );
      if (!useRemote) return;
    }

    isApplyingRemote = true;
    currentUpdatedAt = script.updatedAt;
    loadScript({
      id: script.id,
      title: script.title,
      lines: script.lines,
      titlePage: script.titlePage,
    });
    setDirty(false);
    setSyncStatus?.('Updated from another device');
    isApplyingRemote = false;
  }

  function scheduleCloudSave() {
    clearTimeout(cloudSaveTimer);
    cloudSaveTimer = setTimeout(async () => {
      await pushToCloud();
    }, 2000);
  }

  async function pushToCloud(force = false) {
    const user = await getUser();
    if (!user || !isCloudConfigured()) return;
    if (!currentScriptId) return;
    if (!force && isApplyingRemote) return;

    const snap = getSnapshot();
    updateSyncDot('syncing');
    setSyncStatus?.('Syncing…');

    try {
      const result = await saveCloudScript({
        id: currentScriptId,
        title: snap.title,
        titlePage: snap.titlePage,
        lines: snap.lines,
        updatedAt: currentUpdatedAt,
      });

      currentUpdatedAt = result.script.updatedAt;
      updateSyncDot(result.offline ? 'offline' : 'synced');
      setSyncStatus?.(result.offline ? 'Saved offline' : 'Synced');
      await refreshLibrary();
    } catch {
      updateSyncDot('error');
      setSyncStatus?.('Sync failed — saved locally');
    }
  }

  async function handleNewScript() {
    const user = await getUser();
    if (user && isCloudConfigured()) {
      updateSyncDot('syncing');
      const script = await createCloudScript();
      currentScriptId = script.id;
      currentUpdatedAt = script.updatedAt;
      await setLastOpenedScriptId(script.id);
      loadScript({
        id: script.id,
        title: script.title,
        lines: script.lines,
        titlePage: script.titlePage,
      });
      subscribeToScript(script.id, handleRemoteUpdate);
      await refreshLibrary();
      updateSyncDot('synced');
      return true;
    }

    currentScriptId = generateLocalId();
    currentUpdatedAt = null;
    return false;
  }

  async function handleSignIn(email, password) {
    await signIn(email, password);
    await flushSyncQueue();
    await refreshLibrary();
    await openLastOrFirst();
    closeAuthModal();
  }

  async function handleSignUp(email, password) {
    await signUp(email, password);
    closeAuthModal();
    alert('Account created! Check your email if confirmation is required, then sign in.');
  }

  async function openLastOrFirst() {
    const lastId = await getLastOpenedScriptId();
    if (lastId) {
      const exists = scriptList.find((s) => s.id === lastId);
      if (exists) {
        await openScriptById(lastId);
        return;
      }
    }
    if (scriptList.length) {
      await openScriptById(scriptList[0].id);
    } else {
      await handleNewScript();
    }
  }

  function closeAuthModal() {
    els.authModal?.classList.add('hidden');
  }

  function showAuthModal() {
    if (!isCloudConfigured()) {
      showSetupModal();
      return;
    }
    els.authModal?.classList.remove('hidden');
  }

  function showSetupModal() {
    els.setupModal?.classList.remove('hidden');
    const cfg = getEffectiveConfig();
    document.getElementById('setup-url').value = cfg.supabaseUrl || '';
    document.getElementById('setup-key').value = cfg.supabaseAnonKey || '';
  }

  function closeSetupModal() {
    els.setupModal?.classList.add('hidden');
  }

  async function updateAccountButton() {
    const user = await getUser();
    if (!els.accountBtn) return;

    if (user) {
      els.accountBtn.textContent = user.email.split('@')[0];
      els.accountBtn.title = `${user.email} — click to sign out`;
      els.accountBtn.dataset.signedIn = 'true';
    } else {
      els.accountBtn.textContent = 'Sign In';
      els.accountBtn.title = 'Sign in to sync across devices';
      els.accountBtn.dataset.signedIn = 'false';
    }
  }

  function bindUI() {
    els.accountBtn?.addEventListener('click', async () => {
      const user = await getUser();
      if (user) {
        if (confirm(`Sign out of ${user.email}?`)) {
          unsubscribeRealtime();
          await signOut();
          currentScriptId = null;
          await updateAccountButton();
          await refreshLibrary();
          updateSyncDot('local');
        }
      } else {
        showAuthModal();
      }
    });

    document.getElementById('auth-signin')?.addEventListener('click', async () => {
      const email = document.getElementById('auth-email').value.trim();
      const password = document.getElementById('auth-password').value;
      if (!email || !password) return alert('Enter email and password');
      try {
        await handleSignIn(email, password);
        await updateAccountButton();
      } catch (err) {
        alert(err.message);
      }
    });

    document.getElementById('auth-signup')?.addEventListener('click', async () => {
      const email = document.getElementById('auth-email').value.trim();
      const password = document.getElementById('auth-password').value;
      if (!email || !password) return alert('Enter email and password');
      if (password.length < 6) return alert('Password must be at least 6 characters');
      try {
        await handleSignUp(email, password);
      } catch (err) {
        alert(err.message);
      }
    });

    document.getElementById('auth-close')?.addEventListener('click', closeAuthModal);
    document.getElementById('setup-save')?.addEventListener('click', () => {
      const url = document.getElementById('setup-url').value.trim();
      const key = document.getElementById('setup-key').value.trim();
      if (!url || !key) return alert('Enter both URL and anon key');
      saveConfigToStorage(url, key);
      closeSetupModal();
      showAuthModal();
    });
    document.getElementById('setup-close')?.addEventListener('click', closeSetupModal);

    window.addEventListener('online', async () => {
      await flushSyncQueue();
      await pushToCloud(true);
      updateSyncDot('synced');
    });
    window.addEventListener('offline', () => updateSyncDot('offline'));
  }

  async function init() {
    applyConfigFromModule();
    bindUI();
    await updateAccountButton();

    if (isCloudConfigured()) {
      const user = await getUser();
      if (user) {
        await flushSyncQueue();
        await refreshLibrary();
        updateSyncDot('synced');

        const lastId = await getLastOpenedScriptId();
        if (lastId && !handlers.hasLoadedScript?.()) {
          await openScriptById(lastId);
          return { skipLocalDraft: true };
        }
      } else {
        updateSyncDot('local');
        await refreshLibrary();
      }
    } else {
      updateSyncDot('local');
    }

    onAuthChange(async () => {
      await updateAccountButton();
      await refreshLibrary();
    });

    return { skipLocalDraft: false };
  }

  return {
    init,
    scheduleCloudSave,
    pushToCloud,
    handleNewScript,
    refreshLibrary,
    getCurrentScriptId: () => currentScriptId,
    setCurrentScriptId: (id) => { currentScriptId = id; },
    openScriptById,
    showSetupModal,
    isCloudEnabled: () => isCloudConfigured(),
  };
}
