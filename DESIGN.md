# Kin: personal CRM

Direction: a warm, practical contact notebook. The September 6 refinement puts the last conversation, next follow-up and contact schedule at the center of the interface. Portraits are small identifiers; the app uses direct labels and readable text.

## Color and type

Warm white `#FBF9F5` supports reading, brown `#382D28` carries primary text, and terracotta `#8F4832` marks actions and selection. Borders and supporting text stay in the same warm family. Dark mode changes these semantic variables consistently.

Manrope is the working typeface, with 14–16px body text and supporting details at least 12px. Source Serif 4 is limited to the Kin wordmark and page title. Names and notes wrap instead of truncating.

## Layout

Desktop uses a contact roster alongside the selected person's details and a conversation/history workspace. The selected-person summary contains a small avatar, actual last conversation date, actual next follow-up date, plain cadence text, and the last saved note. Tablet and mobile stack the form and history where space requires it. Mobile uses a single contact list and 16px form controls.

The large arched portrait, decorative progress rings, poetic empty states and uppercase labels are removed. Cadence is stated as “Every 30 days” rather than implying an activity or relationship progress score.

## Data and interaction boundaries

- Only the original Ana and Ben sample IDs use small square crops from the fictional portrait atlas. New contacts use initials. The footer explains the sample imagery, and named avatar alternatives identify it as fictional.
- Dates, contact schedules and notes come from the existing records. No relationship facts or shared interests are invented.
- Search, due filters, selection, forms, draft ownership guards, error visibility and partial-write recovery remain unchanged.
- The ordinary Refresh control stays disabled during a pending write. The explicit recovery button retries the required step without duplicating an interaction.
- `no-script.css` makes the original stored records readable when scripting is disabled. Loading space, focus rings, reduced motion and dark mode remain supported.

## Assets

The package serves `site/assets/Manrope-Variable.woff2` and `site/assets/crm-portraits.webp` at their `/assets/` URLs. A deployment must preserve those paths. Ship the CRM-local Source Serif font, favicon, stylesheets and JavaScript as well. No runtime CDN is used.
