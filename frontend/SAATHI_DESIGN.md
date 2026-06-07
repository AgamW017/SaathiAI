# SaathiAI — Design System Reference
> Warm earth at golden hour — cream canvas, forest-deep trust, one flame for action.

**Theme:** light  
**Built from:** Workable (structure, palette, human warmth) × Harvest (energy, typography rhythm, tactile depth)  
**Serves:** 4 surfaces × 4 user personas × 52 screens × Hindi + English bilingual rendering

---

## Design Philosophy

SaathiAI is not a startup product. It is a trusted system for rural India — for Ramu who just graduated an ITI and holds a phone with 2G and 4% battery, for the placement officer buried in WhatsApp messages, for the MSME owner who doesn't trust paper certificates, for the district officer who has never seen a placement dashboard. 

Every design decision answers one question: **does this feel like a trusted elder sibling who has already navigated the path?**

- **Warm, never sterile.** Cream over white. Off-black over pure black. Shadows tinted, not cold.  
- **Human, never corporate.** People photography, rounded shapes, generous breathing room.  
- **Confident, never loud.** One action color. Two semantic accent groups. The rest is texture and hierarchy.  
- **Bilingual by default.** Every type decision is tested in Devanagari. Line heights and letter spacing are set for Hindi legibility, not just Latin.

---

## Tokens — Colors

| Name | Hex | Token | Role |
|------|-----|-------|------|
| Cream Canvas | `#fff8f1` | `--color-cream-canvas` | Primary page background across all surfaces. Harvest-derived warm off-white — the signature that separates SaathiAI from sterile government portals |
| Saathi Teal | `#004038` | `--color-saathi-teal` | Brand primary. Deep forest-green derived from Workable's Forest Teal. Headings, key borders, outlined buttons, verified badges, trust signals — the color of growth and reliability |
| Deep Moss | `#00544c` | `--color-deep-moss` | Secondary brand tone — hover states, teal section accents, divider lines, tag strokes — one step lighter than Saathi Teal for layering |
| Action Flame | `#fa5d00` | `--color-action-flame` | Primary CTA color from Harvest. Used exclusively for the single primary action per screen: "Apply", "Confirm Placement", "Generate Report". The only warm accent against the cool teal system |
| Ink Black | `#0f161e` | `--color-ink-black` | Primary text everywhere — Workable's deep near-black. All headings, body copy, nav links |
| Graphite | `#333942` | `--color-graphite` | Secondary text, muted body copy, input labels |
| Warm Stone | `#615f5c` | `--color-warm-stone` | Tertiary body text, helper copy, metadata labels — Harvest-derived for warmth over neutral gray |
| Pure White | `#ffffff` | `--color-pure-white` | Card surfaces, input fields, product screenshot backgrounds, modal overlays |
| Bone | `#c0bbb6` | `--color-bone` | Input borders at rest, card outlines, hairline dividers |
| Mist | `#d9d9d9` | `--color-mist` | Subtle dividers, table row borders, secondary separators |
| Parchment Glow | `#fee3b5` | `--color-parchment-glow` | Warm highlight wash — used as notification badge backgrounds, in-progress state fills, warm card tints |
| Apricot Wash | `#fde8ce` | `--color-apricot-wash` | Card background variant — Workable-derived pastel for feature blocks, skill card highlights, tag backgrounds |
| Sky Tile | `#bee9f4` | `--color-sky-tile` | Cool card surface for information/data widgets and government data panels |

### Semantic Status Colors
*(Specified by SaathiAI features.md — mandatory system-wide)*

| Name | Hex | Token | Role |
|------|-----|-------|------|
| Success Green | `#16a34a` | `--color-success` | Placed learners, verified credentials, completed states, green checkmarks |
| Success Surface | `#dcfce7` | `--color-success-surface` | Background tint for success states and placed-learner rows |
| Risk Red | `#dc2626` | `--color-risk` | At-risk learners, unverified employers, urgent action flags |
| Risk Surface | `#fee2e2` | `--color-risk-surface` | Background tint for at-risk states |
| Caution Amber | `#d97706` | `--color-caution` | In-progress, follow-up needed, pending verification |
| Caution Surface | `#fef3c7` | `--color-caution-surface` | Background tint for amber/pending states |
| Info Blue | `#2563eb` | `--color-info` | Government DPI integrations, data points, policy information |
| Info Surface | `#dbeafe` | `--color-info-surface` | Background tint for informational contexts |

---

## Tokens — Typography

### Typeface Decisions

**Why this pairing:**  
SaathiAI features.md calls for an "authoritative display font for dashboard headers and KPI numbers" and a "highly legible body font for Hindi text rendering." The system uses two families, each with a precise role boundary.

---

### Proxima Nova — Display and heading typeface
`--font-display`  
**Substitute:** Montserrat (free), or DM Sans for a slightly softer feel

- **Weights:** 400, 700
- **Sizes:** 16, 18, 20, 24, 32, 48, 56, 72px
- **Line height:** 1.13–1.50
- **Letter spacing:** 0 (none — the geometric humanist character reads clearly without forced tracking)
- **Role:** All headings (H1–H4), hero display copy, KPI numbers on the officer dashboard and district console, CTA button labels, badge labels. Weight 700 at 48–72px creates the "confident, not bureaucratic" voice. Used for both English and Hindi headings.
- **Hindi rendering note:** Proxima Nova's Latin metrics work adequately for Devanagari headings. Always set `line-height: 1.5` minimum for Hindi headings regardless of size, to prevent akshara clipping.

---

### Inter — Body and UI workhorse
`--font-body`  
**Substitute:** Noto Sans (preferred for Hindi), or system-ui

- **Weights:** 400, 500, 600
- **Sizes:** 13, 14, 16, 18, 20px
- **Line height:** 1.50–1.75 (1.75 minimum for Hindi body text)
- **Letter spacing:** -0.01em for Latin; 0em for Devanagari
- **OpenType features:** `"lnum", "tnum"` on all numeric display
- **Role:** All body text, navigation labels, table cells, form inputs, captions, WhatsApp message simulation bubbles, card descriptions. For Hindi body text at 14–16px, set `letter-spacing: 0.01em` and `line-height: 1.75` — Devanagari needs more vertical breathing room than Latin.

---

### Type Scale

| Role | Size | Line Height (Latin) | Line Height (Hindi) | Token |
|------|------|---------------------|---------------------|-------|
| caption | 13px | 1.35 | 1.60 | `--text-caption` |
| body-sm | 14px | 1.50 | 1.75 | `--text-body-sm` |
| body | 16px | 1.50 | 1.75 | `--text-body` |
| body-lg | 18px | 1.50 | 1.70 | `--text-body-lg` |
| subheading | 20px | 1.38 | 1.60 | `--text-subheading` |
| heading-sm | 24px | 1.30 | 1.50 | `--text-heading-sm` |
| heading | 32px | 1.25 | 1.45 | `--text-heading` |
| heading-lg | 48px | 1.15 | 1.40 | `--text-heading-lg` |
| display | 56px | 1.14 | 1.35 | `--text-display` |
| display-lg | 72px | 1.13 | 1.30 | `--text-display-lg` |

---

## Tokens — Spacing & Shapes

**Base unit:** 8px (Workable's base — more generous than Harvest's 4px, better for touch targets on Android)  
**Density:** comfortable  
**Touch targets:** All interactive elements ≥ 44×44px (WCAG, mandatory per features.md)

### Spacing Scale

| Name | Value | Token |
|------|-------|-------|
| 4 | 4px | `--spacing-4` |
| 8 | 8px | `--spacing-8` |
| 12 | 12px | `--spacing-12` |
| 16 | 16px | `--spacing-16` |
| 20 | 20px | `--spacing-20` |
| 24 | 24px | `--spacing-24` |
| 32 | 32px | `--spacing-32` |
| 40 | 40px | `--spacing-40` |
| 48 | 48px | `--spacing-48` |
| 64 | 64px | `--spacing-64` |
| 80 | 80px | `--spacing-80` |
| 96 | 96px | `--spacing-96` |
| 104 | 104px | `--spacing-104` |

### Border Radius

| Element | Value | Rationale |
|---------|-------|-----------|
| buttons | 16px | Harvest-derived tactile softness — warm, not sharp |
| cards | 16px | Consistent with button radius; "ceramic tile" feel from Workable |
| inputs | 16px | Soft and approachable for form-heavy onboarding flows |
| badges / tags | 999px | Full pill for status chips, category labels, skill badge pills |
| avatars | 999px | Circular for learner/officer profile photos |
| modals | 20px | Slightly larger than cards for visual hierarchy |
| WhatsApp bubbles | 16px (outgoing) / 16px (incoming) | Native WhatsApp-like rendering |
| skill cards (web) | 20px | Slightly more generous — the public-facing trust artifact |

### Shadows

| Name | Value | Token | Use |
|------|-------|-------|-----|
| card | `rgba(0, 0, 0, 0.07) 0px 2px 8px 0px` | `--shadow-card` | Standard card elevation |
| card-warm | `rgba(250, 93, 0, 0.10) 0px 4px 16px 0px` | `--shadow-card-warm` | Hover state for action cards, CTA sections |
| card-teal | `rgba(0, 64, 56, 0.10) 0px 4px 16px 0px` | `--shadow-card-teal` | Hover state for teal-bordered elements |
| modal | `rgba(0, 0, 0, 0.15) 0px 8px 32px 0px` | `--shadow-modal` | Modals and floating panels |
| sm | `rgba(0, 0, 0, 0.10) 0px 1px 4px 0px` | `--shadow-sm` | Subtle lift for chips and badges |

### Layout

- **Page max-width:** 1200px (all surfaces)
- **Dashboard max-width:** 1440px (District Console — data-dense)
- **Section gap:** 64px
- **Card padding:** 24–32px (24px mobile, 32px desktop)
- **Element gap:** 8–16px

---

## Components

### Primary Action Button — Flame Fill
**Role:** The single most important action per screen or section. One per viewport maximum.

Fill: `#fa5d00`. Text: `#ffffff`, Inter 600 at 16px. Padding: 12px 24px. Border-radius: 16px. Shadow: `--shadow-sm` at rest; `--shadow-card-warm` on hover. Hover: darken fill ~8% (`#e05300`). Min touch target: 44×44px. Used for: "Apply", "Confirm Placement", "Generate Report", "Activate Cohort", "Send Match".

### Secondary Brand Button — Teal Outline
**Role:** Secondary action with brand trust signal. Appears alongside Primary button or standalone when the action is confirmatory rather than initiating.

Transparent fill. Border: 1.5px solid `#004038`. Text: `#004038`, Inter 600 at 16px. Padding: 11px 23px (1px inset for border). Border-radius: 16px. Hover: `#004038` fill with white text. Used for: "Request Demo", "View Profile", "Download Report", "Add Employer".

### Ghost Text Link
**Role:** Tertiary action — inline navigation, "Learn more", cancel/back actions.

No background, no border. Text: `#004038`, Inter 500 at 16px, with → suffix on forward-navigation links. Underline on hover. Used inline with primary/secondary buttons at 24px gap.

### Status Badge / Chip
**Role:** Learner status, verification state, match type, urgency flag.

Pill shape (999px radius). Inter 600 at 13px, uppercase, letter-spacing 0.05em. Padding: 4px 12px. Colors map to semantic system:
- **Placed:** `#dcfce7` bg / `#16a34a` text
- **At-Risk:** `#fee2e2` bg / `#dc2626` text
- **Pending:** `#fef3c7` bg / `#d97706` text
- **Verified:** `#dbeafe` bg / `#2563eb` text (for government/DigiLocker verified)
- **Category (trade):** `#fde8ce` bg / `#004038` text

### Feature Card / Learner Card
**Role:** The primary unit of information display across Officer Dashboard, Employer Portal, and District Console.

Fill: `#ffffff`. Border-radius: 16px. Padding: 24px. Shadow: `--shadow-card`. Left-border accent (4px) in semantic color for status context (green=placed, red=at-risk, amber=pending). On hover: `--shadow-card-teal`. Heading: Proxima Nova 700 at 20px `#0f161e`. Body: Inter 400 at 16px `#333942`. Bottom: status badge + action link.

### Skill Card (Web — Public)
**Role:** The public-facing credential artifact shared with MSME employers via WhatsApp link. The most critical external-facing design element.

Fill: `#ffffff`. Border-radius: 20px. Max-width: 400px (mobile-first). Shadow: `--shadow-modal`. Header: `#004038` band with learner name in Proxima Nova 700 white at 24px. Video hero (16:9, 16px radius). Verified badge strip: `#dcfce7` with DigiLocker and NSQF logos. Skills as pill chips in `#fde8ce`/`#004038`. Trainer endorsement at bottom with avatar. CTA: flame-fill "Express Interest" button. Must load in <2s on 3G — no heavy assets.

### KPI / Stat Card (Dashboard)
**Role:** Key metric display on Officer Dashboard and District Console.

Fill: `#ffffff`. Border-radius: 16px. Padding: 24px. Number: Proxima Nova 700 at 48px `#0f161e`. Label: Inter 500 at 14px uppercase `#615f5c`, letter-spacing 0.08em. Delta indicator: Inter 600 at 14px in semantic green/red. Optional trend sparkline.

### Navigation Bar — Desktop
**Role:** Sticky top nav for web surfaces (Officer Dashboard, District Console).

Background: `#fff8f1`. Height: 64px. Border-bottom: 1px `#d9d9d9`. Logo: Saathi wordmark + teal mark left-aligned. Nav links: Inter 500 16px `#0f161e` center. Right: Ghost "Sign in" + Teal Outline "Help" + Flame "Take Action" (context-sensitive label). 

### Navigation Bar — Mobile / PWA
**Role:** Bottom navigation for mobile PWA surfaces.

Background: `#ffffff`. Height: 60px. Shadow: `rgba(0,0,0,0.08) 0px -1px 0px`. 4 or 5 icon+label tabs, Inter 500 12px `#333942`. Active tab: `#004038` icon + label. Touch target: 44px minimum per tab.

### WhatsApp Message Bubble — AI (SaathiAI)
**Role:** Distinguishes SaathiAI messages from standard WhatsApp grey bubbles.

Background: `#e8f5f0` (a soft teal-tinted green, feels native but distinctly "AI"). Text: Inter 400 16px `#0f161e`. Border-radius: 16px (full, not the WhatsApp asymmetric style). Left-aligned. A small "Saathi 🤝" label above first message in thread in Inter 600 12px `#004038`. Voice note player: progress bar in `#004038`, play button in `#fa5d00`.

### WhatsApp Message Bubble — Learner
**Role:** Learner outgoing messages.

Background: `#dcfce7` (soft green — lighter than WhatsApp's default to maintain the warm system). Text: Inter 400 16px `#0f161e`. Right-aligned. Standard bubble geometry.

### WhatsApp CTA Button (in-chat)
**Role:** Action buttons embedded within WhatsApp conversation cards (e.g., "SaathiAI से बात करें", "Apply for Job 1").

Background: `#004038`. Text: `#ffffff`, Inter 600 15px. Padding: 10px 20px. Border-radius: 8px (slightly more contained than standalone buttons — fits WhatsApp's native feel). Full-width within card. Max 2 buttons per card.

### Section Heading (Eyebrow + Title)
**Role:** Reusable section opener for landing/onboarding screens.

Eyebrow: Inter 600 13px uppercase `#fa5d00`, letter-spacing 0.08em (e.g., "PLACEMENT MATCHING"). Title: Proxima Nova 700 at 48px `#0f161e`, centered or left-aligned. Subtitle: Inter 400 18px `#615f5c`, max-width 640px.

### Priority Action Row (Officer Dashboard)
**Role:** Inbox-style actionable item — officer sees learner name, risk reason, and 1–2 action buttons in a compact row.

Background: `#ffffff`. Border-left: 4px solid `--color-risk` or `--color-caution`. Padding: 16px 20px. Learner name: Inter 600 16px `#0f161e`. Risk note: Inter 400 14px `#333942`. Action buttons: Teal Outline (small, 12px 16px padding) + Ghost link. Row hover: `#fff8f1` tint.

### Data Visualization Card (District Console)
**Role:** Container for charts, maps, and heatmaps.

Fill: `#ffffff`. Border-radius: 16px. Padding: 24px. Title: Inter 600 16px `#0f161e`. Chart legend: 4-color max, using semantic colors + `#004038` + `#fa5d00` as the two primary charted series. No 10-color legends (per features.md requirement). Background: alternating `#ffffff` and `#fff8f1` for multi-card grids.

### Toast / Alert Notification
**Role:** System-level feedback (placement confirmed, report generated, match sent).

Pill-shaped, 999px radius. Padding: 12px 20px. Shadow: `--shadow-modal`. Success: `#dcfce7` / `#16a34a`. Error: `#fee2e2` / `#dc2626`. Info: `#dbeafe` / `#2563eb`. Icon (20px) + Inter 500 14px text. Auto-dismiss 4s. Max-width: 360px.

---

## Surface-Specific Guidance

### Surface 1 — SaathiAI Companion (WhatsApp + PWA)
The WhatsApp simulation must feel native. No chrome that breaks the chat metaphor. The teal-tinted AI bubble (`#e8f5f0`) is the only brand signal within conversation threads. The PWA uses the full design system. All Hindi text in voice onboarding flow: minimum 16px body, minimum 1.75 line-height, Inter 400.

### Surface 2 — Saathi Officer Dashboard (PWA)
High information density is acceptable here — officers are power users. Use the 1200px max-width layout with a fixed sidebar (240px, `#fff8f1` bg) and content area (960px). Every critical action reachable in ≤2 taps. Priority Action Inbox is the home screen hero — not a summary card, a task queue.

### Surface 3 — Saathi Employer Portal
The Skill Card is the hero artifact. Design for one-handed 375px mobile viewport first. The MSME sees: a face, a verified badge, a skill claim, a video, and one button. Nothing else above the fold. WhatsApp-native flows use the WhatsApp bubble components.

### Surface 4 — Saathi District Console
Desktop-first (1440px max-width). Two-column layout: sidebar navigation (260px) + main content (auto). Data visualizations get generous whitespace. Policy brief view: editorial layout using Proxima Nova display type for section headers, Inter for data tables. Cream canvas sections alternate with `#ffffff` for visual rhythm.

---

## Gradient System

**Primary gradient** (section backdrops, onboarding hero, skill card accent band):
`linear-gradient(135deg, #004038 0%, #00544c 60%, #fa5d00 100%)`  
Used sparingly — hero sections and onboarding screens only. Never inside cards or buttons.

**Warm ambient glow** (behind feature illustrations or stats sections):
`radial-gradient(ellipse at 60% 40%, #fee3b5 0%, #fff8f1 70%)`  
Harvest-derived atmospheric warmth. Hero background only.

**Status gradient** (placement celebration / success screens):
`linear-gradient(135deg, #dcfce7 0%, #d1fae5 100%)`

---

## Do's and Don'ts

### Do
- Set all page backgrounds to `#fff8f1` — the cream IS the brand warmth and the anchor against sterile govt-portal white.
- Use `#004038` (Saathi Teal) for trust signals: verified badges, credential borders, secure section dividers, brand typography.
- Use `#fa5d00` (Action Flame) for ONE primary CTA per viewport — never as a background wash, section color, or decoration.
- Apply 16px radius to all buttons, inputs, and cards. 999px only for pills/badges. 20px for skill cards and modals.
- Set `line-height: 1.75` for all Hindi body text at 14–18px. This is not optional — Devanagari akshara will clip at 1.5 and below.
- Use Inter 600 uppercase at `letter-spacing: 0.08em` for all ALL-CAPS labels (status badges, eyebrows, table headers).
- Apply the 4-color semantic system (green/red/amber/blue) consistently and exclusively for status communication. Never repurpose these colors decoratively.
- Keep warm shadows tinted: `--shadow-card-warm` for action elements, `--shadow-card-teal` for brand elements. Never cold blue shadows.
- On officer and district surfaces, always provide a left-border accent on learner cards to communicate status at a glance without reading the label.

### Don't
- Don't use `#ffffff` as the page background — the `#fff8f1` cream canvas is the system identity.
- Don't introduce a second brand accent color. Teal (trust) + Flame (action) is the complete chromatic vocabulary.
- Don't use Proxima Nova for body copy, form labels, or text under 18px — Inter is the readable workhorse here.
- Don't exceed 4 colors in any single data visualization.
- Don't use corner radii below 8px on any element. The warmth and approachability of the system depends on softness.
- Don't use pure black (`#000000`) for any text. Use `#0f161e` (Ink Black) everywhere.
- Don't shadow cards in cold gray — the `--shadow-card` uses a warm near-black tint, not `rgba(0,0,255,...)`.
- Don't design WhatsApp screens with non-native elements (no sidebars, no nav bars, no headers inside the chat view).
- Don't use the hero gradient (`#004038 → #fa5d00`) anywhere except hero or onboarding screens.
- Don't render Hindi text below 14px. 16px is the safe minimum for Devanagari legibility on low-DPI screens.

---

## Surfaces Reference

| Token | Value | Role |
|-------|-------|------|
| `--surface-canvas` | `#fff8f1` | Primary page background |
| `--surface-card` | `#ffffff` | Card and panel surfaces |
| `--surface-sidebar` | `#fff8f1` | Sidebar backgrounds (same as canvas) |
| `--surface-apricot` | `#fde8ce` | Warm pastel card backgrounds |
| `--surface-sky` | `#bee9f4` | Cool pastel card backgrounds |
| `--surface-parchment` | `#fee3b5` | Notification/in-progress tint |
| `--surface-teal-dark` | `#004038` | Dark teal header bands (skill card) |
| `--surface-ink` | `#0f161e` | Dark section backgrounds (rare) |

---

## Similar Design Systems for Reference

- **Workable** — Human-centered HR platform with the same warm cream + forest teal palette and rounded photography approach
- **Harvest** — Warm productivity tool with the same single-accent-on-cream discipline and tactile rounded components
- **Framer** — Shares the bold Proxima-style display type at large sizes paired with clean UI sans body
- **BambooHR** — Same warm canvas + people-forward photography + card-grid information architecture for an HR workflow audience
- **Notion** — Same comfortable spacing rhythm and flat surface-contrast depth on warm backgrounds

---

## Quick Start

### CSS Custom Properties

```css
:root {
  /* Brand Colors */
  --color-cream-canvas: #fff8f1;
  --color-saathi-teal: #004038;
  --color-deep-moss: #00544c;
  --color-action-flame: #fa5d00;

  /* Text Colors */
  --color-ink-black: #0f161e;
  --color-graphite: #333942;
  --color-warm-stone: #615f5c;

  /* Surface Colors */
  --color-pure-white: #ffffff;
  --color-bone: #c0bbb6;
  --color-mist: #d9d9d9;
  --color-parchment-glow: #fee3b5;
  --color-apricot-wash: #fde8ce;
  --color-sky-tile: #bee9f4;

  /* Semantic Status Colors */
  --color-success: #16a34a;
  --color-success-surface: #dcfce7;
  --color-risk: #dc2626;
  --color-risk-surface: #fee2e2;
  --color-caution: #d97706;
  --color-caution-surface: #fef3c7;
  --color-info: #2563eb;
  --color-info-surface: #dbeafe;

  /* WhatsApp Bubble Colors */
  --color-bubble-ai: #e8f5f0;
  --color-bubble-learner: #dcfce7;

  /* Typography — Font Families */
  --font-display: 'Proxima Nova', 'Montserrat', ui-sans-serif, system-ui, sans-serif;
  --font-body: 'Inter', 'Noto Sans', ui-sans-serif, system-ui, sans-serif;

  /* Typography — Scale */
  --text-caption: 13px;
  --leading-caption: 1.35;
  --text-body-sm: 14px;
  --leading-body-sm: 1.50;
  --text-body: 16px;
  --leading-body: 1.50;
  --text-body-lg: 18px;
  --leading-body-lg: 1.50;
  --text-subheading: 20px;
  --leading-subheading: 1.38;
  --text-heading-sm: 24px;
  --leading-heading-sm: 1.30;
  --text-heading: 32px;
  --leading-heading: 1.25;
  --text-heading-lg: 48px;
  --leading-heading-lg: 1.15;
  --text-display: 56px;
  --leading-display: 1.14;
  --text-display-lg: 72px;
  --leading-display-lg: 1.13;

  /* Hindi Line Heights (add .hindi class to override) */
  --leading-body-hi: 1.75;
  --leading-body-sm-hi: 1.75;
  --leading-heading-hi: 1.45;
  --leading-display-hi: 1.35;

  /* Typography — Weights */
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* Spacing */
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-20: 20px;
  --spacing-24: 24px;
  --spacing-32: 32px;
  --spacing-40: 40px;
  --spacing-48: 48px;
  --spacing-64: 64px;
  --spacing-80: 80px;
  --spacing-96: 96px;
  --spacing-104: 104px;

  /* Layout */
  --page-max-width: 1200px;
  --dashboard-max-width: 1440px;
  --section-gap: 64px;
  --card-padding-mobile: 20px;
  --card-padding-desktop: 32px;
  --element-gap: 16px;
  --sidebar-width: 240px;

  /* Border Radius */
  --radius-sm: 8px;
  --radius-md: 16px;
  --radius-lg: 20px;
  --radius-full: 999px;

  /* Named Radii */
  --radius-buttons: 16px;
  --radius-cards: 16px;
  --radius-inputs: 16px;
  --radius-modals: 20px;
  --radius-skill-card: 20px;
  --radius-badges: 999px;
  --radius-avatars: 999px;
  --radius-whatsapp-bubble: 16px;

  /* Shadows */
  --shadow-sm: rgba(0, 0, 0, 0.10) 0px 1px 4px 0px;
  --shadow-card: rgba(0, 0, 0, 0.07) 0px 2px 8px 0px;
  --shadow-card-warm: rgba(250, 93, 0, 0.10) 0px 4px 16px 0px;
  --shadow-card-teal: rgba(0, 64, 56, 0.10) 0px 4px 16px 0px;
  --shadow-modal: rgba(0, 0, 0, 0.15) 0px 8px 32px 0px;

  /* Surfaces */
  --surface-canvas: #fff8f1;
  --surface-card: #ffffff;
  --surface-sidebar: #fff8f1;
  --surface-apricot: #fde8ce;
  --surface-sky: #bee9f4;
  --surface-parchment: #fee3b5;
  --surface-teal-dark: #004038;
  --surface-ink: #0f161e;
}

/* Hindi text overrides */
.hindi, [lang="hi"], [lang="bho"] {
  font-family: var(--font-body);
  line-height: var(--leading-body-hi);
  letter-spacing: 0.01em;
}
.hindi.text-body-sm { line-height: var(--leading-body-sm-hi); }
.hindi.text-heading, .hindi.text-heading-sm { line-height: var(--leading-heading-hi); }
```

---

### Tailwind v4

```css
@theme {
  /* Brand Colors */
  --color-cream-canvas: #fff8f1;
  --color-saathi-teal: #004038;
  --color-deep-moss: #00544c;
  --color-action-flame: #fa5d00;

  /* Text Colors */
  --color-ink-black: #0f161e;
  --color-graphite: #333942;
  --color-warm-stone: #615f5c;

  /* Neutral Surface Colors */
  --color-pure-white: #ffffff;
  --color-bone: #c0bbb6;
  --color-mist: #d9d9d9;
  --color-parchment-glow: #fee3b5;
  --color-apricot-wash: #fde8ce;
  --color-sky-tile: #bee9f4;

  /* Semantic Status */
  --color-success: #16a34a;
  --color-success-surface: #dcfce7;
  --color-risk: #dc2626;
  --color-risk-surface: #fee2e2;
  --color-caution: #d97706;
  --color-caution-surface: #fef3c7;
  --color-info: #2563eb;
  --color-info-surface: #dbeafe;

  /* WhatsApp Bubble Colors */
  --color-bubble-ai: #e8f5f0;
  --color-bubble-learner: #dcfce7;

  /* Typography */
  --font-display: 'Proxima Nova', 'Montserrat', ui-sans-serif, system-ui, sans-serif;
  --font-body: 'Inter', 'Noto Sans', ui-sans-serif, system-ui, sans-serif;

  /* Typography Scale */
  --text-caption: 13px;
  --leading-caption: 1.35;
  --text-body-sm: 14px;
  --leading-body-sm: 1.50;
  --text-body: 16px;
  --leading-body: 1.50;
  --text-body-lg: 18px;
  --leading-body-lg: 1.50;
  --text-subheading: 20px;
  --leading-subheading: 1.38;
  --text-heading-sm: 24px;
  --leading-heading-sm: 1.30;
  --text-heading: 32px;
  --leading-heading: 1.25;
  --text-heading-lg: 48px;
  --leading-heading-lg: 1.15;
  --text-display: 56px;
  --leading-display: 1.14;
  --text-display-lg: 72px;
  --leading-display-lg: 1.13;

  /* Spacing */
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-20: 20px;
  --spacing-24: 24px;
  --spacing-32: 32px;
  --spacing-40: 40px;
  --spacing-48: 48px;
  --spacing-64: 64px;
  --spacing-80: 80px;
  --spacing-96: 96px;
  --spacing-104: 104px;

  /* Border Radius */
  --radius-sm: 8px;
  --radius-md: 16px;
  --radius-lg: 20px;
  --radius-full: 999px;

  /* Shadows */
  --shadow-sm: rgba(0, 0, 0, 0.10) 0px 1px 4px 0px;
  --shadow-card: rgba(0, 0, 0, 0.07) 0px 2px 8px 0px;
  --shadow-card-warm: rgba(250, 93, 0, 0.10) 0px 4px 16px 0px;
  --shadow-card-teal: rgba(0, 64, 56, 0.10) 0px 4px 16px 0px;
  --shadow-modal: rgba(0, 0, 0, 0.15) 0px 8px 32px 0px;
}
```
