---
name: WongLao Bill
description: A practical Thai shared-meal ledger with a running receipt.
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
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1.45
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Manrope, Noto Sans Thai, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Manrope, Noto Sans Thai, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.65
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

# Design System: WongLao Bill

## Overview

**Creative North Star: "The Shared-Meal Ledger"**

Light paper surfaces, deep green actions and a continuous receipt make item assignment and payment amounts easy to scan at a shared table. The visual identity is practical and calm: participants stay next to the items they consume, while totals receive stronger size and contrast than supporting explanations.

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
- **Meal Green** (`green`): primary buttons, active navigation, links and payment totals.
- **Deep Meal Green** (`green-dark`): primary hover and the editor's receipt total.
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
- **Display:** the dashboard statement uses the frontmatter display role; its responsive sizes are 38px, 31px and 37px at the implemented breakpoints.
- **Headline:** global page-heading default, reduced to 29px on narrow editor screens. Share and payment titles use compact variants appropriate to their centered layouts.
- **Title:** section titles; editor panel titles use a compact 16px variant, becoming 15px on phones.
- **Body:** ordinary interface text and controls. Helper copy is generally 11–13px.
- **Label:** field labels and compact supporting text; button labels use 14px at weight 600.
- **Amount:** running receipt emphasis. Summary size adapts to 31px at the intermediate breakpoint and 38px below the single-column breakpoint; shared totals and payment amounts also receive prominent numeric treatment.

**The Decimal Alignment Rule.** Use tabular numerals for financial values and right-align values in comparison rows. Keep currency and amount together where space permits.

## Layout

The shell is centered at a maximum width of 1184px including 32px side padding, yielding 1120px of usable desktop content. Major work sections use 20–24px gaps, with a compact rhythm of 4–16px inside controls and rows. Panels use 25px padding on wide screens, adjusting to 20px at 1000px, 22px at 760px and 18px at 520px.

The desktop editor uses a flexible main column and a 340px receipt column with a 24px gap. At 1000px the receipt narrows to 300px and the gap to 17px. At 760px the editor stacks into one column with 20px outer gutters. The receipt becomes part of the normal document flow, and a fixed bottom total/summary shortcut preserves access while editing. Its safe-area padding and the page's reserved bottom space keep the shortcut usable without covering the final content.

At 520px, an item's name occupies a full row above price, quantity and removal. Participant controls remain attached beneath the same item. Lists, share actions and participant payment rows wrap at this breakpoint. The header navigation moves to a dedicated second row below 760px.

**The Attached Assignment Rule.** Preserve each item's fields and consumer selection as one visual group when stacking or wrapping the layout.

## Elevation & Depth

Working panels are flat: white fill, fine borders and selective pale-green bands create separation. The illustrative dashboard receipt is the deliberate exception, with a soft paper shadow, a slight rotation and a torn lower edge. This physical treatment belongs to the example receipt, rather than every card.

### Shadow Vocabulary
- **Illustrative paper:** `0 12px 28px #163a2220`; used by the example receipt after its entrance animation.

**The Flat Ledger Rule.** Use borders and tonal surfaces for working containers. Reserve lifted paper depth for the illustrative receipt.

## Shapes

Panels use the panel radius; fields and standard buttons use the smaller control radius. Small status tags use the tag radius, participant chips use a pill silhouette and avatars are circular. Fine solid rules organize records; dashed separators mark receipt totals and breakdown boundaries. The recurring icon system uses authored SVG outlines with a 1.7px stroke, rounded ends and rounded joins.

## Components

### Buttons

Compact and explicit. Standard buttons have a minimum height of 46px, centered icon/text alignment and the control radius. Primary actions use Meal Green with white text; hover deepens the fill. Secondary actions use white with an outlined edge, gaining a pale green tint on hover. Compact variants have a 38px minimum height. Active press moves a button down by 1px; disabled controls reduce opacity to 0.58 and suppress pointer interaction.

### Inputs / Fields

White fields have a visible fine border, the control radius and a minimum height of 44px. Labels sit above their fields, helper text sits below, and placeholders use Supporting Sage. Focus adds a 2px green outline with a 1px offset. Number fields use tabular numerals. Checkbox controls use the action green and remain associated with visible labels.

### Chips

Participant chips pair an initial avatar with a readable name and remove action inside an outlined pill. Per-item allocation controls use compact rectangular chips; selected state changes the pale fill and text color while the checkbox preserves an explicit state indication. Four avatar tones identify participants consistently within a bill.

### Cards / Containers

Panels share white paper, a fine Ledger Rule border and rounded corners. The summary has a slightly greener border and an inset pale-green total band. Bill records form a continuous list with dividing rules; hover adds a subtle tint rather than a lifted shadow.

### Navigation

The white header uses muted labels and a deep-green active label with a bottom rule. The active location remains identifiable by the underline. On smaller screens, navigation occupies its own second row. Text links use green and gain an underline on hover. Buttons, links and disclosure controls expose a 3px focus outline with a 4px offset.

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
