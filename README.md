# Screenplay

A local screenplay editor that syncs across your computer and iPad. No subscription — uses a free Supabase account for cloud storage.

## Features

- **Cross-device sync** — sign in on each device, scripts auto-save to the cloud every 2 seconds
- **Offline support** — keep writing without internet; syncs when you're back online
- **Live updates** — changes on one device appear on another (with conflict prompt)
- **Installable PWA** — add to iPad home screen or desktop for an app-like experience
- **Industry-standard formatting** — Courier Prime 12pt with proper screenplay margins
- **Title page, autocomplete, find/replace, Fountain export, page breaks**
- **Dark / light theme**

## Quick Start (Single Device)

```powershell
python -m http.server 8765
```

Open [http://localhost:8765](http://localhost:8765)

## Cross-Device Setup (One-Time, ~10 Minutes)

### 1. Host the app at a URL all devices can reach

Your iPad can't access `localhost` on your PC. Pick one:

**Option A — GitHub Pages (free, recommended)**

This repo deploys automatically to:

**https://ganciatx.github.io/screenplay/**

After pushing to `main`, enable Pages once: repo **Settings → Pages → Source: GitHub Actions**.

**Option B — Netlify / Vercel**

Drag the folder onto [netlify.com/drop](https://app.netlify.com/drop) for an instant URL.

**Option C — Same Wi-Fi (testing only)**

Run `python -m http.server 8765 --bind 0.0.0.0` and open `http://YOUR-PC-IP:8765` on iPad.

### 2. Create a free Supabase project

1. Sign up at [supabase.com](https://supabase.com)
2. Create a new project
3. Open **SQL Editor** and paste the contents of `supabase/schema.sql`, then run it
4. Go to **Project Settings → API** and copy:
   - **Project URL**
   - **anon public** key

### 3. Configure sync

Copy the example config and add your credentials:

```powershell
copy config.example.js config.js
```

Edit `config.js`:

```javascript
export const SYNC_CONFIG = {
  supabaseUrl: 'https://xxxxx.supabase.co',
  supabaseAnonKey: 'eyJ...',
};
```

If you deploy to GitHub Pages, commit `config.js` (the anon key is safe — database access is protected by Row Level Security).

Alternatively, skip `config.js` and enter credentials once per device via the in-app **Setup Cloud Sync** dialog (stored in that browser).

### 4. Disable email confirmation (optional, easier signup)

In Supabase: **Authentication → Providers → Email** → turn off "Confirm email" for instant account creation.

### 5. Install on each device

**iPad:** Open your hosted URL in Safari → Share → **Add to Home Screen**

**Computer:** Open in Chrome/Edge → install icon in address bar, or bookmark the URL

### 6. Sign in

1. Click **Sign In** on each device
2. Create an account (same email + password everywhere)
3. Your scripts appear in **My Scripts** in the sidebar
4. Write on any device — changes sync automatically

## How Sync Works

| Indicator | Meaning |
|-----------|---------|
| Green dot | Synced to cloud |
| Yellow dot | Syncing… |
| Gray dot | Offline — saved locally, will sync later |
| Red dot | Sync error — data safe in local cache |

- Auto-save every 2 seconds when signed in
- IndexedDB cache for offline access
- If another device updates the same script while you're editing, you'll get a prompt to choose which version to keep

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Tab | Cycle element type |
| Enter | New line |
| Ctrl+1–6 | Set element type |
| Ctrl+F / Ctrl+H | Find / Replace |
| Ctrl+S | Save |
| Ctrl+P | Print / PDF |

## File Formats

- **`.spx`** — native JSON format (save/open locally)
- **`.fountain`** — interchange format (export/import)
- **Cloud** — scripts stored in Supabase when signed in

## License

MIT
