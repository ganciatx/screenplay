#!/usr/bin/env python3
"""Deploy helper — prints GitHub Pages instructions."""
print("""
To sync across devices, host this app online:

1. Push to GitHub
2. Enable GitHub Pages (Settings → Pages → main branch)
3. Copy config.example.js → config.js with your Supabase credentials
4. Open the Pages URL on computer + iPad
5. Sign in with the same account on each device
6. iPad: Safari → Share → Add to Home Screen

See README.md for full setup.
""")
