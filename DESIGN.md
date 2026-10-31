---
name: Clear Toh
description: A practical Thai shared-expense ledger with a running receipt.
colors:
  canvas: "#f5f7f6"
  paper: "#fff"
  ink: "#192d28"
  muted: "#62726b"
  line: "#dee5e0"
  green: "#176246"
  green-dark: "#104b35"
  green-soft: "#e8f1eb"
  danger: "#a52e36"
  warning: "#845411"
  focus: "#429d75"
  field-border: "#cad5ce"
typography:
  display:
    fontFamily: "Manrope, Noto Sans Thai, sans-serif"
    fontSize: "44px"
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Manrope, Noto Sans Thai, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1.45
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Manrope, Noto Sans Thai, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: 1.45
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Manrope, Noto Sans Thai, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Manrope, Noto Sans Thai, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.65
  helper:
    fontFamily: "Manrope, Noto Sans Thai, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.8
  metadata:
    fontFamily: "Manrope, Noto Sans Thai, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.65
  panelTitle:
    fontFamily: "Manrope, Noto Sans Thai, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.45
  amount:
    fontFamily: "Manrope, Noto Sans Thai, sans-serif"
    fontSize: "36px"
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: "-0.04em"
rounded:
  tag: "5px"
  control: "8px"
  panel: "14px"
  person: "30px"
spacing:
  xs: "4px"
  sm: "8px"
  compact: "12px"
  md: "16px"
  section: "20px"
  lg: "24px"
  page: "32px"
components:
  button-primary:
    backgroundColor: "{colors.green}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "11px 20px"
  button-primary-hover:
    backgroundColor: "{colors.green-dark}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "11px 20px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  panel:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "25px"
  person-chip:
    textColor: "{colors.ink}"
    rounded: "{rounded.person}"
    padding: "5px 8px 5px 5px"
---

# Design System: bill

## Overview

**Creative North Star: "The Shared-Expense Ledger"**

Light paper surfaces, deep green actions and a continuous receipt make item assignment and payment amounts easy to scan for shared expenses. The visual identity is practical and calm: participants stay next to the items they share, while totals receive stronger size and contrast than supporting explanations.

This records the implemented recommendation in the standalone bill project. The direction is open to further user feedback; no user-provided visual reference or approved generated comp establishes formal visual approval. The durable language is Thai-first, with Latin and numeric text handled by Manrope. Page strategy and the first-viewport contract remain in `docs/surface-brief.md`.

**Key Characteristics:**
- White ledger panels on a light gray-green canvas.
- Deep green actions, selected states and prominent totals.
- Compact item rows, attached participant controls and right-aligned amounts.
- Restrained participant colors and consistent stroke SVG icons.
- Flat working surfaces with dashed receipt separators.

## Colors

The palette uses a single deep green accent and cool paper neutrals; semantic red and amber explain payment or validation states.

### Primary
- **Ledger Green** (`green`): primary buttons, active navigation, links and payment totals.
- **Deep Ledger Green** (`green-dark`): primary hover and the editor's receipt total.
- **Selected Leaf** (`green-soft`): selected or successful surfaces and icon hover feedback.

### Neutral
- **Table Canvas** (`canvas`): the continuous page background.
- **Receipt Paper** (`paper`): header, panels, fields and fixed mobile summary.
- **Ledger Ink** (`ink`): headings, entered values and ordinary financial amounts.
- **Supporting Sage** (`muted`): secondary explanations, labels and placeholders.
- **Ledger Rule** (`line`): dividers and panel outlines.
- **Field Rule** (`field-border`): stronger input boundaries.

Danger and warning colors identify semantic feedback, supported by explanatory copy. The brighter focus green marks keyboard location. Participant avatars cycle through four muted green, violet, orange and blue pairings; those identity cues do not replace status labels.

**The Action Green Rule.** Use the green family for actionable or financial emphasis; keep ordinary reading surfaces neutral.

## Typography

**Display Font:** Manrope, Noto Sans Thai, sans-serif.
**Body Font:** the same stack; Noto Sans Thai supplies Thai glyphs.

**Character:** one compatible sans-serif stack keeps mixed Thai, Latin and decimal values cohesive. Weight, size and spacing establish hierarchy without a decorative display family.

### Hierarchy
- **Display:** the home statement uses the frontmatter display role; its responsive sizes are 2.375rem (38px), 1.9375rem (31px) and 2.3125rem (37px) at the implemented breakpoints.
- **Headline:** global page-heading default, reduced to 29px on narrow editor screens. Share and payment titles use compact variants appropriate to their centered layouts.
- **Title:** section titles; panel titles use 1.25rem (20px at the default browser size) on both desktop and phones.
- **Body:** ordinary interface text and controls use 1rem (16px). Helper copy uses 0.9375rem (15px), with 1.8 line height; compact status/metadata uses 0.875rem (14px) minimum.
- **Label:** field labels and button labels use 1rem (16px); buttons use weight 600. Mobile inputs keep the same readable 16px floor. Font sizes use rem units and respect browser text settings.
- **Amount:** running receipt emphasis. Summary size adapts to 31px at the intermediate breakpoint and 38px below the single-column breakpoint; shared totals and payment amounts also receive prominent numeric treatment.

Existing brand, display and amount variants retain their proportions, now expressed in rem: 18–26px for brand/compact figures, 29–38px for responsive page titles and totals, and 44px for the primary display. They are visual emphasis roles, separate from the shared reading floors above.

**The Decimal Alignment Rule.** Use tabular numerals for financial values and right-align values in comparison rows. Keep currency and amount together where space permits.

## Layout

The shell is centered at a maximum width of 1184px including 32px side padding, yielding 1120px of usable desktop content. Account settings retain their 650px measure, allowing helper text to wrap naturally at the larger reading size. Major work sections use 20–24px gaps, with a compact rhythm of 4–16px inside controls and rows. Panels use 25px padding on wide screens, adjusting to 20px at 1000px, 22px at 760px and 18px at 520px.

The desktop editor uses a flexible main column and a 340px receipt column with a 24px gap. At 1000px the receipt narrows to 300px and the gap to 17px. At 760px the editor stacks into one column with 20px outer gutters. The receipt becomes part of the normal document flow, and a fixed bottom total/summary shortcut preserves access while editing. Its safe-area padding and the page's reserved bottom space keep the shortcut usable without covering the final content.

At 520px, an item's name occupies a full row above price, quantity and removal. Participant controls remain attached beneath the same item. Lists, share actions and participant payment rows wrap at this breakpoint. The header navigation moves to a dedicated second row below 760px.

**The Attached Assignment Rule.** Preserve each item's fields and participant selection as one visual group when stacking or wrapping the layout.

## Elevation & Depth

Working panels are flat: white fill, fine borders and selective pale-green bands create separation. The illustrative home receipt is the deliberate exception, with a soft paper shadow, a slight rotation and a torn lower edge. This physical treatment belongs to the example receipt, rather than every card. The example receipt carries a full-width deep-green total band with white 40px numerals (32px in compact layouts), a 20px heading, and clearly separated participant rows with 18px green amounts. The receipt grows to 420px on desktop and fills the available mobile column up to 360px. Its explanatory caption stays quiet at 16px.

### Shadow Vocabulary
- **Illustrative paper:** `0 20px 40px #163a2229`; used by the example receipt after its entrance animation.

**The Flat Ledger Rule.** Use borders and tonal surfaces for working containers. Reserve lifted paper depth for the illustrative receipt.

## Shapes

Panels use the panel radius; fields and standard buttons use the smaller control radius. Small status tags use the tag radius, participant chips use a pill silhouette and avatars are circular. Fine solid rules organize records; dashed separators mark receipt totals and breakdown boundaries. The recurring icon system uses authored SVG outlines with a 1.7px stroke, rounded ends and rounded joins.

## Components

### Buttons

Compact and explicit. Standard buttons have a minimum height of 46px, centered icon/text alignment and the control radius. Primary actions use Ledger Green with white text; hover deepens the fill. Secondary actions use white with an outlined edge, gaining a pale green tint on hover. Compact variants have a 38px minimum height. Active press moves a button down by 1px; disabled controls reduce opacity to 0.58 and suppress pointer interaction.

### Inputs / Fields

White fields have a visible fine border, the control radius and a minimum height of 44px. Labels sit above their fields, helper text sits below, and placeholders use Supporting Sage. Focus adds a 2px green outline with a 1px offset. Number fields use tabular numerals. Checkbox controls use the action green and remain associated with visible labels.

Proportional allocation uses a compact responsive grid of named inputs with a visible ส่วน suffix. A quiet help icon beside แบ่งตามจำนวนส่วน reveals a tooltip using the 300-baht beer example: two glasses/two parts pay 200 baht; one glass/one part pays 100 baht. It opens on hover, keyboard focus or tap and dismisses on Escape, focus loss, outside tap or a second tap. The tooltip stays within the section width, moves above the heading when needed, and uses white paper, a fine border and a soft offset shadow. The help button has a 44px target on coarse pointers. Inputs start blank and remain blank when cleared; a numeric keyboard accepts whole-number parts from 0–999 without number spinners. Blank inputs retain equal splitting until custom parts are first entered; in a custom split, blank means no allocation to that person. A short visible helper describes that current state. The compound input keeps the existing field border and 44px target, with focus on its whole boundary.

Item discounts use the same compound numeric field with a visible % suffix and decimal keyboard. They start blank without a placeholder, accept 0–100 with up to two decimal places, and remain blank when cleared. Existing zero discounts display blank; nonzero discounts are preserved. Service charge and VAT use rectangular pressed-state buttons alongside the participant allocation, aligned to the right when space permits and wrapping below on narrow screens. The discount stays in the expandable item details. Charge controls retain 44px touch targets.

Service charge and VAT amounts use an integrated % / ฿ switch rather than a native dropdown. Both choices stay visible within the field; the selected choice has white fill, a fine border and dark green text. The amount starts blank with a ไม่คิดเพิ่ม placeholder and a decimal keyboard, without number spinners. Focus encloses the compound field. Unit buttons have 44px targets on coarse pointers; the two charge fields stack below 520px.

Bill PINs contain exactly four visible digits, shown in four equal boxes in both the editor and shared-bill gate. The row fits within 240px and shrinks to its container; each box is at least 52px high and uses the existing title-size numerals. Typing advances focus; whole-PIN paste works from any box. Backspace/Delete and arrow keys support correction without shifting other digits, and leading zeros are retained. Invalid old values are flagged for replacement rather than silently shortened. Screen-reader labels identify each digit and the group; PINs are never masked in these fields.

### Chips

Participant chips pair an initial avatar with a readable name and remove action inside an outlined pill. Per-item allocation uses compact name buttons without checkboxes: 8px corners, 36px height for mouse input and a 44px minimum touch target. Selected names have pale green fill, a green border, dark green text and `aria-pressed`; unselected names use white with a fine border. Font weight remains constant while toggling. The all-participants control is a quiet text button separated from the names by a fine rule; its active state is underlined. Four avatar tones identify participants consistently within a bill.

### Cards / Containers

Panels share white paper, a fine Ledger Rule border and rounded corners. The summary has a slightly greener border and an inset pale-green total band. Bill records form a continuous list with dividing rules; hover adds a subtle tint rather than a lifted shadow.

### Navigation

The white header separates Home (`/`), My Bills (`/bills`) and account settings (`/settings`, labelled ตั้งค่าบัญชี). The home page introduces bill creation and shows the illustrative receipt; the personal bill list, search, My bills/To pay tabs and empty state belong only to My Bills. My Bills keeps separate publication and payment-status badges, with settled-person progress for created bills. Use exactly two list tabs, My bills and the counted To pay tab; personal outstanding amounts carry an explicit label while created bills retain their whole-bill total. The two tabs form one two-column row on compact screens, and bill rows align name, amount and status beneath the icon/name hierarchy. Keep empty, retry and live-refresh states visible without resetting filters or search. It uses muted labels and a deep-green active label with a bottom rule. The active location remains identifiable by the underline. On smaller screens, navigation occupies its own second row. Text links use green and gain an underline on hover. Buttons, links and disclosure controls expose a 3px focus outline with a 4px offset.

### Running Receipt

The receipt presents the total, arithmetic breakdown and per-person amounts in that order, using dashed separators and right-aligned values. On desktop it is sticky 24px from the top; below 760px it joins the content flow and gains the fixed bottom summary shortcut. Status messages distinguish drafts, published bills, pending payment evidence and verified payment through wording as well as color.

Transitions are brief (0.15s). The illustrative receipt settles once over 0.65s; loading uses a rotating outline. Reduced-motion preference disables animations and transitions. Printed shared bills hide application navigation and action controls and simplify the receipt border.

## Do's and Don'ts

### Do:
- **Do** keep amounts tabular and right-aligned in ledger rows.
- **Do** keep participant selection visually attached to its item when layouts stack.
- **Do** use Thai-first labels and the established mixed-script font stack.
- **Do** preserve visible keyboard focus and reduced-motion behavior.
- **Do** label illustrative receipt data as example data.

### Don't:
- **Don't** spread the illustrative receipt's rotation and shadow onto working panels.
- **Don't** use color alone to communicate payment or validation state.
- **Don't** replace authored stroke SVG icons with text glyphs.
- **Don't** add game, XP or celebratory visual treatments to this bill-only interface.

Account identity: the header displays the stored nickname as a clickable link to `/settings#nickname`; an unset nickname displays ตั้งชื่อเล่น. The link keeps a 44px target height and truncates long names within the existing header width. Settings use one account form for nickname and PromptPay with a single save action. PromptPay is optional until a recipient number is configured; both supplied fields are validated before one atomic profile update.

### Item payers and reimbursements

Each new bill assigns an advancing payer to each item, separately from the consumers. The creator is selected for new items when their identity is known. A compact name-button row uses the existing pale-green pressed style; a compact Add/Edit PromptPay button opens a native modal dialog for the selected person. The payer row wraps naturally and has no redundant vertical divider. The dialog has a named numeric field, validation, Save/Cancel and close actions; Escape or backdrop dismissal discards unsaved edits. Saving updates the same participant across all their items. The field accepts visible mobile/ID digits and never masks them. Native modal behavior handles background inertness, keyboard focus containment and focus return. Removing a payer clears their assignments and blocks publication until replacement payers are selected.

The receipt uses a continuous per-person ledger: an avatar and a distinct bold name on the left, small receive/transfer labels beside right-aligned amounts, showing both when the same person pays and receives, then one line with the consumption share label/value on the left and the money advanced label/value on the right. The summary is capped at 320px, rows use 9px vertical padding, and the two detail pairs keep labels and values together. Fine rules separate people. Reimbursements stay attached to each item's payer; only reciprocal payments between the same two people are offset. Transfer rows use separate route and amount columns with an authored arrow icon and accessible transfer wording; names and amounts never share a text run. Pending assignments hide incomplete costs and transfer instructions. On the payment page, multiple recipients appear as explicit amount/status buttons; choosing one updates the QR, remaining amount, slip and review target together. A person with no outgoing transfer sees a no-additional-payment state. Existing bills retain their original single-owner recipient until explicitly switched before payment evidence exists.

### เคลียร์โต๊ะ / Clear Toh identity

The shared bill uses a receipt composition: a 600px maximum-width sheet with square corners, subtle downward shadow and a repeating cut-paper bottom edge. Brand, bill name and date sit inside the sheet. Items and right-aligned prices come first, followed by the ruled total, then compact two-column participant rows and payment actions. Keep zero service charge/VAT rows hidden, pairwise balances intact and the print action absent. Compact screens reduce paper padding; long names wrap within the flexible column while amounts stay aligned.

The public brand is เคลียร์โต๊ะ / Clear Toh. The user supplied an illustration of friends splitting expenses around a table as the new visual reference. The symbol is an AI-generated, simplified group of three friends around one table and a shared gold coin, with dark-green outlines, mint fills and transparent background. Header and both favicon SVG wrappers embed the same optimized 256px PNG; the original is preserved in public/clear-toh-friends-original.png. The approved Thai/English wordmark is unchanged: header symbol 40px (36px compact), Thai Noto Sans Thai 600 at 22px (20px compact), English Manrope 600 at 11px with 0.04em tracking. Minimum link target stays 44px. Use the versioned clear-toh-friends-1 asset URL. Technical identities remain unchanged.

### Branded payment QR

Payment QR codes use uniform black rounded modules on white, with softly rounded finder corners preserving their 7/5/3 proportions and a four-module quiet zone. The friends/table logo occupies 20% of the module area width inside a rounded white central clearance. H-level error correction is used. BrandedQr renders the same self-contained SVG to a 1024px canvas, displayed at up to 240px and saved as PNG. The surrounding QR box has no extra border or padding. Download is enabled only for a canvas matching the current payload. Recipient and amount generation remain unchanged, including the development-only two-baht amount.

### User account menu

Account settings and sign-out live in a native details dropdown at the right of the header, opened by the user's avatar/name. Settings no longer appears in the main navigation. Escape closes and returns focus to the trigger; outside pointer or keyboard focus closes the panel. Account actions retain 44px targets. Compact screens below 420px show the avatar and chevron, with the full name inside the panel. Anonymous users see the existing login link.

### Thai and English

Use a dedicated TH/EN dropdown on the navbar, beside the user account or login control. It is visible before and after login, outside the user menu. Options ไทย and English use native buttons with aria-pressed, a current-choice checkmark, 44px targets and the existing pale-green selected state. Client context updates immediately on selection; the cookie persists the choice and a server refresh updates metadata/server-rendered copy without changing the URL, query, fragment or unaffected form state. Legacy /th and /en links redirect to unprefixed URLs. English dates use en-GB, Thai dates use th-TH; money remains THB. User names, bill titles, item names and the approved 11px English brand subline remain unchanged.

### Payment receipt

The participant payment page shares the paper vocabulary of the shared bill: one 520px-max sheet with a cut-paper edge, brand/title inside, compact underlined recipient choices, collapsed expense disclosure, QR/payment section, and slip evidence separated by dashed rules. No separate QR/evidence cards. Keep all receiver, amount, evidence and review states bound to the selected settlement. The upload input overlays its full label transparently, retaining native file selection and visible focus without browser file-button chrome. No-outgoing payments use the same sheet.

### Whole-table settlement status

Published shared receipts show a compact TableProgress above item details, separated by the receipt's dashed rule. Show people fully settled / all participants, outstanding THB and a native six-pixel progress bar. Count someone with no transfer due as settled, with a visible note explaining the count. Pending slips do not count until verified amounts are credited. Clamp every recipient balance independently so overpaying one recipient cannot settle another. The all-cleared state adds a green check and label; draft/cancelled/empty bills do not show the status. Keep Thai/English labels and native progress semantics.

### Live bill status

Shared published bills and participant payment pages refresh in the background about every three seconds while visible. A steady small green dot and localized “Updates automatically” label sit below the title; reconnecting uses the warning dot and explanatory text. Do not flash the initial loading view or reset recipient selection, disclosure state, slip preview or review reason. Pause while submitting/reviewing payments or sharing, and abort on route changes, hiding or unmount. Back off network failures to 30 seconds and refresh on focus/online return. Confirmed amounts drive the progress bar and per-recipient remaining balances; a fully received balance is labeled Received.

### Compact mobile navbar

At 760px and below the header uses an explicit two-row grid: a 56px brand/control row and a 44px pair of equal-width navigation tabs with an 8px bottom inset. No vertical grid gap. Put language and a compact avatar-only user trigger on the right; the full name stays inside the dropdown. Active navigation uses green-soft rather than the desktop underline. Preserve 44px targets. For guests below 380px, the login label becomes an accessible login icon. Desktop keeps its horizontal layout and visible account name.

Shared receipt interactions: a compact wrapping name picker filters to one participant; Everyone restores the full table. PNG summary previews use the existing paper/green identity and a bill-opening QR, labeled as a snapshot. A single short pressed-stamp animation celebrates verified completion and respects reduced motion. Repeat-group creation preserves source records and existing normal drafts; actions remain quiet in the receipt toolbar.

Localization implementation: static UI copy uses typed semantic keys (`nav.myBills`, `payment.toPay`, `share.image`) with separate Thai/English dictionaries. Keep prose and interpolation templates in dictionary values. Dynamic API feedback is translated at an explicit boundary; user content and approved bilingual branding remain unchanged.

Account setup uses one focused username-and-nickname form after sign-in; an existing immutable username is prefilled read-only, while the 1–40 character nickname remains editable and required. Shared bills and safe amount explanations remain public with their existing PIN/token access, while payment pages, full payment data, uploads and slip images require a complete signed-in profile. Before a non-owner pays an unlinked manual participant entry, show the bill and saved participant name, prominent aggregate remaining payment, per-recipient balances with prior-payment notes, and an initially collapsed compact breakdown of items, fees and advances. Place the signed-in nickname and @username with the explicit “Confirm this entry is mine” action above the amount preview, and emphasize the saved participant name in bold dark green within the confirmation text. QR/upload controls and private evidence reads wait until confirmation. When a valid shared link belongs to another linked account, show the same collapsed amount/item preview in read-only mode with participant-specific cost and advance labels, without a claim action or payment controls. This links the entry once while preserving its original typed label, creator-entered receiver fallback and balances. After linking, display the primary account’s current nickname consistently in the receipt, editor, payment view, consumer/payer labels and expense recipient details; unlinked entries retain their typed names. Never expose the account relation in public receipt or expense responses; owners can manage other participants without claiming them. If a signed-in non-owner already has a linked entry in the same bill, show other unlinked entries as read-only previews with an explicit notice and Open my entry action, never another claim prompt. The action opens their linked entry with a scoped participant token; keep claim and payment controls out of the other entry. Owners never see a claim action for other participants. Friends and groups live in the account menu. Exact search shows profile photo/initial, display name, @username and relationship state; the email query is not echoed in results. Incoming requests have explicit Accept/Decline actions. Group creation is inline disclosure with member selection, a name and a visible auto-friend explanation. The bill editor uses one editable combobox for accepted friends, saved groups, exact username/email lookup and manual guest names. A single in-flow menu filters suggestions and automatically looks up a valid exact username/email after a 400ms typing pause, showing the matching account directly without a Search action. Accepted friends appear immediately; reuse normalized lookup results and abort stale requests. Offer add-by-name only when no account matches, and never add a name while lookup is pending or failed. Exclude selected account IDs and retain 44px targets, keyboard navigation, independent loading/retry states and one manage link. A linked account’s configured PromptPay is authoritative and read-only in the editor, with a settings link only for that account. If the account has no PromptPay, the creator can add or edit a bill-specific fallback through the existing dialog. All new UI copy uses paired typed translation keys and existing green/receipt typography and mobile touch targets.

Balance explanations: published amounts are accessible help triggers above the full-row payment hit area. The native dialog opens a full personal calculation, with recipient explanations collapsed beneath it. Use receipt rules and two-column amount lines, hide zero service-charge/VAT/rounding rows and retain the existing paper styling. The payment page also offers a collapsed personal overview alongside the selected recipient’s breakdown. Live refresh preserves open disclosures and uses the latest scoped token; Escape/Close returns focus to the trigger.

Home refinement: preserve the original headline, green/white palette, paper silhouette and creator/guest actions. The example receipt is now a working preview with three quiet underline controls (equal, by item, multiple payers), using the real settlement engine. Participant rows disclose their item costs and, in payer mode, actual incoming/outgoing transfers. Padded hover surfaces retain text alignment. A short unboxed capabilities line and a two-column sequential workflow finish the story below the hero; both the hero and workflow stack at 600px. Keep the original receipt entrance motion and existing reduced-motion support; no additional animation or generic feature-card grid.


Bill sharing controls: on an existing published bill, place a secondary Stop sharing action next to the publication status in the edit-page heading, outside the payment-locked fields. Keep the heading actions wrapping on mobile with standard touch targets. A stopped bill uses a neutral Sharing stopped badge and a notice explaining the 404 link while retaining bill/payment history. The existing primary share action becomes Share again. Keep unsaved local input intact when stopping. Shared routes return true HTTP 404 with the branded receipt-style 404 surface after sharing stops; ownership management stays in the editor.


Bill URL refinement preserves the existing receipt/editor interface: shared /:id, payment /:id/:pid and creator /manage/:id paths replace repeated bill prefixes. Canonical share links and image QR codes use the same path builder. Keep My Bills navigation active while editing under /manage, and return true HTTP 404 with the branded receipt-style 404 surface for missing/stopped shared routes without exposing bill content.

**The Branded 404 Rule.** Missing or stopped shared routes retain true HTTP 404 and reveal no bill data. Use the inherited light mint canvas in both light and dark OS preferences, white receipt paper with its cut bottom edge, and a dark-green 404 within the single h1. The 404 is a scoped status display (6rem); the localized title (24px) and explanation (16px) retain the existing type system. Thai/English copy explains an incorrect link or stopped sharing. Offer My Bills as the primary recovery link and Home as secondary, in two columns above 520px and stacked at 520px and below, with targets of at least 44px and visible keyboard focus. This pattern does not change global typography.

Shared receipt identity: mark participants linked to the signed-in account or its retained account aliases with a bold unboxed “You” identity label beside the name, a 20px green-dark name and a green-soft row background, and stably place those rows first. Keep this identity treatment distinct from filled payment-status badges; retain readable dark-green secondary text on the tinted row. Keep the other participants in their original order, except that a known sole advancing payer for the whole bill goes last; the signed-in user’s own entries retain first priority. Match account links only; names and bill ownership do not identify a personal participant row. Anonymous viewers and accounts without a linked entry see no personal marker. This ordering is presentation-only: preserve saved participants, rounding, balances, summary images and API order. Personalized receipt responses remain private and uncached.

LINE onboarding defaults: when the current sign-in provider is LINE, prefill an unset nickname from the provider display name, cleaned of controls and limited to 40 characters. Suggest an available 3–24 character application username from the Latin name, with line_user as the Thai-only/empty-name fallback and bounded suffix candidates for collisions. LINE ID is not supplied by this integration. Keep suggestions editable and distinct from a previously saved, immutable username; preserve existing nicknames. Check availability before display and retain the atomic uniqueness check when saving. Keep both fields required, save only on explicit confirmation, preserve the return destination and leave Google onboarding unchanged.

PromptPay precedence for item payers: resolve the linked primary account’s current valid PromptPay first, then the creator-entered participant number if the account has none. Apply the same resolver to QR/payment reads and slip-submission targets, including after account linking or later profile setup. Store the creator’s number as a separate fallback rather than overwriting it with the account value. The editor permits fallback entry for linked accounts without PromptPay and explains account precedence; publication accepts either source. Keep balances, recipient identities, payment evidence and pending verification’s submitted receiver snapshots intact. Public expense and read-only previews still omit receiver numbers. Legacy owner-recipient behavior remains unchanged.

Shared receipt item prices: retain the bold quantity-adjusted line total and show the original unit price beneath it in muted 14px text, right-aligned in the same amount column. Keep discount notes with the item details and the existing discounted total calculation. Preserve Thai/English wording, numeric alignment and wrapping on compact screens.

Receipt item roles: show an explicit Split with line listing consumers (or Everyone), followed by a separate payer line. Keep payer name and paid-upfront wording together as a non-wrapping group spanning the item width, separate from the price column. Extremely long payer names may ellipsize while preserving the action wording and full phrase in the title. Consumer names wrap naturally; line totals, unit prices and discounts retain their existing meanings.

Account-setup explanation: lead with “You’re signed in” and explain that username/nickname setup happens once. Add three compact, unboxed check-mark benefits: friends can find and add the account to bills, nicknames identify who paid, and linked bills to pay can be reopened in one place. Use the existing 15px support type, keep the form immediately below, and label the Thai action Save and continue. Keep required fields, saved-username immutability, LINE defaults and return navigation unchanged; do not imply another sign-in or account registration.

Compact receipt rows: use a two-column grid with the bold 16px item name immediately above its consumer line (2px gap), while total and small unit price occupy the right column across those two rows. Keep the payer phrase together on the next full-width line. Thin horizontal rules and 12px vertical row padding distinguish items without separating each name from its allocation details. Keep fee rows in their existing layout and preserve long-name wrapping/ellipsis and payment calculations.

Natural allocation labels: a single positive-share consumer uses For {name} only (ของ{name}คนเดียว), multiple selected consumers use Split between, and shared-all items use หารทั้งหมด in Thai. Determine single-consumer wording from actual positive custom shares when present, including shared items in one-person bills. Keep this cost responsibility distinct from paid-upfront wording. Hide per-item payer lines when every item has the same known payer participant ID; show them for multiple payers or incomplete payer assignments, without comparing display names. Preserve amounts and allocation math.

Participant ordering for a sole advancing payer: when all items use one known payer participant, put that participant last in the shared receipt’s personal totals. The signed-in account’s own entries keep first priority, including when that account is the payer. Keep other participants stable, keep the original order for multiple/incomplete payer assignments, and do not reorder saved data, API arrays, calculation inputs or shared-image summaries.

Instagram browser guidance: use a dismissible mint notice above login/shared-receipt content, including the PIN gate, only for anonymous Instagram visitors. Keep it in normal flow with a 20px heading, 15px support text, 44px controls and visible focus. Explain the app-menu route to an external browser; offer Copy link with an announced success state and a selected, read-only URL when clipboard access fails. This guidance must not block providers or PIN entry, promise forced browser launching, or appear in normal browsers, signed-in sessions or 404 pages. Payment handoffs reopen the canonical receipt for fresh authorization in the new browser; no PIN, OAuth callback or participant token crosses browsers.

Passkey controls: extend the inherited settings and login surfaces with white paper, mint support states and deep-green actions. Keep the section heading at 20px, body and control labels at 16px, supporting copy at 15px and key dates at 14px, with controls at least 44px high and visible keyboard focus. Settings show named keys with creation/last-use dates, a labeled name field, explicit Add action and inline Disable/Confirm/Cancel controls; disabling retains the key record. Preserve loading, empty, retry, unsupported, cancelled, error and announced success feedback, and explain the disabled Add action at the ten-key limit. Login offers an explicit Passkey action alongside Google/LINE recovery; prompt for device verification only after an action. Reuse existing tokens, flat panels and responsive action wrapping.
