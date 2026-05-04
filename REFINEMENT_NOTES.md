# Refinement Pass — 2026-05-04

## What landed in this pass

### Login (`index.html`)
- Killed the solid blue tray behind the rolling logo. Track is now transparent
  with a faint gold guideline; a synced gold progress fill grows beneath the
  logo as it rolls. Easing tightened (`cubic-bezier(.5,.05,.25,1)`).

### Dashboard (`agent.html`)
- **Tile titles**: 18 → 22 px Playfair Display (19 px Noto Serif JP), tighter
  letter-spacing, single-line min-height enforced.
- **Duplicate badge problem**: removed the bottom `.status` row that repeated
  whatever the corner badge already said. Each tile now carries one label.
- **Tile illustration opacity**: 0.32 → 0.18 (0.36 on hover). Less noisy,
  feels more luxury-brochure.
- **Hover arrow**: a subtle gold ↗ slides in on hover (hidden when a corner
  badge already occupies that spot).
- **Welcome row**: `Agent Dashboard` eyebrow now gold + 4px tracking; `h1`
  bumped to clamp(28, 3.4vw, 36) with the name in italic cream.
- **`QUICK ACCESS` header**: gold mini-rule prefix, smaller 11px Inter caps —
  feels like a section divider rather than a title.

### Global polish (`liquid.css`)
- Custom thin gold scrollbars (Firefox + WebKit).
- Gold text-selection color.
- `:focus-visible` rings (visible to keyboard users only).
- Smooth font rendering everywhere.

### Team tree
- **KUNIYASU TOIZUMI** moved from roster → Japan Office (defaults + the
  Apply-Structure migration).

## Open decisions for you

- **Tile title font**: kept Playfair Display since it's the brand serif. If
  you'd rather try Cormorant Garamond / Italiana / GT Sectra, say which and
  I'll swap.
- **Right-column on dashboard** (timezones / shortcuts / quick-info): looks
  busy at smaller widths but I didn't restructure it. Tell me if you want it
  collapsed into a togglable drawer.
- **`.tile .status` legacy CSS rule**: removed in this pass; can be deleted
  outright on next sweep.

## Things I noticed but didn't touch (need your call)

- **Iframe view** in agent.html (when opening IRR Simulator etc.) has a
  `min-height: 100vh` iframe — might cause double-scrollbars in some
  setups. Let me know if you've seen it misbehave.
- **`agent-profile.html` revenue chart** uses static demo data. When real
  Firestore-backed numbers arrive, the bar chart will need a refresh hook.
- **`customers-admin.html`** has no badge for record status (active/lead/
  closed). If you want, I can add a Status column similar to the agents
  admin table.

## Tier 3 items still on the original queue

- Agent Profile — has a hero & charts but data is mocked.
- Attendance — page exists, Firestore writes work; needs the
  weekly-Monday auto-prompt for Balraj/Malik/Shoya only.
- Role-based access — implemented at registration + admin edit. Hooks
  to gate views by role still need wiring on individual pages
  (e.g. Attendance currently visible to all signed-in users; should be
  gated to leadership roles).
