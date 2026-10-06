# Design Direction

## North star

VN crochet should feel like opening a beautifully arranged craft-market stall online: friendly, tactile, observant, and full of small discoveries. The interface can be playful, but it must still help people choose a gift, understand what they are buying, and trust the maker.

The chosen balance is **70% thoughtful handmade shop and 30% cozy game-world charm**. Shopping, materials, scale, care, and custom work lead the hierarchy. Rewards, points, quests, and playful reactions add character without making the catalogue feel like an inventory screen.

The current content direction is a small handmade studio rather than a fictional game shop: finished crochet pieces, useful product details, custom commissions, and honest demo-state language should be the default context.

## Visual language

- **Materials**: cotton paper, stitched borders, soft shadow ledges, yarn, ribbon, handwritten-feeling details, and imperfect but controlled shapes.
- **Colour**: warm paper and ink form the base; pink, butter yellow, periwinkle, leaf green, and fruit tones provide emphasis. Avoid a single-hue wash and avoid default purple-on-white styling.
- **Typography**: use a characterful display face for headings and a highly readable rounded body face. Keep hierarchy compact in product and checkout contexts.
- **Composition**: mix structured shop tools with one or two surprising editorial moments. Do not make every section a floating card; use full-width bands and framed tools deliberately.
- **Shopping hierarchy**: use shop, custom work, and bag language for primary actions. Keep rewards and points secondary, useful, and easy to ignore.
- **Motion**: use small, meaningful feedback such as a bobbing mascot, pressed buttons, staggered reveal, or a toast. Respect `prefers-reduced-motion`.

## Content voice

Specific, warm, concise, and maker-aware. Say what the item is, how it feels, its scale, and why someone might keep it. Avoid empty phrases such as “elevate your lifestyle” or “curated for you.”

## Experience principles

1. Product personality comes before decoration.
2. Handmade context should be visible: materials, scale, batch size, care, and custom possibilities.
3. Browsing should be easy to scan, while detail views should reward curiosity.
4. A demo state must be labelled as a demo until real services exist.
5. Mobile is a first-class making-and-shopping surface, not a compressed desktop page. Its fixed navigation should remain a single opaque, safe-area-aware surface with restrained decoration so content never appears to pass through it.

## Phone-first standard

The shop must remain comfortable at common narrow widths, including 320px. Keep the primary navigation reachable, use two compact product columns when they improve scanning, make forms and buttons easy to tap, and turn dense overlays into bottom sheets. Check for clipped headings, horizontal overflow, awkward line wraps, and controls that become too small before calling a mobile change complete.