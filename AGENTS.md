# Base Theme Agent Guide

This is a Shopify Liquid theme, but it intentionally avoids several common Shopify theme patterns. Assume standard Shopify Liquid theme mechanics; this file captures this theme's dialect and the conventions external coding agents are most likely to miss.

## Non-negotiables

- **Code is the source of truth:** no `sections/` folder, no `{% section %}` tags, no JSON templates, no schema `presets`, no `{% javascript %}`, and no `{% stylesheet %}`. CSS that utilities cannot express belongs in the owning block's inline `{% style %}` tag under the styling rules below.
- **Block-first composition:** templates compose page content directly from blocks, snippets, inline markup, web components, and inline partial regions. Do not introduce single-use page sections.
- **Template-owned block composition:** block implementations are shared; their usages must be independently customizable. Templates own each page usage's child block calls, settings, and arguments; layouts own global shell usages. Executable `{% block %}` calls never live in `blocks/**/*.liquid` or `snippets/**/*.liquid`, where editing a child call would affect every use of that shared implementation. Compositional blocks render caller composition through `{{ content }}`; intentionally self-contained blocks have no body outlet and require empty caller bodies. Existing violations are migration debt, not precedent.
- **Container-owned layout:** every generic page region gets its own `container` block. A hero, a featured-products grid, and an about region are three sibling containers, never one container wrapping the page. Callers pass all layout classes: `{% block 'container', class: '...', tag: '...' %}...{% endblock %}`. The default tag is `<section>`. Exception: a bespoke region block composes directly at template top level when it owns its own `<section>` and exposes the container's merchant controls (background, padding) in its own schema — never double-wrap one in `container`.
- **Utility classes by default:** no BEM or component CSS files. Styling lives directly in markup through Tailwind utilities and theme tokens; CSS that utilities cannot express stays with its owning block in a `{% style %}` tag whose selectors are private to that file.
- **Single global CSS source:** author shared theme CSS in `config/styles.css`. Canvas/Sidekick compiles that source and persists generated `assets/styles.min.css` after theme changes; never edit the generated asset or add alternate CSS entrypoints. Block-owned CSS that cannot be expressed as utilities uses an inline `{% style %}` tag under the rules below, never a second CSS entrypoint. Classic Edit Code alone does not invoke the compiler.
- **Native browser behavior first:** prefer semantic HTML (`<details>`, `<dialog>`, popovers, forms) and CSS state (`group-open:`) before custom JavaScript.
- **Framework-free JavaScript:** one custom element per JS file, registered with `customElements.define()`. Use partial rendering for server-backed DOM updates.
- **Button actions use commands:** no `data-action`, no inline `onclick`; use `commandfor`/`command`. Non-button events use internal listeners.
- **No global DOM work in components:** scope DOM access and listener setup inside `connectedCallback()`. Preserve pre-existing audited layout bootstrap code, but do not create new module/document-scope exceptions.
- **`DOMContentLoaded` is bootstrap-only:** module scripts are deferred by default. Preserve pre-existing audited layout bootstrap listeners; custom elements and ordinary utilities never add them.
- **Translated UI only:** every user-facing string uses a literal `{{ 'key' | t }}` call.
- **Shopify routes for storefront URLs:** use Liquid `routes.*` for every storefront path, including AJAX API endpoints. JavaScript receives those paths from `data-*` attributes written by Liquid; never hardcode `/cart`, `/search`, `/collections`, or endpoint bases like `/cart/change.js` in JS. If a future need arises for globally reused route keys, add them through a minimal snippet rendered in layout heads. Append `.js`, `.json`, or query parameters to route values only where the API contract requires them.
- **Whitespace matters:** include whitespace between an HTML tag name and a following Liquid delimiter (`<li {% ... %}`, not `<li{% ... %}`).
- **Local reasoning:** keep structure, styling, and behavior close enough that opening one file explains the feature.

## Composition model

Think in this order:

```text
template → container block body → composed blocks/snippets/inline markup → optional partial regions → template-loaded JS
layout → shell block body → composed blocks/snippets/inline markup
block file → own markup/snippets + content when compositional (never another block)
```

- Templates are the page-composition root. Every block used to build a page is invoked from its template, including calls nested syntactically inside a container or other block's body. Layouts are the equivalent root for global shell content only.
- Block files never invoke other blocks. Keep child calls and their per-usage settings/arguments in the caller-owned body. Moving those calls into a snippet or replacing editable children with native markup does not provide independent customization and is not a valid migration.
- `content` is rendered in the caller's scope before the block implementation. Moving calls into a body does not expose the callee's settings, local assignments, or `block.id`. Resolve shared data in caller scope and explicitly design any picker/setting migration; never assume a parent block exports variables to its body.
- Prefer a flat hierarchy: `template > container > block`, with `container > block` repeated once per generic page region.
- Bespoke region blocks are the exception to container wrapping: a merchant-swappable resource region owns its own `<section>`, exposes equivalent background and padding controls, and composes directly at template top level (`template > bespoke-region`).
- Don't create a block file for something used in one template that holds nothing a merchant would edit. Write that markup directly in the template instead.
- Copy, media, and resource-backed content are things a merchant would edit, so they stay blocks even when they appear exactly once.
- Blocks are reusable visual primitives. They provide structural contracts: semantic wrappers, ARIA, behavior hooks, media/data rendering, or web-component shells.
- Snippets are internal utilities. Merchants should never need to interact with them.
- Partials are named inline regions that JavaScript can fetch and patch. They are not files.

### Why composition is template-owned

A child block call written inside a reusable parent's file is one shared authored usage. Changing that child's settings or arguments there affects every use of the parent. Writing the call in the template gives that template ownership of the usage, so its child can be customized without editing shared block files or changing another authored usage.

The primitive's implementation, schema, and defaults remain shared intentionally; do not clone block files to obtain per-usage configuration. Separate call sites in the same template or different templates can differ. Iterations produced by one loop call site still share that call's configuration by design. Global shell calls remain layout-owned and intentionally apply across pages; do not move page-specific composition to a layout as a workaround.

Migration acceptance requires two authored usages of the same primitive: change a child setting and an argument in one, render both, and verify only the targeted usage changes. Keep child editor controls independently selectable/configurable. Internal snippets may share rendering utilities, not take ownership of those child usages.

## Blocks

### Required shape

- Every block has a `{% doc %}` header with typed params and a `{% schema %}` tag.
- Block schemas do not use `presets`.
- Every block accepts:
  - `class` — Tailwind utilities for the top-level element.
  - `attributes` — raw attribute passthrough for uncommon/ad-hoc DOM attributes.
- Compositional blocks render caller-supplied body content with `{{ content }}` at the documented position. Their body and any child block calls are authored in the template or layout, never in the block implementation. Intentionally self-contained blocks (e.g. `variant-picker`, which generates option values) omit the outlet; their callers still use `{% block %}{% endblock %}` with an empty body. Bodyless blocks must not hide otherwise editable children. Snippets use `{{ content }}` only when the caller passes a named `content:` argument.
- Executable `{% block %}` tags are forbidden in `blocks/**/*.liquid` and `snippets/**/*.liquid`; LiquidDoc examples are documentation and do not execute.
- Don't give blocks content params such as `title`, `body`, `heading`, or `subheading`. Copy passed in as a param is baked into the call site, so the merchant cannot select or edit it in the theme editor. Put the copy in `text` blocks at the template call site instead. Exception: `richtext` exposes a schema-backed `text` setting because Shopify dynamic sources can only connect through settings.
- Params are for behavior, data, or structural contracts that are not schema settings: `dismissible`, `role`, `commandfor`, `price`, `loading`, etc.
- Define an explicit param only when the block needs to act on it. If the block merely forwards an attribute and it is not common across call sites, use `attributes` instead.

### Variants

Commonly reused blocks such as `button` and `text` may expose a `variant` schema setting for semantic color/type treatment.

- Variants are classes defined in `@layer components` in `config/styles.css`.
- The caller passes the full class name: `variant: 'button-primary'`, `variant: 'type-body-sm'`. Full names keep every generated class visible to Tailwind's scanner at the call site; never construct them from prefixes at runtime.
- The block uses the variant value directly as a CSS class. Do not prepend prefixes or map variants through Liquid `case` statements.
- The components layer sits below utilities, so `class` can override variant defaults.

### Editable content

Merchants edit this theme through the theme editor, so content they may want to change has to be reachable there. Two mechanisms cover all of it: nested `text` blocks for copy, and block settings for media and resources.

Apply this test while composing a template: **would a merchant ever want to change these words, this image, or this product?** If yes, it is a block or a setting. If no — structural markup, decoration, layout scaffolding — write it directly in the template.

- Copy is `text` blocks. Every headline, paragraph, eyebrow, label, and caption a merchant might reword is its own `{% block 'text' %}`, invoked in the template and nested inside the container call that positions it. One `text` block per editable string, so each is separately selectable in the editor.
- Media and resources are settings. Images, videos, products, and collections a merchant might swap are `image_picker`, `video`, `product`, or `collection` settings on the block that renders them — never a hardcoded asset filename or resource handle.
- Links a merchant might repoint are a `"type": "url"` setting on the block that renders them.
- Brand colors go through the palette utilities: `bg-surface`, `text-on-surface`, `bg-surface-secondary`, `text-accent`, `bg-interactive`, and their variants. They compile to `var(--color-*)`, and `snippets/theme-styles.liquid` re-emits those properties from Theme Settings at runtime, so they follow the merchant's palette. Prefer the adaptive pair `bg-interactive text-interactive-text` over a hand-picked foreground: the bridge recomputes `--color-interactive-text` and the primary and outline button tokens from `interactive`, so they follow a dark redesign where a literal does not.
- Following the palette is not the same as passing contrast. The bridge chooses `--color-interactive-text` with `color_brightness` against 128, a light-or-dark heuristic rather than a WCAG ratio, and hover states darken `.button-primary` with `color-mix(...)` while `.button-outline` paints `--color-interactive` straight onto the surface. When a palette value changes, check every state it renders in with `color_contrast` against the thresholds in `DESIGN.md`, and tell the merchant when neither black nor white clears 4.5:1. Fix the chooser in `snippets/theme-styles.liquid`; a per-region override leaves every other primary button wrong, and `@theme` is inert for any token the bridge re-emits.
- The fixed UI colors — `--color-border`, `--color-on-surface-secondary`, and the status and overlay tokens — are for chrome, never for brand. Fixed means the bridge doesn't update them, not that they stay legible: `--color-on-surface-secondary` carries buyer-visible text (variant titles, cart metadata, vendor names, empty states), so re-check every fixed foreground when a palette change moves surface lightness, and adjust the ones that fail in `@theme`. A raw value (`bg-[#f5f0e8]`) or a stock Tailwind color (`bg-stone-100`) is worse than either: it pins the region for good.
- `container.background` and `text.color` are the merchant's per-region override, not your default. Both emit an inline `style` that beats the class, which is why `text.color` ships unset with a placeholder and the hero example below leaves it alone. Populate one only when the merchant asked that region to differ from the palette, or asked for its color to be theirs to change in the editor.
- Read a populated color setting before you touch it, because the value decides whether the region follows the palette. A literal (`'#112233'`) is frozen; a pointer at a theme setting (`settings.color_palette.surface`) resolves on every render and tracks the palette like the utility does. Never clear one on the assumption it is frozen — replacing a merchant's palette swatch with a utility looks identical on screen today and leaves their editor control empty.
- Never write merchant-facing copy as markup directly in the template, or as a block content param.

A hero region composed this way:

```liquid
{% block 'container', class: 'grid gap-6 py-24' %}
  {% block 'text', tag: 'h1', variant: 'type-display', class: 'max-w-2xl' %}
    {{ 'home.hero.heading' | t }}
  {% endblock %}

  {% block 'text', tag: 'p', variant: 'type-body-lg', class: 'max-w-prose' %}
    {{ 'home.hero.body' | t }}
  {% endblock %}
{% endblock %}
```

Two separately selectable text blocks, not one markup region. The same hero with the heading and body written as `<h1>` and `<p>` in the template is not complete, even though it renders identically.

The heading leaves `color` unset because `<body>` already carries `text-on-surface`, so pointing that setting at `settings.color_palette.on_surface` would render the same pixels while filling an editor control the merchant never asked for. An accent heading the merchant hasn't asked about is `class: 'text-accent'`, which tracks the palette and needs no control at all. What decides it is the request, not the color — when the merchant asks for a region's color to be theirs to change, populate the setting and seed it with a pointer at the matching palette slot:

```liquid
{% block 'text', tag: 'h2', variant: 'type-heading-lg', color: settings.color_palette.accent %}
  {{ 'home.featured.heading' | t }}
{% endblock %}
```

`settings.color_palette.accent` is property access, which block tag arguments accept, and it resolves on every render, so the control opens on the merchant's accent and keeps following it until they pick something else. A hex there renders identically today and freezes the region at the current brand color.

### Merchant settings

Block schema settings are for merchant-editable controls that should be adjustable imperatively in the theme editor: variant selectors, color/background controls, product or collection pickers, etc.

- Aim for 3 or fewer styling settings per block schema by default. If a block wants more, split responsibilities, move broad controls to theme settings, or keep the value as a code-level kwarg. Exception: when the component UX requires more controls, include the focused set needed for that UX and add a short Liquid comment immediately before the schema documenting why.
- The cap does not apply to content settings. Every image, video, product, collection, and link the block renders gets its own picker, however many that is. A block a merchant cannot repoint at their own content is incomplete.
- Each schema setting has one API: bare `<id>`. Read it inside the block using the bare name and keep its ID out of `{% doc %}` params. A local variable may normalize the setting and its fallback:

```liquid
{%- liquid
  assign variant = variant | default: 'type-body'
-%}
```

The setting resolves its schema default before any block-specific fallback. Preserve explicit `false` when defaulting boolean settings with `allow_false: true`.

- Callers override a schema setting with bare kwargs: `variant: 'type-body-sm'`. The dotted `block.settings.*` form is no longer allowed.
- Resource-backed settings (product/collection pickers) take the **resource object**, not a handle. The override resolves through the block schema, so callers pass the drop directly: `product: product`, `collection: collection`. Read it straight from the bare setting name (e.g. `assign product_obj = product`) instead of re-resolving handles via `all_products[...]` / `collections[...]`; use `<id> | default: <fallback>` when the block can also render inside a matching resource loop.

### Theme settings

Theme-level settings are first-class for global brand controls. Use `config/settings_schema.json` when a merchant choice should affect the whole store; do not duplicate those choices as block settings.

- `config/settings_schema.json` uses flat top-level categories with `header` settings for sub-grouping. Do not use nested `{ name, settings }` groups or `preview` fields.
- All schema labels, names, info text, placeholders, and option labels use `t:` keys from `locales/en.default.schema.json`.
- Settings that drive CSS are the theme's public token API: their properties are re-declared at runtime by `snippets/theme-styles.liquid`, so the setting value always beats the CSS initial value. `DESIGN.md`'s Token API section lists them and carries the change rules, including how to promote a private token to a setting.
- Live values are in `config/settings_data.json` under `current`. Changing a schema `default` only shows up on a theme that has never set that value; to change what the merchant sees, change `current`.

## Snippets

Snippets are utilities, not visual merchant-editable components.

- Use snippets for reused internal concerns: icons, meta tags, polyfills, drawers, overflow helpers, layout scaffolding.
- If something is a visual storefront element a merchant may want to edit, make it a block instead.
- Create a snippet when the utility is reused in 2+ places, or when it lifts a self-contained region out of a layout (head machinery, drawers, global script tags) so the layout reads as a skeleton. Otherwise inline it.
- Every snippet has a `{% doc %}` header with typed params and an `@example`.
- Pass body content with `{% capture %}` and a named `content:` param. Inside the snippet, render `{{ content }}`.

```liquid
{% capture drawer_content %}
  ...
{% endcapture %}

{% assign drawer_title = 'cart.title' | t %}
{% render 'drawer', id: 'cart-drawer', title: drawer_title, content: drawer_content %}
```

## Liquid parsing rules

- `{% block %}` and `{% render %}` tag arguments accept variables, literals, and property access, not filter chains. Assign a filtered value immediately before the call instead of writing `label: 'key' | t` or `url: route | append: '.js'`.
- A filter after a `t:` named argument receives the translated output, not that argument. Pre-format interpolated values before calling `t`, then pass the result as the named argument.
- Inside `{% liquid %}`, comments use bare `#` lines. Nested `{% comment %}` tags are parse errors.
- Liquid parses `{% ... %}` inside `<script>` elements and JavaScript comments. Rephrase comments containing Liquid syntax, or wrap literal examples in `{% raw %}`.

## Styling and tokens

### Utility-only styling

- Use Tailwind utilities directly in Liquid markup.
- Do not create custom component class names to recover component boundaries.
- Do not add component CSS files.
- Keep shared authored CSS centralized in `config/styles.css`; do not create alternate CSS entrypoints.
- Block-owned inline CSS: when a block needs CSS that utilities cannot express (layered gradients, SVG artwork selectors, pointer-driven custom properties), put it in that block's single `{% style %}` tag, placed before the block markup so it is parsed first. The tag renders where the block renders, so pages that never render the block never download that CSS and the global bundle stays limited to shared styling. Because the tag is emitted per instance, this is only for blocks that render at most once per page. Selectors are consumed only by that file, values come from global theme tokens, the tag contains no Liquid, and the PR documents the measured global-bundle savings. Shared utilities, variants, tokens, and cross-file selectors remain in `config/styles.css`. `{% stylesheet %}` is never used — it is a separate Shopify-managed CSS pipeline with its own concatenation, no Liquid, and no lint coverage — and the theme CSS linter fails on it.
- `@utility` is for generic primitives only. A custom utility must be a single-concern, component-agnostic primitive that Tailwind lacks (a browser reset like `number-reset`, a pseudo-element hook like `scrollbar-none`, a containment hint like `contain-paint`) that any block could reuse unchanged. Never package one component's visual treatment as a utility: a name that embeds a component (`hero-*`, `gift-card-*`), a body that reads like a component stylesheet (multi-layer gradients, artwork selectors, hover choreography), or a single consumer are each disqualifying. Express component styling with Tailwind utilities in markup; where that is impossible, use the owning block's `{% style %}` tag under the rules above instead of a new `@utility`. Review enforces this (`reviewing-theme-css`); there is no deterministic check.
- Do not use inline styles when a utility or token can express the value.
- `config/styles.css` uses `source(none)`, so Tailwind scans only its explicit `@source` paths. Keep class names complete and statically visible in scanned files, or safelist a finite set with `@source inline("...")`; never assemble utility names dynamically.
- Custom elements are inline by default. Add layout-participating custom-element tags to the `display: block` rule in `@layer base`; a block that owns a `{% style %}` tag may instead declare its element display there. Missing either treatment can collapse measurements such as `ResizeObserver` results to zero.
- Put element defaults in `@layer base`, never in unlayered CSS. Unlayered author rules outrank every layered Tailwind rule and can make utilities unable to override a default.

### Theme tokens

Most design tokens live in `config/styles.css` under Tailwind v4 `@theme`, which auto-generates utility classes; the settings-backed ones are re-emitted at `:root` by `snippets/theme-styles.liquid` and belong to the merchant (see `DESIGN.md` → Token API):

- `--color-*` → `bg-*`, `text-*`, `border-*`
- `--radius-*` → `rounded-*`
- `--spacing-*` → `p-*`, `px-*`, `gap-*`, `max-w-*`

Prefer token-derived utilities over arbitrary values:

| Do | Don't |
|----|-------|
| `border-border` | `border-[rgba(0,0,0,0.1)]` |
| `rounded-button` | `rounded-[14px]` |
| `hover:bg-surface-secondary` | `hover:bg-[rgba(0,0,0,0.03)]` |
| `p-input-y` | `p-[0.8rem]` |

When a new value appears in 2+ places, add a token to `@theme` in `config/styles.css`. Canvas/Sidekick recompiles the generated utilities after the source changes.

### DESIGN.md

`DESIGN.md` at the theme root is this shop's design contract. Read it before design or styling work.

- The marker-delimited theme-tokens section is a generated names-only index: contributing source files, custom properties (settings-backed ones annotated), and `@layer components` classes. Values are deliberately omitted — read them in the listed source files or Theme Settings. When you add, remove, or rename tokens or component classes, update the index in the same change; value-only changes never touch it.
- The markdown body is the authored brand layer: design position, brand direction, Do/Don't rules, and component recipes. Grow it by addition as merchant preferences appear. Ask the merchant before removing or changing a rule, and before rewriting an established brand direction.

### Compiled CSS

`assets/styles.min.css` is generated Tailwind output and is what the storefront loads. Never edit it by hand. Author changes in `config/styles.css`; Canvas/Sidekick recompiles and persists the generated asset after theme-source changes. Classic Edit Code does not invoke that compiler, so a source edit made only there can leave the generated asset stale.

## Right-to-left language support

Stores using Arabic, Hebrew, Urdu, and other right-to-left languages rely on the same theme source. Treat RTL as a requirement.

- Use logical inline utilities for layout and alignment. Prefer `ms-`/`me-`/`ps-`/`pe-`, logical insets (`start-`/`end-`, `text-start`/`text-end`, `border-s`/`border-e`, `rounded-s*`/`rounded-e*`), and logical grid or flex alignment. Do not use physical inline utilities such as `ml-`, `left-`, `text-left`, `border-l`, and `rounded-tl` for directional layout or alignment; they do not follow reading direction.
- Use physical inline behavior only as a last resort, when logical utilities cannot express the requirement (for example, pointer tracking or a symmetric centering pair). In that case, constrain it with `[dir="rtl"]` or a matching `rtl:` variant and document the reason in a short comment. Physical `translate-x-*` and `scale-x-*` should always have an RTL counterpart in the same class attribute.
- Treat `dir` as part of the layout shell. Panels and drawers that slide, park, or stack need to read their direction from the DOM (`[dir="rtl"]`) so they enter from the reading-start side and park against the reading-end side, instead of hardcoding left or right.
- Use `<bdi>` to isolate mixed-direction inline values. Prices, discount codes, vendor names, handles, SKUs, and tags can use scripts and numbers that differ from the surrounding sentence; wrapping those values in `<bdi>` keeps digits and punctuation adjacent and prevents the browser from reordering them across the boundary.
- Prefer logical alignment for cards and badges. Titles, prices, and status pills should share the reading-start edge in both LTR and RTL; use `text-start` / `text-center` / `text-end` in schemas and markup rather than physical left/right.
- When you add new translations, keep direction-aware keys separate from generic ones. Alignment labels should use "Start" / "Center" / "End" semantics (`direction.start`, `direction.center`, `direction.end`) instead of literal "Left" / "Right" text so they remain correct for RTL locales.

## Motion and interaction feel

Interactions should feel physically responsive without animation dependencies.

- Use easing tokens: `--ease-ui` for snappy UI and `--ease-drawer` for drawers/modals. Never use bare `ease`.
- Add press feedback to interactive controls: `active:scale-[0.97]` or an appropriate scale.
- Prefer asymmetric timing: entrances around 300ms, exits around 200ms.
- Avoid instant DOM removals. Animate out with WAAPI or CSS transitions before removing; animate in with `@starting-style`; crossfade media swaps.
- Prefer interruptible CSS transitions and `@starting-style` over keyframes for UI state changes.
- Stagger grids with small delays, capped at roughly 8 items.
- Gate animation behind `motion-safe:` in markup and `matchMedia('(prefers-reduced-motion: reduce)')` in JS.

## JavaScript

### Component rules

- Use plain custom elements; one component per JS file.
- Register each component with `customElements.define()`.
- Do not introduce JavaScript frameworks, base component classes, refs systems, or declarative event frameworks.
- Scope all DOM reads and listener setup inside `connectedCallback()`.
- Cross-module theme imports use versioned `@theme/*` specifiers from the layout import map. Never use relative `./` or `../` imports between `assets/*.js` modules; relative resolution drops the importing asset's `?v=` cache key.
- Use `AbortController` for listeners or fetches that need cleanup/cancellation.
- Keep template-specific scripts with the templates that use them. Every template using a web component includes the relevant `<script type="module" src="{{ 'file.js' | asset_url }}"></script>`.
- Prefer native HTML/CSS when no DOM listener or command handling is needed.

### Commands

Button-driven interactions use `commandfor`/`command`:

```html
<s-cart id="cart">
  <button commandfor="cart" command="--remove" data-line-key="...">
    ...
  </button>
</s-cart>
```

- `commandfor` references the target element's `id`.
- Custom commands are prefixed with `--`.
- The target receives a `CommandEvent` with `.command` and `.source`.
- Only buttons use commands. `<select>`, `<input>`, and other non-button events use internal listeners in the component.

### Partial-backed updates

For server-backed UI changes, use `@shopify/partial-rendering` rather than introducing a client-side state framework.

Canonical flow:

1. Listen for a command or internal form/control event in `connectedCallback()`.
2. Read data from `event.source.dataset`, form data, or the component DOM.
3. Call Shopify endpoints through URLs derived from Liquid `routes.*` passed via `data-*` attributes.
4. Fetch updated partials with `partials.fetch()`.
5. Apply them with `partials.apply()`, preferably inside `document.startViewTransition()`.
6. Announce meaningful updates with `aria-live` regions.

Use the existing URL-param-driven live form component for forms that update URL params and refresh partials. Use a custom component for non-form interactions or API-backed commands.

## Partial rendering

Partials are inline regions inside templates/layouts:

```liquid
{% partial 'cart-items' %}
  {% for item in cart.items %}
    ...
  {% endfor %}
{% endpartial %}
```

They do not map to files.

- Treat partial names as contracts with JavaScript. If JS fetches `cart-items`, that inline partial name must remain stable.
- A single fetch can request multiple partials: `partials.fetch('cart-items', 'cart-count')`.
- Partials can be declared anywhere in templates/layouts, including captured snippet content.
- Partials can span template/layout boundaries; for example, a layout partial may be refreshed by JavaScript running on a template.
- Add short Liquid comments near non-obvious partial contracts when an agent might otherwise rename or remove them.

## Commerce contracts

- Every native checkout submitter inside `{% form 'cart', cart %}` uses `name="checkout"` (or passes `name: 'checkout'` to the button block). A bare submit button updates the cart instead of signaling checkout.
- Product add-to-cart forms keep `input[name="id"]` as the selected-variant source of truth and synchronize it whenever the variant changes.
- Related and complementary product regions use Shopify recommendations through `routes.product_recommendations_url` or `recommendations.products`, never an arbitrary collection slice.
- Buyer-visible prices use Shopify money filters. Raw numeric conversion is reserved for form values whose platform contract requires a number, such as price-range filter inputs.
- Quantity controls honor `quantity_rule.min`, `.max`, and `.increment`; variant changes resynchronize those values, and cart controls still allow removal to zero. Do not invent an arbitrary maximum when Shopify provides none.

## Translations

- Every user-facing string uses a literal translation key: `{{ 'section.component.label' | t }}`.
- Runtime UI keys live in `locales/en.default.json`; schema labels/options use `locales/en.default.schema.json` with `t:` references.
- Keep translation calls local to where copy is authored and interpolation data is in scope.
- Pass rendered strings or captured content into snippets/blocks, not translation keys.
- Avoid variable translation keys unless genuinely dynamic at runtime.
- Do not reuse the same key variable across multiple `| t` call sites unless those call sites are intentionally coupled.
- Supply interpolation kwargs at the translation call site.
- Do not change the interpolation contract of a shared key. If copy needs new kwargs, create a sibling key and update only the specific call site.
- Rich text translations use `_html` sibling keys. Do not convert a plain key into rich text in place, and do not pipe `_html` translations through `| escape`.

## Documenting intent

Utility classes remove many visible component boundaries, so preserve load-bearing intent with short comments.

- Liquid comments only: `{% comment %} ... {% endcomment %}`. Do not use HTML comments for internal guidance.
- JS comments should be single-line `//` comments.
- Keep comments to 1–2 lines and explain **why**, not what.

Good targets for intent comments:

- LCP hints: `fetchpriority="high"`, `loading="eager"`, first-row grid thresholds.
- Partial rendering contracts coupled to `partials.fetch()` calls.
- Endpoint contracts where `.js` matters for JSON responses, and routes bridging where a `data-*` attribute carries a Liquid `routes.*` value to JS.
- Source-of-truth inputs, such as hidden `input[name="id"]` driving product variant state.
- Non-obvious utility choices that preserve an invariant, such as `inline-flex` to respect parent `text-align`.
- Web component/template coupling that an agent might otherwise simplify away.

Do not comment on current tasks, style preferences, or things already obvious from names.

## Decision guide

| Question | Answer |
|----------|--------|
| Section? | Never. Inline page features in templates and wrap generic regions with `container`, or compose a bespoke region block that owns its own `<section>`. |
| Container wrap vs bespoke region block? | Generic layout region → wrap content in `container`. Merchant-swappable resource region → bespoke region block with equivalent background and padding settings. |
| JSON template? | Never. Code is the source of truth. |
| Block vs snippet? | Merchant-editable visual storefront element → block. Internal utility → snippet. |
| Block vs inline? | Anything a merchant may want to change — copy, media, resources, links → block, even when used once. Structural or decorative markup → write it directly in the template. |
| Where does this copy live? | Its own `text` block invoked by the template. Never markup written directly in the template, never a content param. |
| Where can blocks be composed? | Templates own page usages and each child's settings/arguments; layouts own global shell usages. Never invoke a block from `blocks/*.liquid`: a per-usage edit must not change another authored usage. |
| Merchant may swap this image, product, or collection? | A picker setting on the block that renders it. Never a hardcoded filename or handle. |
| Applying a brand color? | A palette utility (`bg-surface`, `text-accent`) — it tracks the merchant's palette. A block's color setting is their per-region override, and a raw hex belongs only inside that setting, never in markup. |
| Snippet vs inline? | Reused internal utility, or a self-contained region a layout composes → snippet. Otherwise inline. |
| New explicit block param? | Add only if the block acts on it. Otherwise use `attributes`. |
| Theme setting? | Global brand control → `config/settings_schema.json`. Per-component/context-specific control → block setting or code-level kwarg. |
| Web component vs native HTML? | Needs command handling, DOM listeners, or API-backed updates → web component. Otherwise native HTML/CSS. |
| Partial vs static markup? | JS or URL params need to refresh it → partial. Otherwise static. |
| Live form vs custom component? | Form controls drive URL params → existing live form component. Non-form interaction/API command → custom component. |

## Storefront platform components

Shopify storefront web components, such as cart/account platform elements, can replace custom implementations when their feature set is sufficient.
