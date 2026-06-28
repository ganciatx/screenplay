# Deploy to GitHub Pages

Your repo is committed locally and ready to push. Run these commands in PowerShell:

## 1. Log in to GitHub (one time)

```powershell
gh auth login
```

Choose: GitHub.com → HTTPS → Login with browser

## 2. Create repo and push

```powershell
cd "C:\Users\jacks\OneDrive\Desktop\screenplay"

gh repo create screenplay --public --source=. --remote=origin --push --description "Screenplay editor with cloud sync"
```

If the repo already exists on GitHub:

```powershell
git remote add origin https://github.com/ganciatx/screenplay.git
git push -u origin main
```

## 3. Enable GitHub Pages

1. Open https://github.com/ganciatx/screenplay/settings/pages
2. Under **Build and deployment → Source**, select **GitHub Actions**
3. Wait ~1 minute for the workflow to finish

## 4. Your live URL

**https://ganciatx.github.io/screenplay/**

Open this on your computer, second computer, and iPad. Add to iPad home screen via Safari → Share → Add to Home Screen.

## 5. Cloud sync (optional but recommended)

1. Create a free Supabase project at https://supabase.com
2. Run `supabase/schema.sql` in the SQL Editor
3. Copy `config.example.js` → `config.js` and add your Supabase URL + anon key
4. Commit and push config.js (anon key is safe for client-side use)

```powershell
copy config.example.js config.js
# edit config.js with your credentials
git add config.js
git commit -m "Add Supabase sync config"
git push
```

Then sign in with the same account on each device.
