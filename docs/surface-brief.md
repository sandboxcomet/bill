# Bill workspace
Mode: Operate. Scope: home, separate /bills list, item editor, sharing, individual payments, authentication and account settings (nickname and PromptPay).
Authentication: the home introduction, demo and published shared bills are public; private shares require the bill PIN. Shared amount explanations use a participant-scoped token without requiring login. Bill creation, personal bills, account settings and payment pages require login and a complete username and nickname. Payment data, uploads and slip images retain account and participant-token checks. Public home actions lead to login before creating a real bill.
Primary task: add participants and items, assign participants, verify per-person amounts, save and share. Visible status must distinguish local draft, persisted draft, published bill, pending slip and verified payment.
Direction: light shared-expense ledger, deep green actions, item-level participant controls and a receipt summary that updates immediately. The home page's small example receipt demonstrates the mechanism and is labeled as illustrative.
Constraints: independent repo, independent database, existing bill arithmetic and payment protections. Production domain bill.wonglao.com is a target, not a deployment claim. No migrated data or production credentials are assumed.

## Direction contract

THESIS: A Thai shared-expense ledger that keeps the item-to-person relationship visible while an organizer checks the real payment amount.
OWN-WORLD: Light white/gray paper, deep green actions, Thai Noto Sans with Manrope numerals, consistent stroke icons, dashed receipt subtotals and restrained participant colors.
STORY: Start a bill → add everyone including yourself → enter items → assign participants → verify per-person totals → save and share → transfer the exact outstanding amount and submit a slip.
FIRST VIEWPORT: Home offers a new bill with a clearly labeled illustrative receipt and guidance. Personal bills, status filters, search and the empty state live only on /bills, reached through the My Bills navigation item. Desktop editor puts the live receipt beside the first inputs; mobile retains a bottom total/summary shortcut as the fields scroll.
FORM: A continuous shared-expense ledger: compact item rows, participant selection attached to each item, right-aligned decimal amounts and a running receipt. Responsive stacking preserves the item-to-person grouping. No photographic assets or mock device frames are required for this working surface.

Evidence: direction seed roll 01c1125c ran during setup. The user asked for a recommendation; the main thread proposed and implemented the ledger direction. There is no user-approved generated comp or quality-bar reference, and no exemption from the concept process is claimed. Design review assesses this built direction against the functional brief and craft floor.

Account setup: require both username and nickname before protected account or payment workflows. Prefill an existing immutable username as read-only; keep the nickname editable and required at 1–40 characters, with field-level errors. Save the completed setup once and return to the requested workflow. The header nickname opens /settings#nickname, where nickname and recipient details share a single save action. PromptPay may remain unconfigured. The stored nickname is used for shared creator/payment display.

Readability: ordinary body, form labels, inputs and primary buttons use 1rem (16px); helper text uses 0.9375rem (15px), compact metadata no smaller than 0.875rem (14px), and form headings 1.25rem (20px). Desktop and mobile share these reading floors; rem units respect browser font preferences.

PIN entry: exactly four visible digits in four equal boxes, shared by creation/editing and the shared-bill gate. Support numeric keyboards, focus advancement, whole-code paste, backspace correction and leading zeros. Server validation uses the same four-digit contract; existing stored PINs are not changed automatically.

Item payers: new bills show separate consumers and advancing-payer controls per item. The selected payer's PromptPay is shared across their items and edited through an explicit Add/Edit button opening a compact modal dialog. Keep numeric entry out of the inline item row; save commits and cancellation discards local edits. Receipt totals show consumption, advances, outgoing and incoming payments separately, followed by exact debtor-to-recipient transfers. Derive refunds from each item's payer and offset only reciprocal payments within the same pair; third-party debts keep their original recipients. Payment recipient selection switches the QR, slip evidence and owner review as one unit; no outgoing debt means no transfer action. Old bills retain the original recipient behavior until explicitly switched before evidence is submitted.

Brand: the visible logo says only bill, with a custom two-tone lowercase b mark. No Thai brand name or slash divider. Use the matching favicon, a 44px header link target, and compact 36px/40px SVG sizing. Preserve navigation and account behavior.

## Account connections in settings

This is an Operate extension of the existing settings surface, within its 650px content width and green/mint visual language. Keep the account profile form and the connections section distinct. The provider list shows Google and LINE connection status, an explicit connection action for an available unlinked provider, and an unavailable state when the provider is not configured.

After provider verification, show the profiles for review with provider names, display name, username, PromptPay and bill/group counts. For an existing second account, use a native radio group with no default primary selection. Selecting a profile announces which account will be primary and clears prior consent. Require a separate consent checkbox before enabling confirmation. A newly linked identity keeps the current profile without presenting a false choice.

Explain before confirmation that both sign-in identities are retained, existing bills/groups/relationships remain accessible, and participant balances and saved receiver snapshots remain separate. State that the old sessions end and a new sign-in is required. Keep cancel available during review. If confirmation reports expired proof, changed account data or a provider conflict, disable the stale choice and consent, clear the selection, and offer Start over to return to fresh verification. Preserve Thai/English copy, native keyboard control and visible focus within the existing settings layout; this extension does not introduce new design-system tokens.

## Signed-in payment and participant confirmation

Keep the existing shared receipt and amount dialogs useful before login. Amount explanations use the safe expenses response, with no receiver, slip or account details. Opening payment leads through login and, when necessary, the combined username/nickname setup before returning to that participant.

For a manually typed, unlinked participant, show the saved participant name and the signed-in nickname and username together in the existing payment receipt. Use the explicit “Confirm this entry is mine” action before exposing payment controls to a non-owner. Explain that linking keeps the saved name, receiver details and balances intact. Once confirmed, subsequent visits use the account link; do not infer identity from matching names. Explain a different-account or duplicate-account conflict and keep a route back to the shared bill. Owners can continue managing other participants without claiming them. Preserve Thai/English copy, mobile stacking and the established green/mint settings and receipt language; this is an inherited surface extension with no new design tokens.
