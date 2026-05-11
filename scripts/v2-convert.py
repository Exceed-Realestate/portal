#!/usr/bin/env python3
"""
v2-convert.py — One-shot conversion of an Exceed Portal page to the v2
(Wise-style minimalist) design.

Usage:  python3 scripts/v2-convert.py <file.html> [active-nav-key]

active-nav-key controls which sidebar item gets the active stripe:
  dashboard | calendar | team | travel | database

Idempotent: re-running on a converted file is a no-op.

Strategy:
  1. Swap root tokens (navy/gold/cream) for v2 charcoal/yellow.
  2. Flatten body background.
  3. Drop Playfair Display → Inter.
  4. Inject v2 sidebar/main CSS before </style>.
  5. Delete old <header class="topbar">...</header> block.
  6. Wrap everything between <body> and the first <script type="module">
     with v2-shell + sidebar + v2-main + v2-top.
"""
import re, sys, pathlib

if len(sys.argv) < 2:
    print("usage: v2-convert.py <file.html> [active-nav-key]", file=sys.stderr)
    sys.exit(1)

path = pathlib.Path(sys.argv[1])
active = (sys.argv[2] if len(sys.argv) > 2 else '').lower()
src = path.read_text(encoding='utf-8')

if 'class="v2-shell"' in src or "class='v2-shell'" in src:
    print(f"✓ {path.name} already v2 — skipping")
    sys.exit(0)

# ---------- 1. Swap root tokens ----------
src = re.sub(r"--navy-0:\s*#0[0-9a-f]{5,7}", "--navy-0: #15171c", src, flags=re.I)
src = re.sub(r"--navy-1:\s*#0[0-9a-f]{5,7}", "--navy-1: #1c1f26", src, flags=re.I)
src = re.sub(r"--navy-2:\s*#[0-9a-f]{6,8}",  "--navy-2: #262a33", src, flags=re.I)
src = re.sub(r"--gold:\s*#d4b87a",           "--gold: #ffd84d",   src, flags=re.I)
src = re.sub(r"--cream:\s*#f1ead8",          "--cream: #f5f7fa",  src, flags=re.I)
src = re.sub(r"--muted:\s*#9aa8c2",          "--muted: #8a91a3",  src, flags=re.I)
src = re.sub(r"--text:\s*#f5f7fb",           "--text: #f5f7fa",   src, flags=re.I)
src = re.sub(r"--line:\s*rgba\(255,255,255,0\.10\)",
             "--line: rgba(255,255,255,0.06)", src)
src = re.sub(r"--line-strong:\s*rgba\(255,255,255,0\.18\)",
             "--line-strong: rgba(255,255,255,0.12)", src)

if '--navy-3' not in src:
    src = re.sub(r"(--navy-2:\s*#[0-9a-f]{6,8}\s*;)",
                 r"\1 --navy-3: #2f3340;", src, count=1, flags=re.I)

# ---------- 2. Flatten body background gradient ----------
src = re.sub(
    r"(body\s*\{[^}]*?background:\s*)(?:[^;]*radial-gradient[^;]*;)",
    r"\1var(--navy-0);",
    src, flags=re.I | re.S)

# ---------- 3. Drop Playfair Display from font-family lists ----------
src = src.replace("'Playfair Display', serif", "'Inter', 'Noto Sans JP', sans-serif")
src = src.replace('"Playfair Display", serif', "'Inter', 'Noto Sans JP', sans-serif")
src = re.sub(r"'Noto Serif JP',\s*'Playfair Display',\s*serif",
             "'Inter', 'Noto Sans JP', sans-serif", src)

# ---------- 4. Inject v2 CSS block before </style> ----------
V2_CSS = r"""
    /* ============================================================
       v2 — Wise-style sidebar shell (matches agent.html)
       ============================================================ */
    .v2-shell { display: grid; grid-template-columns: 240px 1fr; min-height: 100vh; }
    .v2-side {
      position: sticky; top: 0;
      height: 100vh; width: 240px;
      background: var(--navy-1);
      border-right: 1px solid var(--navy-3);
      display: flex; flex-direction: column;
      padding: 20px 14px 14px;
      z-index: 30;
    }
    .v2-brand {
      display: flex; align-items: center; gap: 10px;
      cursor: pointer; padding: 4px 6px 18px;
      border-bottom: 1px solid var(--navy-3);
    }
    .v2-brand-mark {
      width: 34px; height: 34px; border-radius: 8px;
      background: var(--gold); color: #1a1a1a;
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 13px; letter-spacing: .5px;
      font-family: 'Inter', sans-serif;
    }
    .v2-brand-text { display: flex; flex-direction: column; line-height: 1.2; min-width: 0; }
    .v2-brand-text strong { color: var(--cream); font-size: 14px; font-weight: 600; font-family: 'Inter', sans-serif; }
    .v2-brand-text span { color: var(--muted); font-size: 10.5px; letter-spacing: .5px; }
    .v2-nav { display: flex; flex-direction: column; gap: 2px; margin-top: 14px; flex: 1; }
    .v2-nav-item {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 12px; border-radius: 8px;
      color: var(--muted);
      font-size: 13.5px; font-weight: 500;
      font-family: 'Inter', sans-serif;
      text-decoration: none;
      transition: background .15s, color .15s;
      position: relative;
    }
    .v2-nav-item:hover { background: var(--navy-2); color: var(--cream); }
    .v2-nav-item svg { width: 18px; height: 18px; flex: none; }
    .v2-nav-item.active { background: var(--navy-2); color: var(--cream); }
    .v2-nav-item.active::before {
      content: ""; position: absolute; left: -14px; top: 8px; bottom: 8px;
      width: 3px; background: var(--gold); border-radius: 0 3px 3px 0;
    }
    .v2-foot { display: flex; flex-direction: column; gap: 2px; padding-top: 8px; border-top: 1px solid var(--navy-3); }
    .v2-foot-btn {
      display: flex; align-items: center; gap: 12px;
      padding: 9px 12px; border-radius: 8px;
      background: transparent; border: 0;
      color: var(--muted); font-size: 12.5px; font-weight: 500;
      font-family: 'Inter', sans-serif;
      text-align: left; cursor: pointer;
      transition: background .15s, color .15s;
      text-decoration: none;
    }
    .v2-foot-btn:hover { background: var(--navy-2); color: var(--cream); }
    .v2-foot-btn svg { width: 16px; height: 16px; flex: none; }
    .v2-main { display: flex; flex-direction: column; min-width: 0; padding: 0 0 40px; }
    .v2-top {
      display: flex; align-items: center; justify-content: space-between;
      gap: 16px; padding: 18px 32px;
      border-bottom: 1px solid var(--navy-3);
      background: var(--navy-0);
    }
    .v2-top-user { display: flex; align-items: center; gap: 10px; color: var(--muted); font-size: 13px; }
    .v2-top-user strong { color: var(--cream); font-weight: 600; }
    .v2-top-actions { display: flex; align-items: center; gap: 10px; }
    .v2-main .page-head { padding-top: 32px; }
    .v2-main .page-head .eyebrow { color: var(--muted); letter-spacing: 1.8px; }
    @media (max-width: 1180px) {
      .v2-shell { grid-template-columns: 64px 1fr; }
      .v2-side { width: 64px; padding: 16px 8px; }
      .v2-brand-text, .v2-nav-item span, .v2-foot-btn span { display: none; }
      .v2-nav-item, .v2-foot-btn { justify-content: center; padding: 10px; }
      .v2-brand { justify-content: center; }
    }
    @media (max-width: 820px) {
      .v2-shell { grid-template-columns: 1fr; }
      .v2-side {
        position: relative; height: auto; width: 100%;
        flex-direction: row; align-items: center;
        padding: 12px 16px; border-right: 0;
        border-bottom: 1px solid var(--navy-3);
      }
      .v2-nav { flex-direction: row; margin-top: 0; gap: 4px; overflow-x: auto; }
      .v2-nav-item.active::before { display: none; }
      .v2-nav-item.active { box-shadow: inset 0 -2px 0 var(--gold); }
      .v2-foot { flex-direction: row; padding-top: 0; border-top: 0; }
      .v2-top { padding: 14px 18px; }
    }
"""

if V2_CSS.strip()[:80] not in src:
    src = re.sub(r"(\s*</style>)", V2_CSS + r"\1", src, count=1)


def _act(key):
    return ' active' if key == active else ''

SIDEBAR = """  <div class="v2-shell">

    <!-- ===== Sidebar ===== -->
    <aside class="v2-side">
      <div class="v2-brand" onclick="window.location.href='agent.html'" title="Exceed Real Estate">
        <div class="v2-brand-mark">EX</div>
        <div class="v2-brand-text">
          <strong>Exceed</strong>
          <span>REAL ESTATE</span>
        </div>
      </div>
      <nav class="v2-nav">
        <a class="v2-nav-item""" + _act('dashboard') + """" href="agent.html">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          <span>ダッシュボード</span>
        </a>
        <a class="v2-nav-item""" + _act('calendar') + """" href="availability.html">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span>カレンダー</span>
        </a>
        <a class="v2-nav-item""" + _act('team') + """" href="team.html">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <span>チーム</span>
        </a>
        <a class="v2-nav-item""" + _act('travel') + """" href="travel.html">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>
          <span>出張</span>
        </a>
        <a class="v2-nav-item""" + _act('database') + """" href="database.html">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
          <span>データベース</span>
        </a>
      </nav>
      <div class="v2-foot">
        <a class="v2-foot-btn" href="agent.html">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          <span data-i18n="back">ダッシュボード</span>
        </a>
      </div>
    </aside>

    <!-- ===== Main pane ===== -->
    <div class="v2-main">

      <header class="v2-top">
        <div class="v2-top-user">
          <span data-i18n="hello">こんにちは、</span><strong id="userName">—</strong>
        </div>
        <div class="v2-top-actions">
          <div class="lang-toggle" id="langToggle">
            <span class="pill" id="langPill"></span>
            <button data-lang="ja" class="active">日本語</button>
            <button data-lang="en">EN</button>
          </div>
        </div>
      </header>"""

# ---------- 5. Delete old <header class="topbar">…</header> blocks ----------
src = re.sub(r"<header[^>]*class=\"topbar\"[^>]*>[\s\S]*?</header>\s*",
             "", src)

# ---------- 6. Wrap body content with shell + main ----------
# Insert sidebar right after <body...>
src = re.sub(r"(<body[^>]*>)", r"\1\n" + SIDEBAR, src, count=1)

# Insert closing divs before first <script type="module">
closing = "\n    </div><!-- /v2-main -->\n  </div><!-- /v2-shell -->\n\n  "
src = re.sub(r"(\s*)(<script type=\"module\">)",
             closing + r"\2", src, count=1)

path.write_text(src, encoding='utf-8')
print(f"✓ {path.name} converted")
