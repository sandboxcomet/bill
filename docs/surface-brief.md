# Bill workspace
Mode: Operate. Scope: dashboard, item editor, sharing, individual payments, authentication and recipient settings.
Primary task: add participants and items, assign consumers, verify per-person amounts, save and share. Visible status must distinguish local draft, persisted draft, published bill, pending slip and verified payment.
Direction: light shared-meal ledger, deep green actions, item-level participant controls and a receipt summary that updates immediately. The dashboard's small example receipt demonstrates the mechanism and is labeled as illustrative.
Constraints: independent repo, independent database, existing bill arithmetic and payment protections. Production domain bill.wonglao.com is a target, not a deployment claim. No migrated data or production credentials are assumed.

## Direction contract

THESIS: A Thai shared-meal ledger that keeps the item-to-person relationship visible while an organizer checks the real payment amount.
OWN-WORLD: Light white/gray paper, deep green actions, Thai Noto Sans with Manrope numerals, consistent stroke icons, dashed receipt subtotals and restrained participant colors.
STORY: Start a meal → add everyone including yourself → enter items → assign consumers → verify per-person totals → save and share → transfer the exact outstanding amount and submit a slip.
FIRST VIEWPORT: Dashboard offers a new bill with a clearly labeled illustrative receipt. Desktop editor puts the live receipt beside the first inputs; mobile retains a bottom total/summary shortcut as the fields scroll.
FORM: A continuous shared-meal ledger: compact item rows, participant selection attached to each item, right-aligned decimal amounts and a running receipt. Responsive stacking preserves the item-to-person grouping. No photographic assets or mock device frames are required for this working surface.

Evidence: direction seed roll 01c1125c ran during setup. The user asked for a recommendation; the main thread proposed and implemented the ledger direction. There is no user-approved generated comp or quality-bar reference, and no exemption from the concept process is claimed. Design review assesses this built direction against the functional brief and craft floor.
