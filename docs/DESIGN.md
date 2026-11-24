# Ledgerline — design rules

Source files:

- `docs/design/industry.css` — the design-system tokens and component classes (source of truth for colors, type, spacing).
- `docs/design/ledgerline-prototype.dc.html` — the clickable prototype. Top half is markup (inline styles show exact sizes and spacing), bottom `<script>` holds the demo data, the dark-theme overrides (`DARK`), dashboard layouts (`LAYOUTS`) and every calculation.

## Look in one paragraph

"Blueprint" industrial: square corners everywhere (radius 0), hairline 1px borders in a translucent ink color, transparent surfaces instead of filled cards, small registration-mark crosses at the four corners of key cards and primary buttons, muted steel-blue accent, condensed headings (Barlow Condensed 600) over a plain body face (Barlow 400/500). Numbers are big and set in the heading face. Dark theme is the default in the prototype.

## Mapping to Tailwind v4 + shadcn

- Fonts: load Barlow (400/500/700) and Barlow Condensed (400/600) with `next/font/google`; expose as `--font-body` and `--font-heading`; add `font-heading` utility.
- In `globals.css`, define the raw tokens from `industry.css` (`--color-bg`, `--color-text`, `--color-accent`, the neutral and accent 100–900 ramps, shadows) under `:root`, and the `DARK` overrides from the prototype script under `.dark`.
- Point shadcn's semantic variables at them:
  - `--background` → `--color-bg`, `--foreground` → `--color-text`
  - `--card` / `--popover` → `--color-bg` (cards are transparent-on-background), `--muted` → `--color-neutral-200`
  - `--primary` → `--color-accent`, `--primary-foreground` → `--color-bg`
  - `--secondary` → transparent with border, `--accent` → `color-mix(in srgb, var(--color-accent) 14%, transparent)`
  - `--border` / `--input` → `--color-divider`, `--ring` → `--color-accent`
  - `--radius: 0rem`
  - chart colors: `--chart-1` accent, `--chart-2` accent-300, `--chart-3` neutral-400…
- Expose the ramps to Tailwind via `@theme inline` so classes like `bg-accent-300`, `text-accent-700`, `bg-neutral-200` work.
- Muted text = `color-mix(in srgb, var(--color-text) 60%, transparent)`; add a `text-muted-ink` utility rather than repeating the mix.

## Components to build once (in `components/ledger/`)

- `BlueprintFrame` — wrapper with the 1px divider border and four corner marks (port `.blueprint` + `.corner` CSS). Props: `as`, `className`, `corners?: boolean`.
- `Segmented` — the joined toggle group (used for Month/Custom, layout A/B/C, theme, base currency, frequency, Form/Keypad). Build on shadcn `ToggleGroup`, selected = accent fill + bg-colored text.
- `Chip` — selectable outlined chip (account / category / sub-category / onboarding pickers).
- `Kicker` — 11px uppercase letter-spaced accent-700 label ("NET WORTH · USD").
- `BigNumber` — heading font, 600, sizes 22/26/28/30/32/52.
- `ProgressBar` — square bar on neutral-200 track; over-budget fills with text color instead of accent.
- `MoneyText` — formats minor units + currency (`$`, `€`, `₹`; INR uses en-IN grouping and 0 decimals; negative sign is U+2212 "−").
- `IconSwitch` — the square track/knob switch used in the drawer and Settings (style shadcn `Switch` to match).

## Layout

- App shell: fixed 232px left sidebar (brand mark + "Ledgerline", primary "New record" button, 8 nav items with 18px stroke icons — use the SVG paths from the prototype `NAV` constant or matching lucide icons, theme toggle, user block), main area scrolls with `32px 40px 96px` padding.
- Floating 56px "+" button bottom-right; toast bottom-center.
- Dashboard grid uses CSS grid-template-areas exactly as in `LAYOUTS` (Overview / Split / Calendar), min width 900px. Below 900px stack cards in a single column (the prototype is desktop-only; this is our addition).
- Drawer: shadcn `Sheet` from the right, `min(480px, 100vw)` wide, header / scroll body / sticky footer.

## Don'ts

- No rounded corners, no filled gray cards, no drop shadows on cards (shadows only on drawer, FAB, toast).
- No new colors outside the tokens. No emoji in UI except the ☀ / ☾ theme label from the prototype.
