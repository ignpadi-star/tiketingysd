---
name: "Ticketing"
description: "Two-Sided Gatehouse design system for public ticket sales and admin operations."
---

# Ticketing Design System

## Direction

**Two-Sided Gatehouse** separates two jobs:

- **Public:** dark, bold, event-focused, optimized for discovery, purchase, status checks, and gate entry.
- **Admin:** light, dense, operational, optimized for verification, race packs, reports, settings, and check-in.

Keep behavior and data flows unchanged. This document describes visual rules only.

## Product surfaces

| Surface | Mode | Primary job |
|---|---|---|
| Landing | Public dark | Discover events and start purchase |
| Event detail | Public dark | Choose ticket type, quantity, and buyer data |
| Order status | Public dark | Upload proof, view status, download PDF ticket |
| Staff login | Admin light | Authenticate operators |
| Dashboard | Admin light | Monitor sales, orders, attendance, and activity |
| Orders / verification | Admin light | Review proof, ACC, TOLAK, resend e-ticket |
| Race pack | Admin light | Search participants and record collection |
| Gate | Admin light, high contrast | Scan QR or enter ticket ID |
| Settings | Admin light | Configure branding, music, race pack fields, and events |

## Tokens

`Style.html` is source of truth. Components must consume tokens rather than hard-coded colors.

### Shared tokens

```css
--brand: #1d4ed8;
--brand-accent: #f59e0b;
--primary: var(--brand);
--accent: var(--brand-accent);
--font-body: "Source Sans 3", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
--font-display: "Bebas Neue", "Source Sans 3", system-ui, sans-serif;
--font-mono: ui-monospace, Menlo, Consolas, monospace;
--radius: 14px;
--radius-sm: 10px;
--radius-xs: 8px;
```

### Public palette

| Token | Value | Use |
|---|---:|---|
| `--bg` | `#020617` | Page background |
| `--surface` | `#0d1424` | Cards and panels |
| `--surface-2` | `#111a2c` | Nested surfaces |
| `--surface-3` | `#1a2438` | Elevated controls |
| `--line` | `#243149` | Borders and dividers |
| `--line-strong` | `#334155` | Strong borders |
| `--ink` | `#e6edf7` | Main text |
| `--muted` | `#94a3b8` | Secondary text |
| `--primary` | `#2563eb` | CTA and active state |
| `--accent` | `#f59e0b` | Amber emphasis and focus |

Public status colors use dark backgrounds with light text. Ticket cards remain white for QR and print legibility.

### Admin palette

| Token | Value | Use |
|---|---:|---|
| `--bg` | `#eef1f7` | Workspace background |
| `--surface` | `#ffffff` | Cards and fields |
| `--surface-2` | `#f8fafc` | Secondary panels |
| `--surface-3` | `#e8edf7` | Secondary controls |
| `--ink` | `#0b1220` | Main text |
| `--muted` | `#5b6b82` | Secondary text |
| `--line` | `#dfe5ef` | Borders and dividers |
| `--line-strong` | `#c3cddd` | Strong borders |
| `--primary` | `#1d4ed8` | Brand and actions |
| `--accent` | `#f59e0b` | Active nav underline and emphasis |
| `--top-bg` | `#0b1220` | Admin header |

### Semantic colors

- **Success:** green for accepted orders, valid scans, and completed actions.
- **Error:** red for rejected orders, invalid scans, and destructive actions.
- **Warning:** amber for pending or already-used states.
- **Info:** blue for guidance and verification notices.

Every semantic color needs text. Never use color as the only status signal.

### Runtime branding

Settings may override `warna_utama`, `warna_aksen`, and `warna_latar`. The first two accept a hex color (`#RRGGBB`) or a safe two-color linear gradient (`linear-gradient(<angle>deg, #RRGGBB, #RRGGBB)`); `warna_latar` accepts a hex color.

`applyColors()` applies the values and sets both modern tokens and compatibility aliases:

- `--brand` and `--primary` hold the solid fallback color.
- `--brand-accent` and `--accent` hold the solid accent fallback.
- `--brand-paint` and `--accent-paint` hold the actual paint, solid or gradient.
- `--brand-hover` and `--brand-hover-filter` handle gradient hover states.

Public buttons use `--brand-paint`. The gate pass and public brand mark use `--accent-paint`. Gradients apply only to public pages; admin stays on solid brand colors. Missing settings use safe defaults from `BOOT` or the default token values.

The whole public page follows the selected palette. `warna_latar` sets the base page background, while `applyColors()` tints `--surface`, `--surface-2`, `--surface-3`, `--line`, `--line-strong`, `--input-bg`, `--row-alt`, `--chip-bg`, and `--top-bg` from the primary color and the selected background. Buttons use the same primary paint, so button color and page theme stay in sync.

Settings offers preset palettes (Gatehouse, Indigo, Emerald, Rose, Ocean, Violet) and gradient presets (Sunset, Aurora, Forest), plus custom start/end colors and angle.

## Typography

- **Body and UI:** Source Sans 3.
- **Public display headings:** Bebas Neue through `.display` only.
- **IDs and machine data:** `--font-mono` through `.mono`.
- **Public display headings:** tight line-height, large scale, normal weight, no forced uppercase transform.
- **Admin headings:** compact Source Sans 3 hierarchy for scanning dense workspaces.
- **Body measure:** keep prose near 65–75 characters per line where practical.
- **Headings:** use `text-wrap: balance` for major headings.

Use `.mono` for ticket IDs, order IDs, usernames, QR text, and other machine-generated values.

## Layout

- `.wrap` is full width with centered max width and horizontal padding.
- Public content uses a dark canvas and large visual blocks.
- Admin content uses dense cards, grids, tables, and a dark header.
- Dashboard stats use `.dash-stats` and a six-column desktop grid.
- Race pack stats use auto-fit columns, not dashboard-specific columns.
- Public event posters use a 4:3 mobile ratio.
- Forms collapse to one column on narrow screens.
- No horizontal overflow at 390px, 768px, or 1440px.
- Footer participates in flex layout and stays at viewport bottom on short pages.

## Header and navigation

- Public header is near-opaque `#020617`.
- Admin header is `#0b1220`.
- Active admin navigation uses an amber underline.
- Staff login link does not appear on public pages.
- Mobile menus use SVG open and close icons.
- Burger buttons expose `aria-expanded` and retain visible focus.
- `Muat Ulang` remains visible for every role where refresh is available.

## Components

### Buttons

- Minimum touch target: 44px.
- Primary actions use `var(--primary)`.
- Secondary actions use surface-3 and line tokens.
- Success, danger, and warning variants are semantic only.
- Inline order actions wrap with flex and never force one button full width.
- PDF download labels must remain explicit: `Unduh Tiket (PDF)`.

### Cards

- Public cards use dark surfaces, subtle borders, and restrained shadows.
- Admin cards use white surfaces, cool borders, and compact padding.
- Avoid decorative colored left borders on admin stat cards.
- Use soft blur shadows with offset. Never use hard offset shadows as decoration.

### Inputs

- Use white admin fields and dark public fields.
- Focus uses `--focus` and `--input-ring`.
- Labels remain visible and descriptive.
- Gate manual input placeholder: `Ketik atau tempel ID di sini`.
- Keep validation text near its field.

### Status chips and alerts

Use text plus semantic styling:

- `chip ok`: accepted or complete.
- `chip bad`: rejected or invalid.
- `chip warn`: pending, already used, or caution.
- `chip info`: informational state.

On public dark surfaces, use dark semantic backgrounds and light foreground text.

### Ticket cards

- Keep ticket cards white.
- Preserve QR contrast and printable structure.
- Show one row per ticket.
- Preserve PDF download behavior.
- Keep ticket IDs monospaced.
- Never replace ticket download with an image-only download.

### Gate

- Gate header shows event name and `Check-in · date | location`.
- Gate result uses large, high-contrast state text.
- Support camera QR scanning, photo scanning, and manual ticket or purchase IDs.
- Show scan result text, not color alone.

### Race pack

- Show one row per ticket.
- `DITERIMA` applies only to race pack collection state.
- Preserve configurable `racepack_fields`.
- Respect per-event `Events.racepack_aktif`.
- Search by participant name or email.
- Staff may help with race packs, resend tickets, and download tickets.
- Staff must not see ACC, TOLAK, or Hapus actions.

### Attendance

- Show verified participant names.
- Provide preview before printing.
- Use column checkboxes to control visible fields.
- Keep print output readable and table borders explicit.

### Modal

- Use a dark overlay and white or themed surface.
- Close control is an SVG icon with a 44px target.
- Keep heading clear of close control with adequate right padding.
- Preserve keyboard and outside-click behavior where already supported.

### Background music

- Super Admin may upload landing music and set loop behavior.
- Autoplay remains enabled when configured.
- No visible play/pause control or track label appears on public landing.
- Browser autoplay blocking is expected; retry on user interaction.

## Motion

Motion communicates entry and state, not decoration:

- Page views use `view-enter`.
- Hero content rises into place.
- Event cards may stagger on entry.
- Gate pass uses a soft entrance animation.
- Gate results use a short state-pop animation.
- Do not animate dashboard stat cards as a repeated pop effect.
- Respect `prefers-reduced-motion`.

## Accessibility

- Keep body and placeholder contrast at least 4.5:1.
- Keep large text contrast at least 3:1.
- Use visible `:focus-visible` rings.
- Keep interactive targets at least 44px.
- Use real headings and descriptive labels.
- Keep SVG icons decorative when adjacent text already names action.
- Pair every status color with text.
- Preserve keyboard access to menus, modals, forms, and gate actions.

## Responsive checks

Validate at minimum:

- 390px: mobile public, mobile admin, open menu, gate input.
- 768px: tablet forms, charts, cards, and navigation.
- 1440px: public hero, admin dense workspace, tables, and modals.

Check both visual overflow and `document.documentElement.scrollWidth`.

## Print rules

- Hide headers, navigation, controls, toasts, and modal close buttons.
- Keep ticket cards white with strong QR contrast.
- Avoid page breaks inside individual tickets.
- Keep attendance tables bordered and legible.
- Preserve PDF generation as the ticket download path.

## Do

- Use `var(--brand)`, `var(--brand-accent)`, `var(--primary)`, and `var(--accent)` through tokens.
- Keep public dark and bold.
- Keep admin light and dense.
- Use Bebas Neue only for public display headings.
- Use Source Sans 3 for body and admin UI.
- Use monospaced type for IDs.
- Keep semantic status styling contextual.
- Test at 390px, 768px, and 1440px.
- Use test data for E2E checks only.

## Do not

- Do not restore old light public styling.
- Do not add staff login links to public pages.
- Do not use headings as decorative eyebrow labels.
- Do not add hard offset shadows, colored stat borders, or decorative accent bars.
- Do not use Unicode burger, close, or action icons when SVG exists.
- Do not hide `Muat Ulang` from any role.
- Do not treat `DITERIMA` as a general order status in race pack UI.
- Do not collapse bundled tickets into one race pack row.
- Do not alter Google Apps Script routes, roles, PDF, QR, exports, music, or bundling behavior during visual work.
- Do not run E2E against production data.
