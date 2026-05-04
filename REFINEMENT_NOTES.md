# Refinement Pass — Open Decisions

Working notes from the autonomous refinement pass on 2026-05-04.
Items below need a yes/no from Balraj before I'd touch them.

## Pending decisions

- **Bottom status text on dashboard tiles** — removed in this pass since it
  duplicated the corner badge. If you preferred a two-line "title + status"
  layout, I'll restore it but only show the status when it differs from the
  badge.
- **Tile title font (Latin):** stayed on Playfair Display, just bumped from
  18→22px. Alternatives: Cormorant Garamond, Italiana, GT Sectra. Say the
  word and I'll swap.
- **Login rolling-loader:** transparent track + gold progress line replaces
  the solid blue tray. If you want a different vibe (e.g. a horizontal hairline
  that fills, no rolling logo at all), tell me.
- **Old `.status` CSS rule** in agent.html is retained-but-unused; I'll
  delete it on the next sweep if no tile re-uses it.
- **Right column ("quick info") on the dashboard** — has weather, time
  zones, news. Worth condensing — feels overstuffed at smaller widths.
  Will tighten in this pass; let me know if you'd rather rebuild it.
