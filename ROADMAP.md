# Roadmap

This is the living plan for VN crochet. Keep it short, concrete, and ordered by customer value.

## Now

- **Mobile-first is a non-negotiable product rule.** Design and validate the 320–430px experience first, including safe-area insets, fixed navigation, scrolling, tap targets, and end-of-content spacing; desktop is an enhancement, never the baseline.
- **Keep the mobile system structurally simple.** Prefer one normal document flow plus one fixed navigation dock; avoid decorative pseudo-elements, nested fixed surfaces, viewport-width hacks, and stacked shadows when they can obscure content or create clipping.
- Keep the static modular shop polished and usable.
- Use the current small module split as the baseline for future multi-page work: shared data, browser state, and visual system; page-specific markup stays local.
- Replace emoji product art with consistent original photography or illustrations.
- Refine catalogue content, care details, shipping copy, and custom-order expectations.
- Add focused browser checks for shop, backpack, quests, and custom request flows.

## Next

- Split product data, presentation, and interaction logic into maintainable modules.
- Add a real product detail route and a checkout information step without claiming payment completion.
- Define inventory, order statuses, fulfilment, and customer communication before choosing backend services.
- Add image assets with alt text, compression, and responsive sizing.

## 2026-10-05 · WhatsApp order handoff & backend catalog integration

Connected checkout directly to the maker's WhatsApp (+91 6396709920) with automated pre-filled order summaries, itemized bags, ribbon selections, and delivery details. Also introduced a local Node/Express backend with disk-backed image uploads (`uploads/`) and catalog persistence (`data/catalog.json`), resolving cross-origin localStorage limitations and enabling instant product image previews in the admin creation desk.

## 2026-10-02 · Demo checkout landing

Added a dedicated checkout landing page at `pages/checkout.html` so the bag flow has a real customer handoff instead of ending in the demo-only drawer action. The page reads the existing cart from browser storage, summarizes the order, and collects a local form without claiming secure or real payment processing. This creates a proper first step toward a checkout workflow while staying honest about the current no-backend state.

## 2026-10-02 · Storybook quest-card theme

Refined the visual system with a restrained illustrated-game influence: sky-blue framing, cream paper surfaces, stitched inner borders, layered blue shadows, and softer reward callouts. The catalogue, custom-work panels, rewards cards, and checkout page keep the handmade-shop hierarchy while sharing a more cohesive quest-book treatment.

## 2026-10-02 · Mobile craft dock

Reworked the narrow-screen header into a compact maker badge and floating bottom navigation dock. This keeps the main collection visible sooner, preserves thumb-reachable section switching, and gives the mobile experience a more intentional handheld-game rhythm instead of allowing the header to consume the first quarter of the viewport.

## 2026-10-02 · Compact mobile composition

Reduced the mobile hero panel to a compact welcome banner, attached it to the top content edge, and attached the section dock to the bottom safe area. The collection now enters the viewport sooner while the maker identity and navigation remain visible.

## 2026-10-02 · Full-width mobile navigation shoreline

Expanded the mobile section dock from a floating pill into a full-width bottom sheet with larger touch targets, a stitched inner rail, a stronger top rim, and safe-area-aware padding. It now reads as a deliberate navigation surface rather than another floating card.

## 2026-10-02 · Compact navigation shoreline

Reduced the full-width dock to a 54px compact rail while retaining edge-to-edge width, safe-area support, the stitched inner line, and practical touch targets. This keeps the creative bottom treatment without letting it cover the footer or product context.

## 2026-10-02 · Mobile-first viewport baseline

Made the 320–430px mobile experience the explicit product baseline, not a responsive afterthought. Fixed navigation now has deliberate safe-area and end-of-content clearance, page edges avoid fractional overflow, and future storefront changes must be designed and validated on phone widths before desktop refinements.

## 2026-10-02 · Shared checkout identity

Aligned the order page with the home page identity by reusing the `hud` header treatment, VN crochet naming, warm paper/blue framing, and shared button/card language. Checkout-specific content remains distinct, but it now feels like the next room in the same handmade shop.

## 2026-10-02 · Compact product bottom sheet

Reworked mobile product details into a compact, viewport-contained bottom sheet. The artwork, recipe rows, controls, and add-to-backpack action now fit as one tighter composition instead of inheriting desktop modal spacing.

## 2026-10-02 · Separate studio desk

Added a standalone `admin/` site for managing creations without merging admin controls into the customer storefront. The desk supports catalog listing, search, create/edit/delete, publish/draft status, stock, materials, care notes, featured state, live shop-card preview, and JSON catalog export. In this static prototype, upload saves to localStorage and the storefront reads the saved catalog; real authentication, file storage, and server-side persistence remain future backend work.

## 2026-10-02 · Popup editor and product imagery

Moved the studio editor into a centered desktop dialog and compact mobile bottom sheet so the catalog remains visible while creating or editing. Added local image selection with a 2 MB guard, image preview, persistence in the browser catalog, and storefront fallbacks that keep emoji art working for older products.

## 2026-10-02 · Catalog inspector workspace

Reworked the open desktop workspace beside the catalog into a creation inspector. Selecting a catalog row now shows its shop card, status, stock, level, care, materials, and description without opening the editor; the Edit action remains reserved for changes.

## Later

- Connect a secure backend and authenticated maker/admin workflow.
- Integrate a payment provider only after server-side order verification and secret management are in place.
- Add order confirmation, stock controls, analytics consent, and operational email or WhatsApp workflows.

## Change policy

Update this file for every major considerable site change: a new customer journey, a new system boundary, a significant visual direction shift, or a production integration. Add a dated note under the relevant section describing what changed and why. Do not use this file as a task dump for tiny styling fixes.

## 2026-10-02 · Modular foundation

The temporary reference page was removed. The storefront now uses `index.html`, `css/styles.css`, `js/data.js`, `js/store.js`, and `js/app.js`, with `pages/` reserved for future route-level pages. This is deliberately enough modularity to support growth without prematurely introducing a framework or complex component architecture.

## 2026-10-02 · Catalogue discovery

Added persistent catalogue search across product names, habitats, and material descriptions, including an honest empty state for no matches. This keeps the first customer workflow useful as the catalogue grows without adding a new dependency.

## 2026-10-02 · Craft-market RPG direction

Rebalanced the interface toward a trustworthy handmade shop while preserving the original playful game influence. Shop, Custom Work, and bag actions now lead the navigation; rewards remain a secondary delight layer. Product cards use habitat labels instead of game levels, and the visual treatment is slightly softer and more editorial.

## 2026-10-02 · Reduced repeated story content

Removed the large maker-story panel from the shared page flow because it repeated beneath every tab and competed with shopping. The making story, process summary, and care reminder now live in a compact expandable footer disclosure.

## 2026-10-02 · Contextual content overhaul

Rewrote the storefront context around a handmade studio: clearer reasons to buy, more specific product descriptions, less repeated game vocabulary, and a compact three-part shop-notes strip for batch size, custom work, and care. The game influence remains in the rewards layer rather than defining every product interaction.

## 2026-10-02 · Indian retail pricing

Converted catalogue display and calculations to INR with realistic small-batch crochet reference prices and a centralized ₹1,500 free-shipping threshold. Prices remain demo values until supplier costs, labour time, packaging, delivery, and margin are finalized.