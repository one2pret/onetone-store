---
target: app/(shop)/page.tsx
total_score: 11
p0_count: 2
p1_count: 2
timestamp: 2026-07-07T08-19-30Z
slug: app-shop-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 1 | No loading states, no stock signals, no slider position indicators |
| 2 | Match System / Real World | 2 | Mostly Indonesian, but "LIMITED!" and "50% OFF" mix English inconsistently |
| 3 | User Control and Freedom | 2 | No category filter/sort on homepage; "Lihat Semua" is the only path forward |
| 4 | Consistency and Standards | 1 | 5 accent colors (blue, violet, emerald, amber, rose) vs spec's 1; `text-slate-*` everywhere instead of design tokens |
| 5 | Error Prevention | 0 | Zero empty-state handling for product arrays — broken layout if DB returns 0 results |
| 6 | Recognition Rather Than Recall | 2 | Featured vs New Arrivals only distinguishable by eyebrow text; visual treatment identical |
| 7 | Flexibility and Efficiency | 1 | No search, no quick filters, no category shortcuts on homepage |
| 8 | Aesthetic and Minimalist Design | 0 | 7 sections, 5 accent colors, 2 gradient banners, 1 bounce animation, 2 duplicate grids |
| 9 | Error Recovery | 0 | No fallback, no skeleton states, no error boundaries |
| 10 | Help and Documentation | 2 | Trust bar provides implicit reassurance; no size guide or FAQ link |
| **Total** | | **11/40** | **Critical — major overhaul required** |

---

## Anti-Patterns Verdict

**Does this look AI-generated? YES — High confidence.**

**LLM Assessment:**
Three absolute bans from DESIGN.md are simultaneously active on this page:
1. **Tiny uppercase eyebrows above section headings** — "PALING DIMINATI" + Flame icon above "Produk Unggulan", "BARU DATANG" + Sparkles icon above "Produk Terbaru". Textbook AI homepage scaffolding.
2. **Identical card grids** — Featured Products (8 cards, 2→4 col) and New Arrivals (4 cards, 2→4 col) are structurally identical: same eyebrow pattern, same `ProductCard` grid, same "Lihat Semua" ghost link. Two sections with zero visual differentiation.
3. **Gradient hero with decorative orbs** — The final CTA (`bg-gradient-to-br from-primary via-primary-hover to-emerald-600`) has two `blur-3xl` white circles as decoration. The Promo Banner also uses `bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900` with two `rounded-full` decorative elements.

Beyond the absolute bans: the **entire page is built on the wrong design system**. DESIGN.md mandates Vault Black `#0A0A0A` body + Warm Paper `#F5F0E8` text + Signature Gold `#C9A84C` as the sole accent. This page runs on `bg-white`, `bg-slate-50`, `bg-slate-900` and five independent accent colors (`text-blue-600`, `text-violet-600`, `text-emerald-600`, `text-amber-600`, `text-rose-600`). The brand doesn't exist on this page.

**Deterministic Scan (Assessment B):**
CLI detector found 1 finding:
- `animate-bounce` (bounce/elastic easing — absolute ban) at `page.tsx` line 136 on the "LIMITED!" badge.

Manual scan confirmed:
- 2 eyebrow instances: lines 74 and 151 of page.tsx
- Widespread `text-slate-*` usage (10+ instances in page.tsx, ProductGallery.tsx, BannerSlider.tsx) instead of design tokens — `ProductCard.tsx` is the only file that correctly uses `text-foreground`, `text-muted-foreground`, `text-primary`
- `backdrop-blur-sm` in BannerSlider on nav arrow buttons — borderline (functional, not decorative)
- No `z-index` arbitrary values, no `100vh`, no numbered section markers, no hardcoded hex

No false positives. All 4 target files read successfully.

**Agreement:** LLM and detector agree on animate-bounce and eyebrows. Detector missed the gradient blobs (Tailwind utilities, no raw CSS rule) and the theme mismatch — those were LLM-only findings.

---

## Overall Impression

The data layer and component architecture are solid (clean Server Component, `Promise.all`, proper Next.js patterns). But visually this reads as a generic light-mode e-commerce homepage — Shopee/Lazada in aesthetic, SaaS landing page in structure — with no trace of the "Concierge Vitrine" dark-gold brand. The single biggest opportunity is to actually apply the design system that was defined in DESIGN.md.

---

## What's Working

1. **Clean data architecture.** `Promise.all` for featured products + new products + banners in a single async Server Component. No waterfalls. Idiomatic Next.js App Router. This is the right foundation.
2. **Responsive bifurcation.** Trust Bar and "Kenapa Belanja" sections genuinely think about two separate device contexts (2-chip mobile vs 4-column desktop for Trust Bar; compact horizontal vs elevated 3-col for features). This isn't lazy `md:flex-row` responsive — it's a real layout rethink per breakpoint.
3. **Indonesian-first copy.** Consistently Indonesian language, Indonesian logistics providers (JNE, SiCepat, J&T), QRIS/e-wallet payment norms. Contextually correct for the target market.

---

## Priority Issues

**[P0] The page is on the wrong design system — entire theme mismatch**
- **Why it matters:** DESIGN.md mandates Vault Black `#0A0A0A` body, Warm Paper `#F5F0E8` text, Signature Gold `#C9A84C` as the single accent, Warm Coal `#2A2520` borders. This page uses a completely different system: light `bg-white`/`bg-slate-50` body, `text-slate-*` at every level, and five independent accent colors none of which match the spec. The brand identity defined in the design system does not exist on this page.
- **Fix:** Rebuild page.tsx against design tokens: `bg-background`, `text-foreground`, `text-muted-foreground`, `text-primary`, `border-border`. Apply the dark theme. Replace every `text-slate-*` with token equivalents. Remove independent color imports.
- **Suggested command:** `/impeccable polish app/(shop)/page.tsx`

**[P0] Three absolute bans active simultaneously: eyebrows + identical grids + gradient blobs**
- **Why it matters:** These three patterns together define the aesthetic as "AI-generated generic e-commerce" — the exact anti-reference from PRODUCT.md. They need to be removed, not toned down.
- **Fix:** Eyebrows → remove "PALING DIMINATI" and "BARU DATANG" kickers. Use the headline directly, or differentiate sections via layout/atmosphere, not labels. Identical grids → make the two product sections visually distinct: different grid density, or replace one with an editorial strip layout. Gradient blobs → replace final CTA with a solid dark section using a Signature Gold accent edge. Replace promo banner with a contained editorial callout strip.
- **Suggested command:** `/impeccable bolder app/(shop)/page.tsx`

**[P1] Promo banner "LIMITED! + animate-bounce + concentric circles" destroys premium positioning**
- **Why it matters:** The mid-page promo section is a Shopee flash-sale aesthetic clone: bounce animation, "50% OFF" concentric circle graphic, "LIMITED!" all-caps English. For a customer who arrived from an Instagram impression of a premium brand, this is brand dissonance that signals "this is just another discount store." Confirmed by detector (animate-bounce, line 136).
- **Fix:** Remove the concentric circle graphic, the `animate-bounce` badge, and the "LIMITED!" copy entirely. If a promotional callout is needed, make it a single line: `"Members get first access — Register for early collection drops."` Flat text, no animation, no graphic.
- **Suggested command:** `/impeccable quieter app/(shop)/page.tsx`

**[P1] No empty-state handling for product arrays**
- **Why it matters:** `getFeaturedProducts(8)` and `getActiveProducts({ limit: 4 })` can return empty arrays. When they do, section headers render with zero product cards — a visually broken layout that would erode trust for any customer who sees it (e.g., during initial setup or a DB issue).
- **Fix:** Add conditional rendering: if `featuredProducts.length === 0`, show a skeleton or a "Segera Hadir" placeholder. Same for `newProducts`.
- **Suggested command:** `/impeccable harden app/(shop)/page.tsx`

**[P2] Trust signals at wrong position in the purchase journey**
- **Why it matters:** Trust signals (free shipping, genuine product, safe payment) are front-loaded in the Trust Bar at the top of the page — but absent at the actual conversion moment (product card). A customer forming purchase intent while browsing a product card has no visible reassurance about returns or delivery at the point of decision.
- **Fix:** Move or duplicate trust signal to a compact strip just above the "Lihat Semua" link, or embed the key signals (`Gratis Retur 7 Hari`, `Ongkir gratis`) inline in ProductCard below the price. The top Trust Bar can stay but should not be the only location.
- **Suggested command:** `/impeccable layout app/(shop)/page.tsx`

---

## Persona Red Flags

**Jordan (First-Timer):** Arrives from a Google link, no brand knowledge. Gets: BannerSlider (content unknown) → Trust Bar chips → immediately 8 product cards. Zero brand introduction. No "who is Onetone" moment. Five accent colors signal "generic marketplace." The Promo Banner ("Daftar Gratis" CTA) interrupts browsing before Jordan has seen enough product to care. Jordan's likely exit: after scrolling 8 products with no stock/size signals. **Task: partial fail.** Jordan can see products but has no basis for trust.

**Casey (Distracted Mobile User):** On 4G, scrolling one-handed. Seven sections = extended scroll distance with near-identical visual rhythm. Two product grids are identical in structure — Casey's eye doesn't register them as separate. The `animate-bounce` "LIMITED!" badge catches peripheral attention (unintentional distraction). Final CTA has two near-equal-weight buttons ("Mulai Belanja" and "Buat Akun Gratis") — which one? Casey skips. **Task: fail.** No single clear CTA; bounce animation creates distraction without conversion payoff.

**Rina (Instagram DM shopper, Android mid-range, first webstore visit):** Taps link expecting the same premium fashion she saw on Instagram. Gets a light-mode page that looks like Shopee. The multicolor Trust Bar icon chips (blue Shield, violet CreditCard) look identical to Shopee's feature badges — reduces rather than builds premium trust. Tries to find the specific product from the story: no search, no category nav on the homepage, only "Lihat Semua" which drops into an unfiltered listing. If the product isn't in Featured 8 or New Arrivals 4, Rina **cannot find it from the homepage at all**. **Task: fail.** Browse-to-product path is broken for non-featured items.

---

## Minor Observations

- `Heart` icon imported from lucide-react (line 9) but never used — dead import.
- Both "Lihat Semua" links go to `/products` — same destination, making the Featured vs New Arrivals distinction meaningless at the nav level.
- `hover:shadow-md` on Trust Bar desktop items contradicts DESIGN.md's "tonal-first" rule (use bg shift on hover, not shadow lift).
- `shadow-lg shadow-primary/25` and `shadow-xl` on CTA buttons — against tonal layering principle.
- `"ribuan fashion lover"` in final CTA is unverified social proof that could damage trust on an MVP store with few real orders.
- Two near-equal CTAs at end ("Mulai Belanja" + "Buat Akun Gratis") dilute both — one primary, one ghost.
- No `aria-label` on icon-only elements.

---

## Questions to Consider

1. **If you removed every section except the BannerSlider and the product grid, would the path to purchase be shorter or longer?** Seven sections currently sit between the banner and checkout. The Concierge Vitrine concept is curation and restraint — what if the homepage were: full-bleed banner, 6-product editorial strip with one sentence of brand voice, single "Explore the Collection" link?

2. **What is the one feeling a customer should leave the homepage with?** "Premium · Confident · Effortless" is the brand personality. The current page creates "complete · informative · reassuring" — a trustworthy marketplace, not a confident boutique. How many of the current 7 sections survive a filter of "does this make Rina feel she's being personally shown something special?"

3. **The Promo Banner is the most conversion-damaging element on the page — what would an editorial replacement look like?** Instead of a flash-sale block, what if it were a "The Look" strip: a single product styled in context, one sentence about the styling, a direct product link? Same registration intent, but brand-building instead of brand-eroding.
