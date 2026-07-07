---
target: app/(shop)/page.tsx
total_score: 21
p0_count: 0
p1_count: 2
timestamp: 2026-07-07T09-52-01Z
slug: app-shop-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Banner slider dots give position; no loading states, no cart-add feedback on homepage, stock badge only shows ≤5 units — 0-stock products invisible until click |
| 2 | Match System / Real World | 3 | Copy is clean Indonesian throughout; "Produk Unggulan" + "Koleksi Terbaru" are intuitive; trust bar + Why section double-states returns/shipping promise |
| 3 | User Control and Freedom | 2 | No category shortcuts on homepage; mobile user trapped in scroll with one exit ("Lihat Semua") |
| 4 | Consistency and Standards | 3 | Token usage is now consistent; minor: empty states use ghost CTA while Member Strip uses primary — same next action, different visual weight |
| 5 | Error Prevention | 2 | Empty states exist now (real improvement); search bar in Navbar is decorative — no handler, no action — actively misleads |
| 6 | Recognition Rather Than Recall | 2 | Sections visually distinct but "what makes Unggulan vs Terbaru different" is buried in 12px muted subtext; no badge carries context independently |
| 7 | Flexibility and Efficiency | 1 | No category chips on homepage, no quick-add to cart, Heart button has no action — zero accelerator path for repeat visitors |
| 8 | Aesthetic and Minimalist Design | 3 | Ban list is clean: no eyebrows, no gradient hero, no bounce, no 5-accent spread; trust bar + Why Choose Us double the same content |
| 9 | Error Recovery | 1 | Empty states exist but are cosmetic holding patterns with no informational recovery; search bar returns no error because it has no handler |
| 10 | Help and Documentation | 2 | Trust bar + Why section = implicit reassurance; no size guide, no FAQ, no contact path; returns policy surfaces twice with no link to details |
| **Total** | | **21/40** | **Acceptable — significant improvement from 11/40; P1 issues remain** |

---

## Anti-Patterns Verdict

**Does this still look AI-generated? Partial — much improved but not yet clean.**

The most obvious AI tells from the previous run are gone: no eyebrows on every section, no gradient promo block with orbs, no five independent accent colors, no animate-bounce. The page is now structurally honest.

Three second-order tells survive:
1. Trust bar + "Why Choose Us" double — same content at two levels of detail, both standard e-commerce template sections.
2. Identical empty states — both product sections use the same icon, same structure, same copy despite the sections being deliberately differentiated.
3. Decorative search bar — a styled input with no handler is a layout placeholder, not a feature.

Absolute-ban sweep: No side-stripe borders. Gold shimmer on brand mark is the one permitted gradient-text exception per DESIGN.md. Glassmorphism on slider nav buttons is purposeful (photo legibility), not decorative. No hero metric. No numbered section scaffolding. No eyebrows.

---

## Overall Impression

The rebuild crossed from Critical (11/40) to Acceptable (21/40) in one pass. The core architectural decisions are now right: dark brand canvas, single gold voice, tonal layering, no marketplace noise. The biggest remaining opportunity is conversion flow: no category shortcuts on mobile, no quick-add, non-functional search, two redundant registration CTAs. The visual foundation is ready; the commerce layer hasn't been built yet.

---

## What's Working

1. **Member Strip as editorial replacement** — restrained, purposeful, one gold CTA, shadow-primary/20 warmth. Closest to the Concierge Vitrine north star.
2. **Tonal section differentiation** — bg-background for Featured vs bg-card for New Arrivals gives scroll a sense of depth without gradient or shadow.
3. **Trust bar icon unification** — all icons now bg-primary/10 text-primary. The unified gold treatment reads as a brand decision.

---

## Priority Issues

**[P1] Decorative search bar is an active trust violation**
- What: Search input in Navbar has no form wrapper, no action, no onSubmit, no router navigation on Enter.
- Why it matters: Users will type, wait, get nothing. Worse than no search.
- Fix: Wire search navigation to /products?q= on submit, OR remove the bar until the feature exists.
- Suggested command: /impeccable harden

**[P1] Trust bar and "Why Choose Us" carry redundant content**
- What: Trust bar (shipping, original guarantee, payment, support) and Why section (update, shipping, returns) overlap heavily. Two sections saying the same thing at different detail levels.
- Why it matters: Reads as generated template — all standard e-commerce sections present. Dilutes the distinctive brand voice.
- Fix: Remove trust bar and let Why section carry full message, OR keep trust bar and replace Why section with an editorial brand statement.
- Suggested command: /impeccable distill

**[P2] Mobile category navigation hidden behind hamburger menu**
- What: Category bar is desktop-only (hidden md:block). Mobile requires 3 taps to browse by category.
- Why it matters: Casey and Rina cannot browse by intent without extra friction.
- Fix: Add horizontally-scrollable category chip row below Navbar on mobile.
- Suggested command: /impeccable adapt

**[P2] Empty states identical across differentiated sections**
- What: Both empty states use same ShoppingBag icon, same structure, nearly identical copy.
- Why it matters: Undermines the section differentiation work. Reads as boilerplate.
- Fix: Different icon + different copy per section (Star/"Belum ada produk pilihan" vs Sparkles/"Koleksi baru segera hadir").
- Suggested command: /impeccable clarify

**[P3] "Lihat Semua" links both point to /products with no filter params**
- What: Featured Lihat Semua should link to /products?featured=true; New Arrivals to /products?sort=newest.
- Why it matters: Promise and destination are misaligned.
- Fix: Wire correct query parameters.
- Suggested command: /impeccable harden

---

## Persona Red Flags

**Jordan (First-Timer):** Tries search bar on desktop — types, presses Enter, nothing happens. Trust broken. Also sees two registration CTAs (Member Strip + final CTA section) while logged out — no escalation, just repetition.

**Casey (Distracted Mobile User):** Product name at text-xs (12px) in 2-col grid on mid-range Android falls below PRODUCT.md's 14px minimum. No visible category shortcut on mobile. Banner dot indicators are 6×6px — far below 44×44px touch target minimum. Cart icon has no label on first visit.

**Rina (Instagram Shopper):** Price text (text-sm bold) visually dominates product name (text-xs medium) on mobile — price-forward hierarchy signals marketplace, not boutique. "Unggulan" and "Sisa 2" badges use identical styling — curation vs scarcity signals indistinguishable at a glance. Tap on product card has no instant visual feedback on mobile (hover:scale only fires on desktop).

---

## Minor Observations

1. bg-red-50 in logout dialog (Navbar line 342) is hardcoded outside design tokens — will render as bright pink-white in dark theme. Replace with bg-destructive/10.
2. animate-gold-shimmer lacks @media (prefers-reduced-motion) fallback in globals.css.
3. ProductCard hover:scale-[1.02] risks card overlap in 4-col grid — consider hover:-translate-y-0.5 instead.
4. BannerSlider fallback (ImageOff on bg-surface) on first visit with no banners = large grey rectangle as first impression. Use branded fallback panel.
5. Member Strip and final CTA both show registration CTAs even to logged-in users — should be conditioned on !user.
6. getActiveProducts({ limit: 4 }) fallback card uses bg-gradient-to-br — replace with flat bg-muted.

---

## Questions to Consider

1. If Trust Bar and Why Choose Us both exist to build confidence, what does the trust bar do that the Why section doesn't? If you can't answer without saying "quick" or "compact," one is redundant.
2. What would this page look like with no product grids? An editorial-only mobile homepage is how Arc'teryx and Lululemon do it. Does "Produk Unggulan" on the homepage add conversion, or just feel expected?
3. The search bar is the most prominent interactive element on desktop and it does nothing. Is it Sprint 2 work or has it been forgotten? A broken feature is worse for trust than a missing one.
