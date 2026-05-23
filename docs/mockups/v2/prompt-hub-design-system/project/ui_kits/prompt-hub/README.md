# prompt-hub · UI kit

A pixel-fidelity recreation of the prompt-hub overlay — the single surface the entire product lives on. Woken by ⌥Space; takes over the whole screen.

## Files

| File | What |
| --- | --- |
| `index.html` | Interactive demo. Click a phase, fire a macro, watch scenes appear in the list, jump phases. |
| `App.jsx` | Overlay shell + layout. |
| `PhaseBar.jsx` | Protocol-layer segmented bar across the top (the 5-phase protocol). |
| `AlignmentPhrases.jsx` | Protocol-layer chip row. |
| `MacroGrid.jsx` | Task-layer card grid. |
| `SceneList.jsx` | Task-layer dense list with status dots and paths. |
| `AuxPanel.jsx` | Aux metadata column (counts, model, recent timestamps). |
| `StatusBar.jsx` | Fixed bottom strip. |
| `Primitives.jsx` | Hotkey, RegionHeader, Pill, EmptyState, Icon. |

## Conventions

- Each region renders its own border + header. No outer chrome wraps regions.
- Semantic color appears ONLY on the surfaces of its layer (purple on PhaseBar/AlignmentPhrase, green on MacroGrid/SceneList, beige on meta strings).
- Every interactive element shows hover (border darken), active (8% semantic fill), focus (2px semantic outline). No shadows. Ever.
- Icons are from `assets/icons/` (lucide, stroke 1.5, 16px). Color follows text, not semantic.

## Interactivity (demo)

- Click a phase segment → updates active phase.
- Click a macro card → spawns a scene (appears in SceneList with name + auto-incrementing duration).
- Click a scene row → "focuses" it (active state).
- `⌘K` opens quick-find (visual only — the input focuses).
- `?` toggles the help overlay (compact list of bindings).

The demo is intentionally non-functional past the visual layer — it's a UI kit, not a working app.
