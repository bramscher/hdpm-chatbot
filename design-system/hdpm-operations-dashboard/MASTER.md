# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/hdpm-operations-dashboard/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** HDPM Operations Dashboard
**Theme Name:** Desert Noir
**Category:** Internal Operations / Analytics Dashboard
**Stack:** Next.js 16 · React 18 · TypeScript · Tailwind CSS 3.4 · Recharts 3 · shadcn/ui primitives
**Font:** Geist Sans (self-hosted via `geist/font/sans`)

> This file describes the palette and conventions **already in production** in `tailwind.config.ts` and `app/globals.css`. It is a reference, not a redesign — new UI should inherit from these tokens, not introduce new ones.

---

## Global Rules

### Color Palette

All colors are exposed as HSL CSS variables in `app/globals.css` and consumed through Tailwind tokens (`bg-primary`, `text-foreground`, etc.). Always reference the token, not the raw hex.

| Role | CSS Variable | HSL | Approx Hex | Tailwind token |
|------|--------------|-----|------------|----------------|
| Primary (terra rust) | `--primary` / `--ring` | `20 55% 55%` | `#c4804f` | `bg-primary`, `ring` |
| Primary foreground | `--primary-foreground` | `0 0% 100%` | `#ffffff` | `text-primary-foreground` |
| Background (warm off-white) | `--background` | `40 20% 97%` | `#faf8f5` | `bg-background` |
| Foreground (charcoal) | `--foreground` | `270 8% 15%` | `#2d2a33` | `text-foreground` |
| Secondary / muted / accent | `--secondary` | `40 12% 93%` | `#ece9e2` | `bg-secondary` |
| Muted foreground | `--muted-foreground` | `270 5% 55%` | `#8a8591` | `text-muted-foreground` |
| Border / input | `--border` | `40 10% 89%` | `#e3e0da` | `border`, `border-input` |
| Sidebar | `--sidebar` | `260 20% 13%` | `#1e1b24` | `bg-sidebar` |
| Sidebar foreground | `--sidebar-foreground` | `260 10% 75%` | `#bfbac6` | `text-sidebar-foreground` |
| Sidebar accent (terra) | `--sidebar-accent` | `20 55% 55%` | `#c4804f` | `bg-sidebar-accent` |
| Success | `--success` | `152 56% 40%` | `#2da06c` | `text-[hsl(var(--success))]` |
| Warning | `--warning` | `38 92% 50%` | `#f5a623` | `text-[hsl(var(--warning))]` |
| Info | `--info` | `210 90% 56%` | `#2c8af5` | `text-[hsl(var(--info))]` |
| Destructive | `--destructive` | `0 72% 51%` | `#dc2626` | `bg-destructive` |

### Direct Palette Access

`tailwind.config.ts` also exposes full palette scales for direct use when semantic tokens don't fit (charts, sparklines, KPI card accents).

| Palette | Use for | Key shades |
|---------|---------|------------|
| `terra-*` | Brand accents, CTAs, hover highlights, primary sparklines | `terra-500 #d4845a` · `terra-600 #c4704b` (primary) · `terra-700 #a25439` |
| `sand-*` | Page backgrounds, card fills, subtle surfaces | `sand-50 #faf8f5` · `sand-100 #f3f0ea` · `sand-200 #e8e3d9` |
| `charcoal-*` | Text, borders, sidebar, dark UI | `charcoal-500 #756c89` · `charcoal-900 #2d2a33` · `charcoal-950 #1e1b24` (sidebar) |

**KPI dashboard cards** use per-metric accent colors from Tailwind's default palette (red, amber, blue, purple, green, indigo, orange, cyan, teal, emerald, sky, rose, violet) — one per KPI — for quick visual scanning. See `app/dashboard/page.tsx` for the canonical mapping.

### Typography

- **Font family:** Geist Sans (imported via `geist/font/sans` in `app/layout.tsx`) — applied to `<body>` with `GeistSans.className`
- **Do not add new font imports.** Geist is self-hosted and already loaded on every page.
- **Mood:** neutral, technical, efficient — chosen to fit a data-dense ops dashboard
- **Numerals:** use Geist's tabular figures when rendering KPI values and table columns so digits don't jitter on update

**Type scale:** follow Tailwind defaults; the config adds one custom step — `text-2xs` (0.625rem / 0.875 line-height) for dense chip labels.

### Spacing

Standard Tailwind spacing scale. No custom spacing tokens — if you reach for a gap smaller than `gap-1` or bigger than `gap-12`, reconsider.

### Radii

| Token | Value | Usage |
|-------|-------|-------|
| `--radius` | `0.625rem` (10px) | Default surface radius (`rounded-lg`) |
| `rounded-md` | `calc(--radius - 2px)` | Inputs, small buttons |
| `rounded-sm` | `calc(--radius - 4px)` | Chips, inline badges |
| `rounded-2xl` | `1rem` | Large cards, modal panels |
| `rounded-3xl` | `1.5rem` | Hero surfaces, feature cards |

### Shadows

Custom elevation tokens live in `tailwind.config.ts`. Prefer these over Tailwind's default `shadow-*` utilities.

| Token | Value | Usage |
|-------|-------|-------|
| `shadow-card` | `0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)` | Default card resting state |
| `shadow-card-hover` | `0 4px 12px rgba(0,0,0,0.06), 0 12px 32px rgba(0,0,0,0.06)` | Card hover state |
| `shadow-card-active` | `0 0 0 2px hsl(20 55% 55% / 0.2)` | Selected card (terra focus ring) |
| `shadow-sidebar` | `4px 0 24px rgba(0,0,0,0.12)` | Sidebar edge |
| `shadow-inner` | `inset 0 1px 2px rgba(0,0,0,0.06)` | Inset surfaces (inputs, wells) |

### Motion

- **Standard duration:** `duration-200` (200ms) for hover / state changes
- **Preferred easing:** `ease-spring` (`cubic-bezier(0.22, 1, 0.36, 1)`) for enter animations; `ease-out-expo` (`cubic-bezier(0.16, 1, 0.3, 1)`) for panel slides
- **Micro-interactions:** 150–300ms
- **Always** gate non-essential animation behind `@media (prefers-reduced-motion: reduce)`

---

## Component Conventions

These describe patterns already in use. Follow them in new code to stay consistent.

### Cards

```tsx
<div className="rounded-lg bg-card text-card-foreground shadow-card transition-shadow hover:shadow-card-hover cursor-pointer">
  {/* content */}
</div>
```

- Cards use `bg-card` (white), not `bg-background` (off-white), for a subtle lift against the page
- Hover transitions use `shadow-card-hover` — never `transform: scale()` (causes layout shift)
- Selected / active state uses `shadow-card-active` for the terra focus ring

### Buttons

Use shadcn/ui `Button` component (`components/ui/button.tsx`) — variants `default` (terra), `secondary` (sand), `outline`, `ghost`, `destructive`, `link`. Do not roll custom button classes.

### KPI Cards (`/dashboard`)

- Fixed icon badge (colored background, 10×10 padded square, matching KPI accent color)
- Primary metric in large tabular numerals
- Secondary context metric in `text-muted-foreground`
- Sparkline at ~40px height using Recharts `ResponsiveContainer`
- Delta arrow with direction (↑ / ↓), sentiment color (success / destructive / muted), and label
- Data-source tag chip: `live` (success), `mock` (muted), `estimated` (warning)
- Entire card is clickable → drill-down modal or sub-page

### Charts

- Library: **Recharts 3**
- Default chart surface: transparent, inherit card background
- Axis / grid lines: `border` color at 60% opacity
- Year boundary markers: vertical reference line at Jan 1 in `muted-foreground`
- Tooltips: card surface, `shadow-card-hover`, rounded-lg
- Color-map chart series to the KPI's accent color for continuity with the dashboard card

### Tables

- Use shadcn/ui `Table` primitive
- Dense rows (`py-2`), `text-sm`
- Hover row: `hover:bg-secondary/50`
- Sortable columns use a chevron indicator, not icon change
- Large tables paginate at 50 rows; virtualize past 500

### Forms / Inputs

- shadcn/ui `Input`, `Select`, `Textarea`, `Label`, `Form`
- All inputs must have an associated `<Label htmlFor>`
- Focus ring: `ring` (terra) at 2px offset
- Error state: `border-destructive` + `text-destructive` message below input

### Modals / Dialogs

- shadcn/ui `Dialog` — never a custom overlay
- Overlay: `bg-background/80 backdrop-blur-sm`
- Panel: `rounded-2xl`, `shadow-card-hover`, `max-w-lg` default, `max-w-2xl` for forms, `max-w-4xl` for detail views

### Sidebar

- Dark — `bg-sidebar` with `sidebar-gradient` utility class (linear gradient defined in `app/globals.css`)
- Active nav item: `bg-sidebar-accent` (terra) with white foreground
- Section headers: `text-2xs uppercase tracking-wider text-sidebar-muted-foreground`

---

## Page Pattern

This is an **internal operations tool**, not a landing page. Ignore any "hero / CTA / pricing" structure generated by the skill default.

### Standard Page Layout

1. **Page header** — title + optional subtitle + primary action button (right-aligned)
2. **Filter / toolbar row** — search, filters, view toggles; sticky on scroll for long tables
3. **Stat strip** (optional) — 3–6 small KPI tiles above the main content
4. **Main content** — table, grid of cards, chart set, or wizard steps
5. **Empty state** — icon + heading + one-line explanation + CTA to the action that populates the surface
6. **Loading state** — skeleton matching the final layout shape, never a generic spinner

### Density

Prefer **information density** over whitespace. This is a BI tool used by 1–3 operators daily — they want to see more, not less. Default to:

- `gap-4` between cards in grids
- `py-2` rows in tables
- `px-4 py-3` inside cards
- `max-w-screen-2xl` for page content (no narrow reading columns)

---

## Anti-Patterns (Do NOT Use)

- ❌ **Emojis as icons** — Use Lucide React (`lucide-react`, already installed). One icon set, consistent `w-4 h-4` or `w-5 h-5` sizing.
- ❌ **Missing `cursor-pointer`** — Every clickable card, row, or chip needs `cursor-pointer`.
- ❌ **Layout-shifting hovers** — Never `hover:scale-*`. Use shadow, color, or border changes.
- ❌ **Raw hex colors in JSX** — Reference Tailwind tokens (`bg-primary`, `terra-600`) so dark-mode and theme swaps work.
- ❌ **Custom buttons** — Use shadcn/ui `Button` variants, don't invent new ones.
- ❌ **New font imports** — Geist is already loaded. Don't add Inter, Fira, or anything else.
- ❌ **Low contrast text** — Maintain 4.5:1 minimum. `text-muted-foreground` on `bg-background` is the lightest acceptable body text; anything lighter fails WCAG AA.
- ❌ **Instant state changes** — Always transition state (150–300ms).
- ❌ **Invisible focus states** — Keyboard users must see the terra ring.
- ❌ **Ornate decoration** — This is an ops tool. No gradients-on-gradients, no glassmorphism, no background patterns.
- ❌ **Custom spacing tokens** — Stick to the Tailwind scale.
- ❌ **Generic spinner as loading state** — Use skeletons sized like the real content.

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] Uses semantic tokens (`bg-primary`, `text-foreground`), not raw hex
- [ ] Uses shadcn/ui primitives (`Button`, `Card`, `Dialog`, `Input`, `Select`, `Table`) — no custom reinventions
- [ ] All icons are Lucide (no emojis, no mixed icon sets)
- [ ] `cursor-pointer` on every clickable surface
- [ ] Hover states use shadow/color/border — never scale transforms
- [ ] Transitions 150–300ms with `ease-spring` or `ease-out-expo`
- [ ] Focus ring visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected on any non-essential motion
- [ ] Responsive at 768px, 1024px, 1280px, 1536px (primary users are on desktop; mobile ≥375px should still be usable but not beautiful)
- [ ] Loading state = skeleton matching final layout
- [ ] Empty state has heading + explanation + action
- [ ] Tables show at least 50 rows at default viewport, virtualize past 500
- [ ] KPI numbers use tabular figures
- [ ] Chart series color matches the owning KPI's accent color
