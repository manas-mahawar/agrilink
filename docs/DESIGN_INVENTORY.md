# Design inventory (Phase 0)

What was inspected, what was reused, and the design language the app follows.

## Sources inspected

| Source | Status | Notes |
|---|---|---|
| Claude Design canvas "AgriLink" (`Main.dc.html`, 244 KB) | Inspected | Full interactive reference: every page, copy, tokens, components and flows. |
| `DesignSystem.dc.html` | Inspected | Colour, type, buttons, badges, inputs, order progress, listing card, logo usage. |
| `canvas.json` | Inspected | Two artboards: website (1440 wide, page) and design system. |
| Canvas assets (48 uploads: 45 photos + 3 logo variants) | Reused | Logo variants regenerated from the original upload; byte-identical to the canvas copy (SHA-256 checked). Photos re-cut from the same 45 Unsplash originals at web sizes. |
| An "exported assets folder" | **Not available** | No export folder was attached. The canvas assets above were used instead. |
| The design tool's rendering runtime (`support.js` / `dc-runtime.js`) | Deliberately **not** copied | The app is a real Next.js codebase; the canvas HTML is a reference only. |

## Brand

- **Logo:** official AgriLink logo (A + sun + leaves + field, "AgriLink" wordmark, tagline "Starting local. Scaling smart.").
  - `public/brand/agrilink-logo.png` — header lockup without tagline (tagline is illegible at header size).
  - `public/brand/agrilink-logo-full.png` — full logo with tagline (footer, auth pages).
  - `public/brand/agrilink-mark.png` — emblem only (very narrow phones, favicons, empty states).
  - Always `object-fit: contain`; on dark green it sits on a cream plate (the logo's greens disappear on `#103B28`).
- **Core message:** "Find the buyer before the produce becomes a distress sale."
- **Launch scope:** Patiala, Punjab and nearby towns (Sanaur, Bahadurgarh, Rajpura, Nabha, Samana, Ghanaur, Patran); tomatoes, potatoes, onions first.

## Colour tokens

| Token | Hex | Use |
|---|---|---|
| forest | `#174C32` | primary actions, links, active nav, brand panels |
| forest-deep | `#103B28` | footer, hover, deep panels |
| leaf | `#79A85A` | decoration only — never text |
| eyebrow green | `#3E7A2F` | small uppercase section labels |
| cream | `#F8F7F0` | page ground |
| white | `#FFFFFF` | cards |
| saffron | `#E9AD3B` | accent, focus ring, highlights (dark text on it) |
| ink | `#202820` | body text |
| muted | `#5C665C` | secondary text (darkened from the brief's `#6B756B` so 12–14 px text passes 4.5:1 on cream) |
| line | `#E3E3D8` | card borders |
| line-strong | `#C9D1C4` | input and secondary-button borders |
| sage-wash | `#E7ECE1` | active nav, soft fills |
| saffron-wash | `#FAEBCB` / text `#6F4A05` | pending badges, buyer panels |
| blue-wash | `#E1EAF6` / text `#1C4673` | negotiating / in-transit badges |
| danger | `#B3261E` (text) / `#9B2C1F` (decline button) | errors |

Status badges differ in lightness as well as hue so they read without colour vision.

## Typography

- Headings: **Manrope** 700–800, tight tracking (−0.02 to −0.04 em), `text-wrap: balance`.
- Body / UI: **Inter** 400–600, 15–17 px body, `text-wrap: pretty`.
- Eyebrows: 13 px, 700, uppercase, 0.08 em tracking.
- Prices and quantities: tabular figures.

## Layout and components

- Content width 1240 px, 24 px side gutter; sections 72–120 px vertical rhythm.
- Cards: white, 1 px `#E3E3D8` border, 12 px radius (16 px for large panels), restrained shadow on hover only.
- Buttons: 44 px min height, 8 px radius; primary (forest), secondary (white + border), accent (saffron), ghost, danger; focus ring 3 px saffron, 2 px offset.
- Inputs: 44 px, 8 px radius, `#C6CEC2` border, forest focus ring; errors in `#B3261E` with text messages.
- Badges: pill, 24 px high, 12 px text.
- Listing card: 4:3 photo, verification badge top-left, save (heart) top-right, "Asking" price label, ₹/kg plus ₹/quintal, availability, harvest date, village · distance, farmer name, View.
- Order progress: three-step tracker (Confirmed → In transit → Completed in the canvas; mapped to the new order lifecycle in the app).
- Tooltips for agricultural units ("1 quintal = 100 kg") and mandi terminology.

## Pages in the reference and where they map

| Canvas page | App route |
|---|---|
| Home (hero, marketplace preview, how it works, farmer/buyer benefits, price transparency, trust, final CTAs, footer) | `/` |
| Explore Produce (filters, sort, grid/list, loading and empty states) | `/marketplace` |
| Listing detail (gallery, price, offer form, quality, mandi panel, farmer card, terms, similar) | `/marketplace/[listingId]` |
| — (farmer card only) | `/farmers/[farmerId]` (new) |
| About (hero, why, journey, flow, principles, start local + phases, vision, contact) | `/about` |
| Services (farmer, buyer, supporting services with honest status labels) | `/services` |
| Contact block on About | `/contact` (new page; same email) |
| Log in / Register (photo panel + form card, role choice) | `/login`, `/register`, `/forgot-password`, `/reset-password` |
| Farmer dashboard (overview, listings, offers, orders, new listing) | `/dashboard/farmer`, `/dashboard/listings`, `/dashboard/offers`, `/dashboard/orders` |
| Buyer dashboard (search, saved, offers, orders) | `/dashboard/buyer`, `/dashboard/saved`, `/dashboard/offers`, `/dashboard/orders` |
| Legal (draft privacy + terms) | `/privacy`, `/terms` |
| 404 | `not-found` |
| — | `/dashboard/profile`, `/dashboard/notifications`, `/admin` (new) |

## Content rules carried over

- No invented statistics, testimonials, partnerships or live prices.
- Sample data is labelled as illustrative; mandi references appear only with a source and date — otherwise the panel says "Not connected".
- Verification badges are shown only when a real verification record exists (the app has an admin-set flag; nothing is verified by default).
- Team section was removed from About at the owner's request.
- Contact email: `mahawar.manas@gmail.com`.
