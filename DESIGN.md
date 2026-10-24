# DESIGN.md — GRID

The design contract for the CRGGR storefront, supplied by the merchant. This theme implements it.

**GRID** is a flat, hairline-stroke, true-black interface in the style of a science-fiction control room (TRON / ENCOM). It looks like an instrument panel: thin bright lines on black, wide-tracked capital labels, monospaced data, and colour only where colour means something.

## Brand overview

CRGGR is the personal site of a Shopify Plus developer: a showcase of builds, demos and blog write-ups. Products in the store are demos, not real inventory. The audience is brands, agencies and fellow developers who want to see how the work is done. The site should feel like stepping into a control room: precise, calm, technical, confident.

## Design thesis

Every build is a spec sheet: the site reads like an instrument panel, thin bright lines on black, where colour only ever means something.

## 1. The three rules

1. **Draw with lines, not fills.** Show hierarchy with the brightness of a 1px line. Do not use a background colour to separate things.
2. **Colour is a meaning.** Amber = selected or primary. Cyan = live or interactive. Green = OK. Red = alarm or error. Everything else is white on black.
3. **Move with restraint.** Motion is quiet polish, never decoration: short, decelerating, and only where it explains what happened (a window arriving, a press landing, a header settling). No bounces, no loops, no glow pulses. One exception (merchant, Oct 15 2026): the wallpaper grid floor is ambient and loops (see §14 Wallpaper).

## 2. Hard limits

- Every border is 1px. 2px only for the focus ring, the active tab or nav marker, and the outer panel border.
- Corners are square. Exceptions: panels (8px outer, 4px inner), chips or keycaps (2px). Status dots are circles.
- No gradients. No drop shadows. No blur. No glow. A modal backdrop is a flat, semi-opaque scrim.
- Text is 12px minimum. Touch targets are 44px minimum.
- No emoji. Icons are Lucide outline at stroke-width 1.5 in `currentColor`.
- One accent (amber) element per view, at most. Usually the primary button.
- Mobile-first. Design the phone first, then widen.
- Use only the tokens below. Do not invent a hex value.

## 3. Colors

| Name | Value | GRID token | Theme token / setting | Role |
| --- | --- | --- | --- | --- |
| Page | #000000 | --surface-0 | `color_palette.surface` → `--color-surface` | Page background |
| Panel | #060809 | --surface-1 | `--color-panel` (`bg-panel`) | Panel body |
| Inset well | #0c1013 | --surface-2 | `color_palette.surface_2` → `--color-surface-secondary` | Inputs, inset areas, skeletons |
| Hover fill | #141a1e | --surface-3 | `--color-hover` (`bg-hover`) | Hover / pressed fill |
| Scrim | rgb(0 0 0 / .78) | --scrim | `--color-overlay*` | Modal backdrop |
| Line strong | #d6eaf2 | --line-100 | `--color-line-100` | Panel frame, active outline, panel header strip |
| Line default | #8fa8b4 | --line-200 | `--color-line-200` | Control border (secondary button), hover |
| Line subtle | #4a5a63 | --line-300 | `--color-line-300` | Control border, divider, panel inner box |
| Line faint | #202a2f | --line-400 | `--color-line-400` / `--color-border` | Gridlines, row dividers, card frames |
| Ink primary | #e4f2f8 | --ink-100 | `color_palette.on_surface` → `--color-on-surface` | Primary text |
| Ink secondary | #a8bcc6 | --ink-200 | `--color-ink-200` / `--color-on-surface-secondary` | Secondary text |
| Ink meta | #6b7c85 | --ink-300 | `--color-ink-300` | Meta, captions (only on surface-0/1) |
| Ink disabled | #47555c | --ink-400 | `--color-ink-400` | Disabled |
| Ink invert | #000000 | --ink-invert | `--color-interactive-text` | Text on amber / on line-100 strip |
| Amber | #f6c56a | --accent | `color_palette.interactive` → `--color-interactive` | Primary action, selected, sale price |
| Cyan | #5fcdf3 | --info | `color_palette.accent` → `--color-accent`, `--color-info` | Live, links, focus ring |
| Green | #5edca9 | --success | `--color-success` | In stock, confirmed |
| Red | #f1604c | --danger | `--color-critical` | Error, sold out, destructive |
| Violet | #e6a6f2 | --special | `--color-special` | Rare highlight only |

Tinted fills are 12% of the signal (danger 14%) over transparent, via `color-mix(in oklch, …)`.

Palette mapping note: the theme's `accent` palette slot is cyan (links, focus, live) and its `interactive` slot is amber (the primary button), so the single amber element per view is the primary button.

## 4. Typography

Fonts: **Rajdhani** (display, the human voice) via `type_primary_font` (400) and `type_heading_font` (600). **Space Mono** (machine data) via `type_mono_font` → `--font-mono` (`font-mono`). Fallbacks: "Arial Narrow", sans-serif for Rajdhani; ui-monospace, Menlo, monospace for Space Mono.

| Style | Font | Size | Weight | Case and tracking | Theme class |
| --- | --- | --- | --- | --- | --- |
| Display XL (404 numeral) | display | 96–200px | 600 | Caps, 0.04em, leading 0.9 | `type-display-xl` |
| Display (feature heading) | display | 40–112px mobile, 48–96px from 64rem | 600 | Caps, 0.04em, leading 1.08 | `type-display` |
| Page title (template header bands) | display | 40–72px | 600 | Caps, 0.04em | `type-title` |
| Heading 2XL (article title, hero window) | display | 36–56px | 600 | Caps, 0.04em | `type-heading-2xl` |
| Heading XL / L / M | display | 40 / 32 / 24px | 600 | Caps, 0.04em | `type-heading-xl`, `-lg`, `-md` |
| Heading S (card and list titles) | display | 14px | 600 | Caps, 0.12em | `type-heading-sm` |
| Window title | display | 14px | 600 | CAPS, 0.18em | `type-overline-lg` |
| Label / button | display | 12px | 600 | CAPS, 0.18em | `type-overline`, buttons |
| Body L / Body | display | 18 / 16px | 400 | Sentence case, leading 1.55 | `type-body-lg`, `type-body` |
| Meta / caption | display | 13px | 500 | ink-300 | `type-body-sm` |
| Data L / Data / Data S | mono | 20 / 13 / 12px | 400 | 0.02em | `type-data-lg`, `type-data`, `type-data-sm` |
| Tag (HUD chip) | mono | 12px | 400 | CAPS, 0.04em, framed chip | `hud-tag` |

Every step above is a Text style option (text, price and main menu blocks share the list). Never set a font size through a text block's `class`; if a size is missing, add a step here instead, so the Text style setting always does what it says.

If a person wrote it, display. If a machine produced it, mono. Prices, SKUs, order numbers, quantities, dates, counts, and codes are always mono.

## 5. Voice

- Instrument readout. Short and literal. No exclamation marks. No marketing fluff.
- Buttons and labels are caps verbs: `ADD TO CART`, `CHECKOUT`, `VIEW ALL`.
- Status reads like a system state: `IN STOCK`, `LOW STOCK · 3`, `SOLD OUT`.
- Index with mono counters: `01 / 04`, `ITEM.003`.
- Qualifier suffix in caps marks a variant: `HOODIE.BLACK`.
- Brand mark: the store name as text in Rajdhani 600 caps at 0.28em tracking. No logo image. Do not invent one.

## 6. Spacing and composition

- 4px base scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128.
- Content max 1440px (`max-w-page`), centred. Gutter 24px, 16px under 750px (`px-margin`).
- 12-column grid. Breakpoints 750px (tablet), 990px (desktop) — Tailwind `md`/`lg` approximate these.
- The page is a stack of panels and hairline-divided bands. Sections are separated by space or a 1px line, never alternating background colours. A section never paints its own background.
- Panels in a row: 12px gap. Panel padding 16px. Panel header 26px tall.
- Body text max 68ch.
- No shadows. Radius: 0 everywhere except panels (8/4) and chips (2).

## 7. Components

- **Panel** (`.panel` > `.panel-inner` > `.panel-header` + body): 2px line-100 outer ring, 8px radius, 4px frame gap, surface-1; inner 1px line-300 box, 4px radius; header strip is a line-100 fill with ink-invert 14px caps title and a mono index on the end.
- **Primary button** (`button-primary`): amber fill, black text. Hover: amber 12% fill, amber text, amber border. 44px tall, 20px padding, 13px caps 0.18em. One per view.
- **Secondary button** (`button-secondary` / `button-outline`): transparent, 1px line-200 border, ink-100 text. Hover: line-100 border, surface-3 fill.
- **Ghost button** (`button-ghost`): no border, ink-200 text. Hover: ink-100.
- **Destructive**: 1px danger border and text. Hover: danger fill.
- **Inputs**: surface-2, 1px line-300, square, 44px. Hover line-200. Focus 2px cyan outline. Error danger border + 12px message. Label 12px caps ink-300 above.
- **Badge** (`.badge` + `.badge-success|info|accent|danger`): 20px tall inline, 1px signal border, signal text, 12px caps, optional 6px dot.
- **Chip**: 28px, 1px line-300, 2px radius, 12px caps. Selected: amber border/text, amber fill.
- **Divider**: 1px line-400 or line-300. Never thicker.
- **Key–value row**: label 13px display ink-300, value mono ink-100, dotted line-300 leader, rows split by 1px line-400.
- **Product card**: image in 1px line-400 frame on surface-1, square corners. Hover: frame to line-100, no zoom. Title 14px 600 caps 0.12em. Price 13px mono. Sale price amber; compare-at ink-300 struck. Optional mono index `01` in corner, 12px ink-300.
- **Header**: black, 1px line-400 bottom rule. Runs edge to edge (not capped at 1440px) so the Shopify account popup, which pins to the browser edge, sits under its icon at every width. Store name wordmark in caps 0.28em. Nav in 13px caps 0.18em ink-200, hover ink-100; active item 2px amber bottom edge.
- **Footer**: hairline-divided band; mono meta row (year, store name) and caps link columns.
- **Modal / drawer**: a GRID OS pop-up window (Frame Window = Pop-up window, or `snippets/os-dialog-window.liquid` where a snippet owns the dialog): the native `<dialog>` only positions, animates and traps focus; the window inside draws the frame, title bar and the three lights (close and minimize close the pop-up, zoom fills the screen from 64rem; phones show close only, at touch size). Flat scrim. Drawers slide in (300ms `--ease-drawer`, out in 200ms); the search window rises 12px and fades in; the scrim fades with them. Trap focus, Escape closes.
- **Loading**: skeleton = surface-2 block with 1px line-400 border; spinner = one 1px cyan arc.

## 8. States

| State | Look |
| --- | --- |
| Rest | line-300 border, ink-100/200 text |
| Hover | line one step brighter and/or surface-3 fill, 120ms `--ease-ui` |
| Active | line-100 border, surface-3 fill |
| Selected | amber border/text + amber fill; active tab/nav: 2px amber bottom edge |
| Focus | 2px cyan outline, 2px offset. Always visible |
| Disabled | ink-400 text, line-400 border, no hover |
| Error | danger border + 12px message |
| Success | success text or badge |

## 9. Motion philosophy

Motion is quiet polish (the original no-motion rule was lifted by the merchant in Oct 2026). Tokens: `--ease-ui` cubic-bezier(0.16, 1, 0.3, 1) for small, fast interactions and `--ease-drawer` cubic-bezier(0.32, 0.72, 0, 1) for surfaces. Colour changes on hover 120ms. Button press `scale(0.97)`. Filter chevron rotates 150ms. Header shrink-on-scroll eases over 200ms. Product card images lift to `scale(1.03)` over 500ms on hover, inside their fixed frame. Drawers slide in 300ms and slide back out the way they came (240ms); the search window rises 12px and fades (300ms in, 240ms out); scrims fade both ways. The exit is played by s-dialog.js with WAAPI before the real close so it works in Safari and Firefox too; `data-closing` disables CSS transitions during it. Entries slower than exits. Use transitions and `@starting-style`, not keyframes. `prefers-reduced-motion` turns all movement off.

## 10. Icons

Lucide outline, stroke 1.5, 16/20/24px, `currentColor`. Icon-only buttons are 44×44 with `aria-label`. Icons never replace the wordmark.

## 11. Accessibility

AA contrast with the ink/surface pairs. ink-300 only on surface-0/1. 12px text floor, 44px touch floor. Cyan focus ring on every interactive element. Never colour alone: pair signals with a word or icon.

## 12. Dos and don'ts

| Do | Don't |
| --- | --- |
| Separate with a 1px line | Separate with a grey box |
| Use amber once per view | Make several things amber for emphasis |
| Set prices and numbers in mono | Set data in the display face |
| Caps labels with wide tracking | Lowercase buttons |
| Square corners | Round buttons, inputs, or cards |
| Flat black and white surfaces | Gradients, shadows, glow, blur |
| Short, decelerating motion (120–300ms) | Bounces, long fades, big zooms, looping or decorative animation |
| Check the light theme too | Hardcode a hex that will not invert |

## Light theme

`[data-theme="inverse"]` on `<html>` swaps to: surface-0 #f2f4f4, surface-1 #ffffff, surface-2 #e7ebec, surface-3 #dbe1e3, line-100 #0b1113, line-200 #46565d, line-300 #97a6ac, line-400 #ccd4d7, ink-100 #060a0b, ink-200 #33454c, ink-300 #5c6d74, ink-400 #93a2a8, ink-invert #ffffff, signals mixed toward black (accent 58%, info 61%, success 60%, special 62%, danger 76%).

## Page patterns (applied)

- **Product page:** gallery images sit in 1px `line-400` frames on `panel`, no hover zoom. Info column is one sticky panel titled `SPEC SHEET` with a mono `ITEM.###` index; vendor overline, `type-heading-xl` title, mono price at 20px, then a readout list (STATUS badge, TYPE, SKU) with dotted leaders. Variant options are 2px-radius chips; the selected chip is an amber outline with a 12% amber tint (not a fill), so Add to cart stays the only solid amber. Sold out uses a muted secondary button. The description sits under a `README` overline.
- **Collection page:** a header band with a cyan `SYSTEM` overline, a `type-title` title, and the description capped at 60ch, closed by a hairline. The toolbar uses caps labels, a square sort select, and chip-style active filters. Products sit in the same `INVENTORY` panel as the homepage: a 2/3/4-column grid with hairline borders (borders, not gap fill, so empty trailing cells stay black), mono index, and stock badges.
- The accelerated checkout button (Buy it now / Shop Pay) keeps its own brand colour; this is controlled by Shopify, not the theme.
- **Header band (all secondary templates):** cart, search, blog, article, page, contact and all-collections open with the same band as the collection page: cyan caps overline (`MANIFEST`, `QUERY`, `LOG`, `FILE`, `COMMS`, `DIRECTORY`) with an optional mono readout, a `type-title` title, closed by a 1px `line-400` rule. Header bands use `type-title`; articles use `type-heading-2xl` so long titles stay legible.
- **Listing grids:** search results, blog entries and all-collections reuse the `INVENTORY` panel grid (hairline cells, mono index top-start, status or type badge top-end). Non-product search results carry a cyan type badge (`LOG`, `SYSTEM`, `FILE`).
- **Cart:** a `LINE ITEMS` panel and a sticky `TOTALS` panel. Totals use a key-value row with a dotted leader and a 20px mono figure; Checkout is the only amber. Line items: framed square thumb, caps title, mono variant and prices, 44px square stepper. The cart drawer is a GRID window (see Drawers).
- **Forms (contact, comments, password):** labels are 12px caps `ink-300` above the field; success and error states are 1px signal-bordered boxes with a badge or caps heading, never a thick side stripe or tinted fill.
- **404:** a red `NOT FOUND` badge, a poster-scale "404", recovery copy and one amber action, beside a `DIAGNOSTIC` panel of key-value rows (status, code, requested path) and a framed image.
- **Gift card:** flat panel with the card label in the header strip, mono value, status/balance/expiry key-value rows and the code in an inset well. No tilt, glint or gradient.
- **Motion clean-up:** the stagger fade-in is no longer used on listing grids; (superseded Oct 2026: see Motion philosophy); the cart trash icon signals hover with danger colour only.
- **Placeholder imagery:** wherever an image is missing, use a custom GRID line-art illustration from Files (white/cyan 1px wireframe on black, grid floor, tiny mono corner coordinates), never a stock or product stand-in: `grid-404-off-the-map.png`, `grid-password-sealed-gate.png`, `grid-empty-cart-crate.png`, `grid-article-ridgeline.png`, `grid-collection-rack.png`.
- **Homepage: HUD Viewport (Oct 2026):** every homepage image is a viewfinder (`.hud-viewport` + `hud-brackets` snippet: four 1px line-100 corner brackets). Art renders uncropped at its native ratio (3:2 or 2:3) so overlays placed by percentage stay locked to the drawing. Overlay vocabulary: `.hud-marker` (28px cyan-outlined mono index at `--x/--y`), `.hud-reticle` (cyan brackets around a subject at `--x/--y/--w/--h`), `.hud-tag` (opaque framed mono label). Text and panels sit over the art only from `xl`; below that they stack under the viewport. Regions: Exploded-view hero (4 numbered layer markers + SPEC panel + headline overlay, one amber CTA) → Inventory grid → Target lock (reticle on rider + series panel bound to a collection picker) → Field scan (survey viewport with telemetry readout + editorial window) → Directory.
- **Drawers (cart, filters, nav):** The mobile menu uses the same title bar: MENU at the root, the submenu name plus a 44px back box in nested panels; the window's close light replaces the old close box. Menu rows (`.grid-nav-row`): 52px hairline-ruled rows (48px in submenus), mono index 01/02/03, Rajdhani 600 caps at 0.14em; hover and current page go cyan. Region and language live in the drawer's pinned footer (hairline top rule), anchored to the bottom on every menu panel. `.grid-window` in `config/styles.css`. Always a floating framed panel: 8px off the screen edges on phones (plus notch/home-bar insets, full height), 16px from 48rem (2px line-100 ring, 8px radius, 4px gap, 1px line-300 inner box via `.grid-window-frame`). Title bar `.grid-window-bar` is a line-100 strip with ink-invert caps title + mono readout and a 44px black `grid-window-close` box. Cart 520px from the right, filters 440px from the left (`--grid-window-width`). Filter rows: caps group titles, square 1px checkboxes (selected = amber outline + amber check, no fill), mono counts, 44px inset-well price inputs.
- **Header cart trigger:** icon and a 2px-radius mono count chip sit side by side; the count never overlaps the icon.
- **Search window / Spotlight (Oct 16 2026):** one shared GRID Spotlight (`snippets/spotlight.liquid` + `assets/s-spotlight.js`) powers both the homepage SPOTLIGHT window and the search pop-up (`.grid-window-modal`, ⌘K, dock search). Borderless query bar on a hairline rule (cyan on focus), then a full-width grouped list: before a query TOP HITS (caller-owned, Featured collection picker) + COMMANDS (/cart /shop /collections /compare /account /home; "/" filters, unknown shows the ERR line, cart/compare open in place); typing fetches predictive results for every resource: Top hit, Suggestions (refine the query), Products (price, SOLD OUT badge), Collections, Journal, Pages, and a Search all row. Highlighted row: 2px cyan start edge + hover fill. No preview pane (merchant removed it). Never build a second search UI; change the snippet.
- **Header settings:** the header block has `Scroll behavior` (Static / Sticky / Sticky with compact logo; a select, because checkbox settings on the layout-owned header did not save in Canvas) and `Logo position` (Left / Center). The row is a 3-area grid (`brand nav actions`; centred: `nav logo actions`, true-centred from md, centred between toggle and icons on phones). Shrink eases over 200ms (wordmark 14px, row 52px) driven by `data-scrolled` from `s-sticky-header.js`.
- **Hotspots:** `blocks/hotspot.liquid` pins a numbered marker (hud-marker look, 44px hit area, cyan fill when open) at `x`/`y` percent of a `relative` image frame. Clicking opens a framed readout window (panel ring, light title strip with `Pt.01` mono index + close box, caller text blocks, optional product row with cyan VIEW). From 48rem it anchors beside the marker and flips to stay on screen; on phones it docks 8px off the bottom edge. Fades and nudges 6–8px in over 200ms. Used on the homepage hero's exploded board (01–04 = SPEC layers) and on the PARK SESSION image (01/02 boards, 03 wax on the box, each with a product). Cropped (object-cover) frames put hotspots on a centred square layer sized `max(100cqw,100cqh)` inside a `container-type:size` frame so they stay on the art at every crop.
- **Frame block (RULE):** every frame in a template or layout is a `{% block 'frame' %}`, never raw `.panel` / `.panel-inner` / `.hud-viewport` markup. Only block files (which may not call blocks: `hotspot`, `gift-card`) keep raw `.panel` markup. `blocks/frame.liquid` is the editable form of `.panel`. Settings: Frame style (`frame-grid` = GRID window ring/gap/inner box, `frame-hairline` = 1px line-300, `frame-none`), Frame color (`--frame-line`: ring, hairline and filled bar; dark colors flip bar text light), Background (blank = panel tone; image frames pass `--frame-fallback: surface`), Title bar (Filled / No fill = transparent strip with a hairline under it and light text / Hidden; acts on a first-child `.panel-header`). Every template frame uses it.
- **Collection directory:** `blocks/collection-directory.liquid` renders the DIRECTORY rows from a Collections (collection_list, up to 24) setting; empty falls back to the first 8 store collections. The DIRECTORY title strip no longer shows a store-wide collection count.

## 10. GRID OS layer

The storefront behaves like a quiet wireframe operating system. Every piece follows the motion rules in §9 and stops under reduced motion.

- **Frame settings** (Frame block): Entrance (None / Draw / Scan, default Draw; plays once the first time a frame scrolls into view and never rewinds; frames already on screen skip it), Title bar readout (None / System status / Clock / Scroll position / Alert, from 48rem) and Width (Auto or 4–12 of 12 columns on desktop).
- **Image morph**: product card images and the first product image share `view-transition-name: pimg-<product id>`; cross-document view transitions grow the card into the product page.
- **Data transfer**: on add to cart a 12px cyan packet arcs to the header cart trigger, which blips cyan, then the cart opens.
- **Telemetry ticker**: retired Oct 15 2026 (the OS menu bar is the top edge; see §13). The `ticker.*` keys remain in the locale file.
- **Status bar**: replaced by the dock Oct 15 2026 (§13). Clock moved to the menu bar; Commands, Compare and Cart are dock tiles.
- **Command palette**: the search window lists commands before a query. Typing "/" switches to command mode: /cart, /shop, /collections, /compare, /account, /home; partial names narrow the list, Enter runs the match, unknown names show an ERR line. /cart and /compare open their windows in place. ⌘/Ctrl+K or / opens the palette anywhere.
- **Compare window**: up to three products from card Compare toggles, side by side; rows that differ read cyan.
- **Product tabs**: README / SHIPPING / SUPPORT on a hairline rail; the active tab is cyan with a 2px underline.
- **System dialogs**: 404, the empty cart and sold-out products show a red ERR line with a blinking cursor; their frames use the Alert readout.
- **Target lock**: on card hover, cyan corner brackets snap onto the image with a LOCK tag.

### Homepage: Desktop OS (superseded by §13 Desktop, Oct 15 2026)
The homepage is a GRID OS desktop. The board viewport is the wallpaper window (offset 14% from xl); BOOT (headline + the one amber CTA), SPEC and LIVE UNIT (Featured product block) float over it and hang off its lower edge. Below it the page tiles 12-column window rows using the Frame Width setting: INVENTORY 8 + COMPARE/SHORTCUTS 4, TARGET LOCK 12, FIELD SCAN 5 + README 7 (scroll readout), PARK SESSION 5 + MANUAL tabs 7, DIRECTORY 7 + SYSTEM LOG 5 (status readout). Overlap happens only in the hero; the mosaic never overlaps.

### Product page: GRID OS
- Config terminal above the buy form: "> CONFIG: TYPE // VARIANT // SKU" with a cursor; refreshes with the variant.
- Inspection loupe (fine pointers): 180px square, 2.5x, cyan crosshair, X/Y readout.
- TELEMETRY (6 cols): Flex / All-mountain / Speed / Ability as 10-cell meters from product metafields custom.flex, custom.terrain, custom.speed, custom.ability (integer 1–10); stable demo values until filled. Shown for type "snowboard" or when ratings exist.
- SIZE.CALC (6 cols): height + weight to a recommended length range.
- RELATED.DIR (12 cols): up to four products from the product's first multi-product collection.
- Dock: slim add-to-cart window docked bottom-right (above the status bar) once the buy area scrolls away; submits the main form.

## 13. GRID OS: macOS structure (Oct 15 2026)

The merchant chose macOS *behavior* in GRID *style*: a menu bar, a dock, a desktop of folders and files, and a full window manager, all drawn in GRID lines, type and colour. Never use Apple's logo, fonts or icons.

- **Menu bar** (layout header, sticky, 44px, 1px line-300 rule under it): logo as the system mark, then a hairline divider and the app slot (`os.menubar_app` text block, default "Finder"), replaced by the focused window's title in cyan; the main menu; then localization, a status dot + mono clock (lg+), search, account, cart.
- **Dock** (`blocks/dock.liquid` + `blocks/dock-item.liquid`, layout): phones get a full-width bottom bar (icons only, 44px; Collections, Journal and Compare hidden); from 48rem a framed panel (2px line-100 ring, 4px gap, 1px line-300 inner box) centred 8px above the bottom. Tiles: 48px square, 1px line-300, 24px wireframe glyph (`snippets/os-icon.liquid`). Hover: caps tooltip in a line-100 strip above; macOS physics (`assets/s-dock-physics.js`, Oct 19 2026; fine mouse from 48rem, motion allowed only): continuous fisheye magnification, every tile (tray included) scales up to 1.4 by its distance to the cursor on a cosine falloff over 150px and lifts up to 8px, ramping in over 160ms and out over 220ms (decelerating); items widen by 24px × (scale − 1) a side so tiles never overlap and the dock opens up. Activating a tile plays one 1px cyan ring outward (420ms) and flashes its running square. Arrow keys / Home / End move focus across the tiles (RTL-aware). Before the script runs, the CSS fallback is the stepped zoom (1.3 hovered, 1.12 neighbours). A 4px cyan square under a tile marks its page as open. Counts are cyan 2px-radius mono chips, hidden at zero. After a hairline divider, the **Recents shelf** (`assets/s-dock-recents.js`, Oct 19 2026, 48rem+) shows the last pages the visitor opened (products, collections, the collections list, journal and posts, pages; localStorage `grid:recents`, max 8), recorded by the layout inside `#main-content` so pages streamed into desktop windows count too. It skips the page loaded behind the desktop. Tiles are normal dock items (physics, tooltip with the page title, running square when open as a window): a page image fills the tile inside its 1px frame, otherwise the kind's glyph (bag, folder, journal, file). Dock setting **Recent items**: Off / 3 (default) / 5; the password dock passes `hide_recents`. After another hairline divider, the tray holds minimized windows as tiny windows (title strip + cyan initials).
- **Windows** (`assets/s-window.js`): **one window component**: every window is a Frame block with **Window** set (Page window, Pane, Desktop: open, Desktop: closed, Pop-up window), rendered as `<s-window>` with the same working controls. Never hand-build a window or draw fake lights; desktop windows also take an `id` so icons can open them. Controls are three 12px squares (2px radius, 1px ink border) at the start of the title bar: close / minimize / zoom. They fill red / amber / green only on the focused window (signal colours, not the amber CTA), hollow otherwise; glyphs appear on hover. The focused window keeps the line-100 ring and strip; others step down to line-200. Drag by the title bar, double-click it to zoom, resize from the corner, Esc closes. **Genie (merchant, Oct 24 2026):** minimize pours the window into the dock tray with the macOS Genie warp (300ms: the window pinches into a curved funnel whose neck is the tray slot, then slides down through it; translate + traced clip-path polygon via WAAPI, interruptible). Restoring from the tray, or opening a window from a dock tile or Recents tile, plays it in reverse (340ms). Kept short and snappy at the merchant's request. Opening from anywhere else and close keep scale 0.97 + fade (220/160ms). Desktop (64rem+) only; phones and reduced motion get no animation.
- **Page windows** (`assets/s-window-manager.js`, layout): from 64rem, outside the editor, internal links open as page windows (the fetched page's `#main-content` in a GRID window with Back, title, mono path and a **Full page** chip that leaves the desktop for the real page; every streamed window must keep it). Cart, account and checkout always load as pages. The address bar follows the focused window; refresh loads that page full-screen. Max 6 windows, cascading 28/24px.
- **Desktop** (`blocks/desktop.liquid`, home page): lg+ fills the screen under the menu bar on a perspective grid-floor wallpaper (or a picked image / plain), mono corner coordinates. Open by default: VIEWPORT, BOOT (active), LIVE UNIT. Closed until an icon opens them: SPEC, INVENTORY, COMPARE, SHORTCUTS, TARGET LOCK, FIELD SCAN, README, PARK SESSION, MANUAL, DIRECTORY, SYSTEM LOG. Set a window to Open in Canvas to edit it (selecting a block inside a closed window also opens it in the editor).
- **Desktop icons** (`blocks/desktop-icon.liquid`): 40px glyph over a one-line 11px mono caps label (truncates), in columns from the end edge (8 per column at the minimum height). Folders are cyan. Mouse: first click selects (cyan label fill, cyan glyph), second opens; keyboard and touch open at once; arrow keys move. Icons either open a desktop window (`window` id) or link to a page (opens as a page window).
- **Phones and tablets (<64rem)**: the desktop is a home screen: BOOT, then the icon grid as 58px framed app tiles (4 up, 6 from 40rem), then VIEWPORT and LIVE UNIT. Closed windows open as full-screen sheets with a 44px close box over a flat scrim. Links navigate normally.
- **Product page buy dock** sits above the OS dock (bottom: dock space + 8px).

## 14. GRID OS page windows (Oct 15 2026)

Every template draws its content as windows on the desktop, so a visitor landing straight on any page still gets the OS.

- **Stage**: `.os-stage` on the template's outer wrapper (dock clearance); `.os-stage-inner` caps width at the page max.
- **Wallpaper** (`snippets/os-wallpaper.liquid` + `assets/s-wallpaper.js`): a GLOBAL element on every page. Rendered once in each layout (theme, password) and in gift_card (layout none). One fixed grid floor from 64rem (screen only), hidden only when the home desktop Wallpaper is Image / Plain. Performance: `contain: strict`, loops animate translate/opacity only, the cursor glow layer is `visibility: hidden` until lit, and the script loads only in Flyover + cursor mode. 1px line-300 grid, 80px cells, on a plane tilted 64deg, a deep plane (900px perspective, 1400px long, 300% wide) fading far into the horizon (opaque to 12%, gone by 85%). Flyover: the grid glides toward the viewer (one cell per 3.2s, linear loop). No scan line: removed Oct 15 2026 (merchant found it straining on the eyes); do not reintroduce sweeping lines. Cursor (fine mouse only): the floor tilts up to 3deg / 2.5deg toward the pointer with a heavy lag and the cells within ~220px of it light cyan, fading out after 2.6s at rest. Global setting **Wallpaper motion**: Flyover + cursor (default) / Flyover only / Still. Reduced motion: still floor, no scan, no glow.
- **Page window**: Frame block with `window: 'page'` (class `os-page` for full height) and a `.panel-header.os-page-bar` title bar holding the window title and trailing mono meta. Close goes to the Desktop, minimize sends it to the dock, zoom fills the screen. It loads focused (lit signal lights).
- **Panes**: other windows on the page use `window: 'pane'` with `.os-pane-bar`. Close and minimize send a pane to the dock (restore from the dock tray); zoom fills the screen. Clicking any window focuses it; only the focused window has lit lights and the bright ring. Streamed windows (layout `os-window-template`) are the same Frame block with `window: 'open'`.
- **Opened from the desktop** (inside a window-manager window): page bars, page lights, stage padding and the outer frame fold away, so a page never shows two title bars.
- **Templates**: collection = Finder (sidebar of places and collections, path bar, icon/list view via `<s-finder-view>`, status bar); list-collections = Finder without sidebar; search = Spotlight bar + Top Hits window with the view switch; product = Preview window (gallery, phones keep the full-bleed strip) + Spec Sheet inspector (focused) + Telemetry, Size.calc and Related panes; cart = Items window (focused) + Summary pane, empty cart = Status alert; blog = Journal folder window; article and page = document windows (title + date or handle in the bar); contact = Transmit mail window; 404 = System Alert + Diagnostic pane; password = Login window.
- **View switch**: icon or list view, stored in `localStorage` (`grid:finder-view`) and written to `<html data-finder-view>`; list view re-flows the same product, collection and result cards into rows.

## 15. One screen, static floor (Oct 15 2026)

- **Wallpaper is static.** The merchant found the flyover and the scan line straining on the eyes: the grid floor never moves. Only the cursor glow remains (global setting **Cursor glow**: On / Off). Never add looping or sweeping motion to the wallpaper.
- **Scroll-less from 64rem.** The body is `100dvh` and never scrolls. `.os-stage` is the desktop area between the menu bar and the dock band (`max-height: 100dvh - menubar - dock space`) and only scrolls internally as a fallback. Page windows (`.os-page`) and `.os-fit` frames are exactly one screen tall and scroll inside, under a sticky title bar. Templates should fit their main windows in that one screen; extra panes (e.g. product Telemetry / Size.calc / Related) currently sit below in the stage.
- **Footer** (`.os-footer`, layout): no menu or logo. Two 11px mono caps corners: © year + shop name (start) and the store policy links plus the Your Privacy Choices page (end, ink-300, hover on-surface). No tagline. From 64rem pinned 88px tall to the bottom corners, vertically centred on the dock, each side capped short of the dock. Phones: one hairline row in flow. The desktop's GRID//OS corner coordinate is hidden because the footer owns that corner.

## 16. Password lock screen (Oct 16 2026)

- Lock-screen menu bar (wordmark, cyan LOGIN app slot, lock + mono clock), then ONE centred LOGIN window (max 1024px) on the wallpaper with two columns. Start: cyan SYSTEM OFFLINE overline with red dot, `type-heading-2xl` title, tagline, inline password form (PASSWORD label, field with a Show toggle via `<s-password-field>`, amber ENTER STORE). End: a 320px ACCESS side column behind a 1px line-300 rule (sealed-gate art in a HUD viewport when `grid-password-sealed-gate.png` or Brand cover exists, Status / Network / Local time rows, then an inset lock well with a mono AWAITING KEY cursor filling to the bottom). A bottom hairline row carries GET OPENING UPDATES copy and a secondary NOTIFY ME button that opens the updates pop-up. Phones stack the side column under the form. The frame's Window setting is None (merchant choice), so the title-bar meta uses `ms-auto`. Footer corners and the three-tile dock as elsewhere.
- `layout/password.liquid` must load `s-window.js` (it seats the lights in the title bar) plus `s-entrance.js` and `s-clock.js`. The stage never paints a background, so the wallpaper shows.
- The dock Enter tile focuses the inline password field. The LOGIN window shows close + zoom only (no dock tray to restore a minimized window here). Dialogs carry `text-on-surface`, because a native `<dialog>` defaults to black text.
