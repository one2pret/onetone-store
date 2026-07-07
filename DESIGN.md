---
name: Onetone Store
description: Premium single-store e-commerce for Indonesian fashion sportswear brand
colors:
  vault-black: "#0A0A0A"
  panel-black: "#141414"
  surface-black: "#1E1E1E"
  studio-black: "#1C1C1C"
  warm-coal: "#2A2520"
  warm-paper: "#F5F0E8"
  weathered-bronze: "#7A7468"
  signature-gold: "#C9A84C"
  signature-gold-hover: "#E0BC6A"
  signature-gold-shadow: "#3D2E0E"
  gilt-shadow: "#1E1A10"
  onetone-red: "#EF4444"
  onetone-green: "#22C55E"
  onetone-amber: "#F59E0B"
typography:
  display:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 4vw + 0.5rem, 2.5rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "normal"
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    letterSpacing: "0.08em"
  mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
    letterSpacing: "0"
rounded:
  sm: "0.5rem"
  md: "0.625rem"
  lg: "0.75rem"
  xl: "0.875rem"
  pill: "9999px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.5rem"
  "2xl": "2rem"
components:
  button-primary:
    backgroundColor: "{colors.signature-gold}"
    textColor: "{colors.vault-black}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "2.25rem"
  button-primary-hover:
    backgroundColor: "{colors.signature-gold-hover}"
    textColor: "{colors.vault-black}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.warm-paper}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "2.25rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.warm-paper}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "2.25rem"
  card:
    backgroundColor: "{colors.panel-black}"
    textColor: "{colors.warm-paper}"
    rounded: "{rounded.lg}"
    padding: "1.5rem"
  card-hover:
    backgroundColor: "{colors.panel-black}"
    textColor: "{colors.warm-paper}"
  input:
    backgroundColor: "{colors.studio-black}"
    textColor: "{colors.warm-paper}"
    rounded: "{rounded.md}"
    padding: "0.25rem 0.75rem"
    height: "2.25rem"
  input-focus:
    backgroundColor: "{colors.studio-black}"
    textColor: "{colors.warm-paper}"
  badge-gold:
    backgroundColor: "{colors.gilt-shadow}"
    textColor: "{colors.signature-gold}"
    rounded: "{rounded.md}"
    padding: "0.125rem 0.5rem"
  badge-neutral:
    backgroundColor: "{colors.studio-black}"
    textColor: "{colors.warm-paper}"
    rounded: "{rounded.md}"
    padding: "0.125rem 0.5rem"
---

# Design System: Onetone Store

## 1. Overview

**Creative North Star: "The Concierge Vitrine"**

Onetone is a **display case, not a market stall**. Everything on screen is arranged the way a flagship boutique arranges a vitrine at midnight: a controlled darkness that lets one product breathe, a signature gold accent that appears only when it means something, and typography that behaves like the tiny plaque under a museum piece — informative, restrained, never shouting.

The system explicitly rejects three temptations. **It is not a marketplace** (Shopee/Tokopedia): no neon badges, no "Flash Sale 90%!", no five-star review clutter, no confetti orange. **It is not a SaaS landing page** (2025 cream / paper / linen with a huge display heading and a testimonial slider): the body is dark, the typography is moderate, no tiny uppercase eyebrow scaffolds every section. **It is not a gradient-orb dashboard** (glass card floating in mesh purple): flat by default, no decorative blur, no cosmetic glassmorphism.

Two personas share the same visual family. **Customer surfaces** (shop, product detail, cart, checkout) lean editorial — product photography as the hero, generous vertical rhythm, one gold accent per screen. **Admin/POS surfaces** (dashboard, cashier, session close) lean functional — dense tables, quick-tap actions, gold reserved for status and primary CTAs. Both breathe the same dark air.

**Key Characteristics:**
- Body-black canvas (`#0A0A0A`), warm off-white ink (`#F5F0E8`) — never mid-gray
- Signature Gold (`#C9A84C`) as the one voice: primary CTA, active state, focus ring, brand accent
- Tonal layering (background → surface → card → popover) instead of shadow-heavy elevation
- Radius base `0.75rem` (12px) — soft but architectural; no full-rounded pills except pass-through utilities
- Geist Sans throughout (Geist Mono for numbers, receipts, order numbers)
- Motion is a response, not a spectacle: hover/focus transitions, one branded `gold-shimmer` for the brand mark

## 2. Colors

A dark palette warmed by paper-tone text and pierced by one gold. Deliberately narrow: three near-blacks form the tonal layers, one warm off-white carries the type, one gold does the work of ten accents in a rainbow palette.

### Primary
- **Signature Gold** (`#C9A84C`): The one accent voice. Primary CTA fill, active-nav indicator, focus ring, brand shimmer, price emphasis on featured products, "utama" badge on the primary product photo. Rare enough that it always means "this matters."
- **Signature Gold Hover** (`#E0BC6A`): Slightly lifted variant on `:hover` of any gold surface. Never a static color — appearing while flat means the interaction never happened.
- **Signature Gold Shadow** (`#3D2E0E`): Deep-gold background tint for very subtle gold-tinted surfaces (e.g. selected filter chip, gold-branded card corner). Nearly black, still on-brand.

### Neutral (the dark tonal ramp)
- **Vault Black** (`#0A0A0A`): The base surface. Body background of every dark-mode page. Also serves as `primary-foreground` — the ink written on top of Signature Gold.
- **Panel Black** (`#141414`): Card and container fills. Sits one step above the body so cards read as physical panels floating on the vault.
- **Studio Black** (`#1C1C1C`): Secondary buttons, muted button backgrounds, form input surfaces. Slightly warmer than Panel Black by intent.
- **Surface Black** (`#1E1E1E`): Sidebar, side panel, cashier cart panel. The "furniture" tone — the parts of the UI you rest against.
- **Warm Coal** (`#2A2520`): Every border, every divider. The single border color of the entire dark theme.
- **Weathered Bronze** (`#7A7468`): Muted/secondary text: metadata, hints, timestamps, placeholder. Warm gray, never cold slate.
- **Warm Paper** (`#F5F0E8`): Primary text on dark. The reason nothing feels clinical.
- **Gilt Shadow** (`#1E1A10`): Dark accent surfaces with a whisper of gold — for gold-badge backgrounds without shouting gold.

### Status
- **Onetone Red** (`#EF4444`): Destructive actions, error states, "out of stock", "expired." Reserved for genuine failure or hazard.
- **Onetone Green** (`#22C55E`): Success (payment received, session cash cocok, order delivered). Never used as primary CTA.
- **Onetone Amber** (`#F59E0B`): Warning, kas selisih lebih/kurang, low-stock signal. Distinct from Signature Gold — amber is warmer, more orange; gold is more chartreuse.

### Named Rules

**The One Voice Rule.** Signature Gold appears on ≤10% of any screen. If a page has a gold primary button, gold price emphasis, and a gold section eyebrow, one of them is wrong. Its rarity is its power.

**The One Border Rule.** Warm Coal (`#2A2520`) is the only border color. No blue borders on inputs, no red borders on error states (use ring / bg tint instead), no "outline" variant with a novel border color. One border, everywhere.

**The Never-Gray Text Rule.** Muted text is Weathered Bronze (`#7A7468`), not a cool slate. If a warm-black background pairs with a cool-gray text, the page reads clinical — the wrong register.

## 3. Typography

**Display Font:** Geist Sans (with `ui-sans-serif, system-ui, sans-serif` fallback)
**Body Font:** Geist Sans (same family, weight & size do the hierarchy work)
**Label/Mono Font:** Geist Mono (with `ui-monospace, monospace` fallback) — order numbers, receipts, tabular data

**Character:** Geist is neo-grotesque with modern-humanist detailing: it renders confidently at 14px in a table and holds up at 3rem as a hero without feeling generic. Single family + weight hierarchy = fewer decisions, cleaner brand.

### Hierarchy
- **Display** (`700`, `clamp(1.5rem, 4vw + 0.5rem, 2.5rem)`, `1.1`, `-0.02em`): Hero titles on landing, big page titles. Bounded ceiling — Onetone doesn't shout. If a display would exceed 2.5rem, rewrite the copy or use headline instead.
- **Headline** (`700`, `1.5rem`, `1.15`, `-0.01em`): Section titles ("Foto Produk", "Rekap Sesi", "Belanja Berdasarkan Kategori"). One per section, not one per subsection.
- **Title** (`600`, `1.125rem`, `1.35`, normal): Card titles, dialog titles, form section labels. Denser than headline; where a table needs a heading.
- **Body** (`400`, `0.875rem`, `1.55`, normal): The default. Product names, description copy, form input text. Line length: 65–75ch on prose.
- **Label** (`600`, `0.6875rem`, `0.08em` tracked): Small caps eyebrow — status pill labels, metric labels ("TOTAL PENJUALAN", "SESI KASIR"). See rule below.
- **Mono** (`500`, `0.75rem`, `0` tracked): Order numbers (`ORD250707A4X2`), receipts, POS transaction IDs. Never for prose.

### Named Rules

**The Sparing Eyebrow Rule.** The 0.6875rem tracked uppercase label is legitimate for **section metric callouts and status pills** — not as a scaffold above every heading. If four sections in a row start with a tiny uppercase label, it's AI grammar, not brand voice. Use headline directly, or a normal-cased title.

**The Balanced Heading Rule.** Every h1/h2/h3 uses `text-wrap: balance`. Long prose (product description, article body) uses `text-wrap: pretty` to reduce orphans.

**The Rupiah Precision Rule.** Currency is rendered with `formatRupiah()` — `Rp 175.000` with a thin space and dot-separated thousands. Never `Rp175000`, never `IDR 175K`, never `Rp 175,000` (comma is decimal in id-ID).

## 4. Elevation

Onetone is **flat by default with tonal layers.** Depth is signaled by moving up the dark ramp (Vault Black → Panel Black → Surface Black), not by drop shadows. This holds the "midnight boutique" atmosphere: everything sits in the same dark air.

Shadows do appear, but rarely and purposefully:
- On **hover** for interactive cards (`shadow-md` lift), signaling "this is a click target"
- On **primary gold CTAs** as a soft glow `shadow-primary/20` — the button feels gold-warm even against dark
- On the **cashier cart footer** — a subtle upward shadow separates the sticky BAYAR bar from the scrolling item list

### Shadow Vocabulary
- **`shadow-sm`** (`0 1px 2px rgba(0,0,0,0.05)`): Default card resting state. Barely there; carries the tonal separation without adding drama.
- **`shadow-md`** (`0 4px 6px -1px rgba(0,0,0,0.1)`): Hover on interactive cards, dropdown menus, dialogs.
- **`shadow-primary/20`** (`0 10px 15px -3px rgba(201,168,76,0.2)`): Gold-warm glow under primary CTA. The only shadow that carries a color.

### Named Rules

**The Tonal-First Rule.** Depth via ramp before shadow. If a card needs to "pop", the answer is to darken the background around it, not to raise its shadow.

**The Never-Neutral-Shadow Rule.** No shadow larger than `shadow-md` on flat surfaces. If a card looks bookmarked, framed, or floating in a modal, the elevation is wrong; use tonal separation and Warm Coal border instead.

## 5. Components

Every component reads **confident restraint**: solid fills, one border color, focus signaled by the gold ring, hover as a small tonal shift. Nothing is decorative. Nothing bounces.

### Buttons
- **Shape:** `rounded-md` (10px) by default — architectural, not pill-y. Pill only for tag-style filter chips.
- **Primary:** Signature Gold fill on Vault Black text (`h-9 px-4 gap-2 text-sm font-medium`). Hover shifts to Signature Gold Hover and adds `shadow-primary/20` glow. Focus ring: 3px `signature-gold/50`.
- **Outline:** Warm Coal border on transparent background, Warm Paper text. Hover fills with `accent` (Gilt Shadow) and shifts text toward Signature Gold.
- **Ghost:** No border, no bg. Hover fills with `accent`. Used inside admin tables and cart quantity steppers.
- **Destructive:** Onetone Red fill, white text. Only for irreversible actions (delete product, remove image, cancel order).

### Chips
- **Category chips** (product listing, POS filter): pill (`rounded-full`), Studio Black bg, Warm Paper text at rest; Signature Gold bg + Vault Black text when active. No border in either state.
- **Status pills** (order badges, session status): rounded-md, tinted background per status color at 10-20% opacity, matching text color at full opacity. Never used as CTA.

### Cards / Containers
- **Corner Style:** `rounded-xl` (14px) for main cards, `rounded-lg` (12px) for compact cards. Never rounded-full or sharp square.
- **Background:** Panel Black on Vault Black canvas; Surface Black for panels (sidebar, cart column).
- **Border:** 1px Warm Coal, always. Even on hover, the border stays — the tonal shift does the work.
- **Shadow:** `shadow-sm` at rest; `shadow-md` on interactive hover. See Elevation.
- **Internal Padding:** `p-5` (20px) desktop, `p-4` (16px) mobile. Card header uses `p-6` for breathing room around the title.

### Inputs / Fields
- **Style:** Studio Black bg (or transparent on outline variant), Warm Coal border, 9-height, `rounded-md`. Text at `text-sm`.
- **Focus:** Border shifts to Signature Gold, 3px ring at `signature-gold/50`. The ring is prominent — accessibility first.
- **Placeholder:** Weathered Bronze; passes 4.5:1 against Studio Black. Never used as the only label.
- **Error:** Border becomes Onetone Red, ring becomes `destructive/20`. Icon inline if warranted; error text below at `text-xs text-destructive`.

### Navigation
- **Admin sidebar (desktop):** Fixed 250px, Surface Black bg, Warm Coal right-border. Nav items: `rounded-lg`, `px-3 py-2.5`, `text-[13px] font-medium`. Active state: Signature Gold fill with Vault Black text + `shadow-md shadow-primary/20`. Inactive: Weathered Bronze on hover to Warm Paper.
- **Admin sidebar (mobile):** Drawer from left (280px), same styles + close button top-right, backdrop `bg-background/80 backdrop-blur-sm`.
- **Customer shop nav:** Sticky top, Vault Black bg, Warm Coal bottom-border. Category links spaced with `gap-6 md:gap-8`, Weathered Bronze at rest → Warm Paper on hover.

### Signature Component: The Gold Shimmer Mark
The brand mark ("Onetone" in the admin sidebar header) uses a gradient shimmer animation on Signature Gold: `linear-gradient(90deg, #C9A84C 0%, #F0D080 40%, #C9A84C 60%, #C9A84C 100%)`, `background-clip: text`, `animation: goldShimmer 3s linear infinite`. **This is the only permitted gradient text in the system** — reserved for the brand mark itself. Under `prefers-reduced-motion`, the animation is paused (static gold).

### Signature Component: The POS Cart Footer
The sticky BAYAR button sits in a footer with an upward-facing subtle shadow (`shadow-[0_-4px_12px_-4px_rgba(0,0,0,0.06)]`) to visually separate it from the scrolling item list above. Total is `text-xl font-bold`; button is full-width `bg-primary text-primary-foreground py-3 text-sm font-bold` with a `shadow-lg shadow-primary/20` glow. This footer never scrolls — it is the anchor of every POS transaction.

## 6. Do's and Don'ts

### Do:
- **Do** use Signature Gold (`#C9A84C`) as the **one** primary accent per screen. Its rarity is the point.
- **Do** carry the tonal ramp (`#0A0A0A` → `#141414` → `#1C1C1C` → `#1E1E1E`) instead of drop shadows for depth.
- **Do** keep body text at Warm Paper (`#F5F0E8`), muted text at Weathered Bronze (`#7A7468`). Both meet 4.5:1 contrast on the dark ramp.
- **Do** format currency via `formatRupiah()`: `Rp 175.000` — thin space + dot-separated thousands.
- **Do** use `unoptimized` prop on `<Image>` for R2-hosted product images. Next.js optimizer fails on external CDN under some conditions; browser can load the WebP directly.
- **Do** set focus rings on all interactive elements (button, input, chip) using Signature Gold at 50% opacity. Keyboard nav is a design surface, not an afterthought.
- **Do** use Geist Mono only for order numbers, receipt lines, and monetary tables — never for prose or headings.
- **Do** respect `prefers-reduced-motion`: the gold shimmer, fadeInUp, and float animations must degrade to static.

### Don't:
- **Don't** make it a **marketplace**. No neon flash-sale badges, no "Terlaris" red banners, no five-star cluster on product cards, no bright orange CTAs. That's Shopee/Tokopedia — the direct anti-reference from PRODUCT.md.
- **Don't** make it a **SaaS-cream landing page**. No warm off-white body background (paper/parchment/linen/bone), no huge display heading with a testimonial slider, no "Trusted by 10,000+" logo strip. That is the saturated AI default of 2025-26 and it does not match Onetone.
- **Don't** ship a **gradient hero with 3D orb/blob**. No mesh gradient (purple/blue), no glassmorphism card floating over blur, no floating brand logos. The only permitted gradient text is the Gold Shimmer brand mark.
- **Don't** use `border-left greater than 1px as a colored stripe` on cards, alerts, or list items. Ever. Use bg tint, leading numbers/icons, or nothing.
- **Don't** stack a `text-[10px] uppercase tracked eyebrow` above every section. That's AI scaffolding. Use it for **status pills and metric labels only**.
- **Don't** number sections as page scaffolding (`01 · Product`, `02 · Cart`) unless it's a real ordered flow. One deliberate numbered sequence is voice; numbered eyebrows everywhere is grammar.
- **Don't** introduce a second border color, second family, or second accent. One border (Warm Coal), one family (Geist), one accent (Signature Gold).
- **Don't** use `gray-500` or cool slate for muted text. It looks clinical on a warm-dark canvas. Use Weathered Bronze (`#7A7468`).
- **Don't** animate layout properties (`width`, `height`, `top`, `left`, `margin`). Animate transform, opacity, background, box-shadow, filter. Layout animation janks on 60Hz Android.
- **Don't** ship display heading > `2.5rem` clamp ceiling. Onetone doesn't shout. If a heading feels small in a mockup, the mockup is too crowded — trim the page, don't scale the type.
