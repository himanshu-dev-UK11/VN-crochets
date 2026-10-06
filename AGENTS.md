# Agent Instructions

## Project intent

Build VN crochet as a memorable handmade crochet and art-and-craft shop, not as a generic ecommerce template. The page should feel made by a person who understands yarn, gifting, small-batch work, and the delight of finding an unusual little object.

## Before editing

- Read `README.md`, `DESIGN_DIRECTION.md`, and `ROADMAP.md`.
- Inspect the nearby implementation before introducing a framework, dependency, or new visual system.
- Treat `index.html`, `css/styles.css`, and the `js/` modules as the source of truth. The split is intentionally modest: keep it understandable instead of introducing abstractions only to appear modular.
- State the local behaviour being changed and make the smallest coherent edit that proves it.

## Design quality bar

- Do not use generic AI-generated patterns: no interchangeable SaaS dashboards, default purple gradients, glassmorphism by reflex, oversized marketing hero copy, or card grids with no editorial point of view.
- Every section needs a reason to exist for a shopper or maker. Prefer specific copy, tactile details, useful product context, and a strong visual rhythm over decoration.
- Keep the palette warm and varied, with yarn, paper, ink, fruit, leaf, and sky references. Preserve the playful character without making the interface noisy or childish.
- Use expressive typography, intentional spacing, and real visual assets when available. Emoji are acceptable only as temporary prototype art.
- Maintain responsive layouts, keyboard focus states, readable contrast, reduced-motion support, and labels for interactive controls.
- Mobile-first is the hard baseline: design and test the primary shop flow at 320px to 430px before desktop, with no horizontal scrolling, clipped copy, content hidden behind fixed navigation, or controls smaller than a practical touch target.
- Treat mobile layout as its own composition. Do not merely shrink desktop cards; preserve scanning, thumb reach, readable type, and bottom-sheet ergonomics.
- Keep future pages compatible with the shared `js/data.js`, `js/store.js`, and `css/styles.css` boundaries. Page-specific markup belongs in `index.html` or a future file under `pages/`; do not duplicate catalogue or cart logic.

## Implementation rules

- Prefer the smallest existing stack and local patterns. Do not add a dependency for a problem the platform already solves.
- Keep customer-facing claims honest: demo checkout, local form handling, and localStorage are not production commerce.
- Never add fake payment security, hard-coded credentials, or pretend inventory guarantees.
- Preserve unrelated user changes. Avoid broad formatting churn and do not commit changes.
- Validate the changed behaviour in a browser or with the narrowest available executable check before finishing.

## Documentation rule

Update `ROADMAP.md` whenever a major site change is made, such as a new customer workflow, a backend boundary, a visual direction change, or a change from static prototype to production architecture. Small copy tweaks and bug fixes do not need a roadmap entry.