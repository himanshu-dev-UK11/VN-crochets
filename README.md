# VN crochet

VN crochet is a handmade crochet and art-and-craft storefront prototype. The current experience is intentionally warm, tactile, and a little playful: visitors can browse small-batch pals, inspect a crafting recipe, choose a ribbon colour, manage a backpack, complete shop quests, and submit a custom request.

## Current ground truth

- The working site is [index.html](index.html), backed by small browser modules rather than a framework.
- The former temporary reference page has been removed; `index.html` is now the source of truth.
- Product data, cart state, points, quest progress, and the demo request flow run in the browser. Cart state uses `localStorage` under the `kp` key.
- There is no backend, real account system, payment gateway, inventory service, or secure authentication yet. The admin desk is a local browser prototype, not a secure production admin panel.
- A separate browser-only studio desk now lives at [admin/index.html](admin/index.html). It saves catalog changes under the `varsha-catalog` localStorage key, supports compressed-size-checked product image data URLs, and can export a JSON backup; it is not an authenticated production admin system.
- Emoji are temporary product art for the prototype. Real product photography or commissioned illustrations should replace them before launch.
- The current responsive layout is strictly mobile-first: every interaction, spacing decision, and visual change must be designed and checked at 320–430px before desktop. The catalogue, navigation, detail modal, backpack drawer, forms, safe-area edges, and touch controls all have dedicated narrow-screen treatments.
- Catalogue prices use Indian rupees with small-batch Indian retail reference points; the current free-shipping threshold is ₹1,500.

## Run locally

The page can be opened directly, but a local server gives the most reliable browser behaviour:

```powershell
python main.py
```

This starts a small Python server, opens `http://localhost:8000` in your browser, and serves the project from the folder containing `main.py`. Press `Ctrl+C` in the terminal to stop it.

If the browser does not open automatically:

```powershell
python main.py --no-browser
```

Then open `http://localhost:8000` yourself. You can use another port when 8000 is busy:

```powershell
python main.py --port 8080
```

The existing Node server is still available when you need the local catalog and image-upload API used by the admin desk:

```powershell
npm install
npm start
```

That server runs at `http://localhost:3000`. On Windows, opening [index.html](index.html) directly is also enough for the current static demo.

## Experience map

- **Pal Shop**: search by name, habitat, or material; browse by habitat; sort by price; open product recipes; choose a ribbon; and add to the backpack.
- **Rewards**: earn progress for adding pals, collecting three or more, and reaching the free-shipping threshold; the completed set unlocks a demo discount.
- **Custom Work**: submit a short brief and size request. The current form only acknowledges the request locally.
- **Backpack**: adjust quantities, see the shipping meter, apply the quest reward, and run a demo checkout that grants Pal Points.

## Project files

```text
.
├── index.html              # Shared shell and current storefront page
├── css/
│   └── styles.css          # Shared visual system and responsive rules
├── js/
│   ├── app.js              # UI orchestration and event wiring
│   ├── data.js             # Catalogue and ribbon data
│   └── store.js            # localStorage state and cart calculations
├── pages/
│   └── README.md           # Future multi-page boundaries
├── admin/
│   ├── index.html         # Separate catalog management desk
│   ├── admin.css          # Minimal admin visual system
│   └── admin.js           # Local catalog editor and preview
├── AGENTS.md               # Rules for future agentic coding work
├── DESIGN_DIRECTION.md     # Product, visual, content, and UX guardrails
├── ROADMAP.md              # Planned work and change-log policy
└── README.md               # This ground-truth project guide
```

## Design and planning rules

Read [AGENTS.md](AGENTS.md) before editing. It requires thoughtful, distinctive craft design instead of generic AI-generated layouts. Read [DESIGN_DIRECTION.md](DESIGN_DIRECTION.md) for the visual language, accessibility expectations, and content voice. Update [ROADMAP.md](ROADMAP.md) whenever a major change materially alters the site, its architecture, or its customer workflow.

## Next technical boundary

The current modular split is intentionally small rather than heavily abstracted. It gives future multi-page work shared data, state, and styling without forcing a framework or premature component system. Backend work should only begin after the catalogue, order states, fulfilment process, and payment requirements are agreed; a client-only demo must never be presented as secure commerce.
