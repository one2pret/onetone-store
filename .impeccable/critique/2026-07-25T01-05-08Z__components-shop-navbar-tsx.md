---
target: Header (components/shop/Navbar.tsx)
total_score: 24
p0_count: 1
p1_count: 3
timestamp: 2026-07-25T01-05-08Z
slug: components-shop-navbar-tsx
---
Method: dual-agent (A: general-purpose design-review · B: general-purpose detector)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2/4 | Cart badge (10px text on 18px circle) easy to miss; no loading state for cartCount |
| 2 | Match System / Real World | 4/4 | Bahasa Indonesia labels match brand voice throughout |
| 3 | User Control and Freedom | 3/4 | Click-outside/backdrop close work; no Escape keydown handler anywhere |
| 4 | Consistency and Standards | 2/4 | Two structurally different header layouts silently switched by env flag (dev vs prod diverge) |
| 5 | Error Prevention | 3/4 | Logout confirmation dialog with clear consequence copy |
| 6 | Recognition Rather Than Recall | 2/4 | Wishlist + cart icon-only, no text label; wishlist hidden entirely below `sm` |
| 7 | Flexibility and Efficiency | 3/4 | Desktop avatar hover-expand nice; no mobile equivalent |
| 8 | Aesthetic and Minimalist Design | 2/4 | 2px icon gap violates own spacing scale; 5 concurrent gold surfaces break "One Voice Rule" |
| 9 | Error Recovery | 3/4 | No error state for cartCount fetch, low stakes |
| 10 | Help and Documentation | n/a | Not applicable to a header |
| **Total** | | **24/36** | **Acceptable band — significant improvements needed** |

## Anti-Patterns Verdict

**LLM assessment**: Reads as a generic marketplace-template icon-trio header (wishlist/cart/avatar clustered tight, icon-only) rather than the "Concierge Vitrine" DESIGN.md calls for. The gold-shimmer wordmark is the one authored element; everything else is stock shape. Ironically the *affordance pattern*, not color, is what drags it toward the Shopee/Tokopedia anti-reference — no orange/red used, but the cluster reads as template.

**Deterministic scan**: `detect.mjs --json components/shop/Navbar.tsx` → exit 0, zero findings, clean. No false positives (nothing was flagged). Manual code-level a11y sweep (mechanical, not subjective) found:
- One icon-only button with no `aria-label` (mobile-menu inline search submit button)
- No `aria-expanded`/`aria-haspopup` on any of the three disclosure-toggle buttons (user menu, 2× hamburger)
- No `focus:` / `focus-visible:` classes on any `<button>` or `<Link>` — only on `<input>` elements
- Icon buttons ~40×40px effective touch target (below 44×44 guideline); search-submit buttons ~32×32px
- Several `text-muted-foreground` uses on small text (11px/12px/13px) flagged as contrast-risk, not measured

**Visual overlays**: Not available this run — no live browser tool exposed to the sub-agents; dev server was running but couldn't be driven. Detector + code-read is the evidence base for this critique.

## Overall Impression

The header is legible and on-brand where it matters most (Bahasa Indonesia voice, the signature gold-shimmer wordmark), but the action cluster (wishlist/cart/user) is a generic, cramped icon-trio that violates the design system's own spacing scale and "One Voice Rule" for gold, and — more seriously — the component has two structurally different layouts gated by an env flag that differs between `.env.local` and `.env.production`. Every complaint gathered in this session (dominant search bar) was filed against the branch that isn't what ships to production. Biggest opportunity: resolve which header actually goes live, then fix the icon cluster as one coherent pass (spacing, gold discipline, badge legibility) rather than three separate tweaks.

## What's Working

- Bahasa Indonesia labels ("Masuk", "Keluar", "Akun Saya") match PRODUCT.md's "bicara langsung, tanpa jargon" voice precisely.
- Logout confirmation dialog has clear consequence copy — solid error prevention for an audit-conscious admin persona.
- Gold-shimmer wordmark correctly implements the one signature animated component DESIGN.md names explicitly.
- Menus auto-close on route change — good hygiene against stale dropdowns.

## Priority Issues

**[P0] Env-flag layout divergence between dev and production**
Why it matters: `.env.local` sets `NEXT_PUBLIC_SEARCH_ENABLED=true` (renders the grid/search-bar layout); `.env.production`/`.env.example` leave it unset → defaults `false` (renders the boutique-wordmark layout, no header search at all). These are structurally different headers. The dominant-search-bar complaint that started this critique belongs to the branch that doesn't ship.
Fix: Decide the one canonical layout now. If search isn't backend-ready, delete the `SEARCH_ENABLED=true` branch's search-bar dominance in dev builds or gate it clearly per-environment with a comment, not a silent default.
Suggested command: `/impeccable audit` (scope: Navbar.tsx env branching)

**[P1] Gold "One Voice Rule" violated inside a single header**
Why it matters: DESIGN.md states gold's power is its rarity (≤10% of a screen). This header alone puts gold on the Promo nav link, the shimmer wordmark, the cart badge, the avatar circle fill, and the Daftar CTA — five concurrent gold surfaces, undermining the brand's own central rule.
Fix: Keep gold only on the wordmark shimmer + primary Daftar CTA. Recolor cart badge and avatar circle to neutral tones (Studio Black bg / Warm Paper text). Drop static gold from "Promo"; use a small dot indicator instead.
Suggested command: `/impeccable colorize`

**[P1] Action-icon cluster too tight, no grouping (confirms user complaint)**
Why it matters: `gap-0.5` (2px) is below DESIGN.md's own smallest spacing token (`xs` = 4px). No divider separates "shopping" actions (wishlist, cart) from the "identity" action (avatar) — raises mis-tap risk on touch and hurts scanability for the mobile-first customer persona.
Fix: Bump to `gap-1.5`/`gap-2`; add a `mx-2 h-5 w-px bg-border` divider between cart and the user button.
Suggested command: `/impeccable layout`

**[P1] Cart badge illegible (confirms user complaint)**
Why it matters: `text-[10px]` numerals on an 18px circle is hard to read at a glance on the entry-level Android hardware PRODUCT.md names as the target device — adds a confirm-tap against the "checkout tanpa banyak klik" goal.
Fix: Min 20px diameter, `text-xs`, bold weight, recolor per the gold-rule fix above (neutral or red, not gold).
Suggested command: `/impeccable harden`

**[P2] Wishlist disappears entirely below `sm` breakpoint**
Why it matters: mobile is >80% of customer traffic per PRODUCT.md, and the header has zero wishlist entry point on that device class — a silent scope cut, not a deliberate one.
Fix: Confirm/document mobile wishlist placement elsewhere, or keep a compact icon in the header at all breakpoints.
Suggested command: `/impeccable adapt`

**[P2] No focus-visible ring on any button/Link, only on inputs**
Why it matters: keyboard users get browser-default focus only on the header's ~15 interactive buttons/links; DESIGN.md explicitly calls for a gold focus ring "on all interactive elements."
Fix: Add `focus-visible:ring-2 focus-visible:ring-primary/50` consistently to icon buttons, nav links, and menu items.
Suggested command: `/impeccable harden`

## Persona Red Flags

**Customer (mobile-first >80%, 4G, browsing while scrolling social, Shopee-literate but wants "different")**:
- On the branch actually live in dev (`SEARCH_ENABLED=true`), the search input sits in a fluid `1fr` grid column that can visually dominate the header at mid-width — exactly the original complaint, but on a branch `.env.production` says shouldn't ship. Someone needs to settle which header customers actually get.
- Wishlist vanishing below `sm` blocks that JTBD outright on this persona's primary device.
- The illegible cart badge adds a confirm-tap during a "browsing while scrolling" session — directly opposed to the "checkout tanpa banyak klik" success metric in PRODUCT.md.
- Five simultaneous gold surfaces undercut the stated differentiation goal ("mencari toko yang beda") — visually saturating one accent everywhere is the same move a Shopee-trained eye is used to, weakening the intended contrast.

**Admin/Kasir (HP/tablet, one-tap actions, must not freeze)**:
- The same 2px icon gap that risks mis-taps for customers is equally a one-tap-accuracy risk for an admin holding a phone in front of a waiting customer.
- Reaching Dashboard from mobile requires opening the full hamburger drawer rather than a direct affordance — more taps than the "efisien back-office" promise in PRODUCT.md.

## Minor Observations

- `brightness-0 invert` CSS filter forces the logo white rather than using a purpose-made white logomark asset — technical debt, not a design bug, but worth a real asset pass.
- Boutique branch uses arbitrary non-token spacing (`gap-[2.1rem]`, `gap-[1.875rem]`) instead of DESIGN.md's defined spacing scale.
- Mobile category chips have no active/selected state despite DESIGN.md's chip spec calling for a gold active state on selected filter chips.
- One icon-only button (mobile-menu inline search submit) has no `aria-label` at all — the one true a11y gap found by the detector sweep.

## Questions to Consider

1. Given `.env.local` and `.env.production` disagree on `NEXT_PUBLIC_SEARCH_ENABLED`, has the header that will actually reach a customer ever been reviewed, or has every pass so far targeted a branch that doesn't ship?
2. With gold on the logo, the Promo link, the cart badge, the avatar, and the Daftar button all at once, what does gold still mean here?
3. Was wishlist's disappearance below `sm` a deliberate call (lives elsewhere on mobile) or an incidental breakpoint nobody checked against the 80% mobile traffic split?
