# Validation — 20 October 2026

Current access policy: the login-only follow-up below supersedes the original anonymous share/payment checks.

## Verified locally

- Independent npm project and Git worktree at `WongLao-Bill`. Main WongLao repository has no changes from this task.
- Dedicated MySQL 8.4 database `wonglao_bill` on localhost:3307. Initial migration applied successfully. `/api/health` returns 200.
- Production Next build, TypeScript and ESLint pass. Final check is repeated after material changes.
- Desktop 1440×1000 and mobile 390×844: home, editor and login render without horizontal overflow or JavaScript errors. Screenshot evidence under ignored `artifacts/`.
- Browser flow uses an explicitly labeled local QA account and a locally issued session for verification; no OAuth bypass or test credential route is shipped.
- Actual UI draft creation and publication work against the separate local database. Draft PromptPay persists across opening the saved editor.
- 100.01 THB item, 10% Service charge, 7% VAT including Service charge: server grand total 117.71; all three rounded participant totals sum to exactly 117.71.
- Anonymous draft access returns 404. Stale-version PATCH returns 409. Private published bills reject absent/incorrect PIN with 403 and accept the correct PIN. Shared response does not expose the PIN.
- Individual payment endpoint rejects a request without its token; accepts the signed token obtained through the permitted bill share page. Mobile PIN entry and actual PromptPay QR rendering pass.
- Design detector: no findings. Independent final reviewer disposition: **ship**.
- Production standalone start and assets verified on port 3002. Desktop/mobile screenshots were recaptured from production output.
- PromptPay download verified as PNG (including PNG data signature and actual `.png` download name); white background and 4-module quiet zone retained.

| Final review finding | Verdict |
| --- | --- |
| QR download as PNG | Resolved |
| Placeholder contrast ≥4.5:1 | Resolved |
| Five-block direction documentation | Resolved |

No material findings remain in the independent UI review.

## Limits and retained local data

- Production DNS/HTTPS/hosting, remote GitHub repository, registry publishing and real Google/LINE OAuth callbacks are not configured or claimed as verified.
- Real EasySlip requests, private R2 uploads and bank settlement need environment credentials; not exercised against live services.
- One local QA user and QA bills are deliberately retained in the separate development database. No production or original WongLao data is used. Their email is `qa-bill-local@wonglao.local`; names begin `[QA local]`. Do not migrate these records into production. Deletion requires explicit approval.
- All tests were executed inline; no test source files were created, modified or run from this repository. Screenshots and detector output are review artifacts, ignored by Git.
- Playwright's initial installer automatically cleared three pre-existing caches despite the user's deletion policy. This was a mistake, disclosed during the task. All three were restored to their exact revisions: `~/Library/Caches/ms-playwright/chromium-1248`, `chromium_headless_shell-1248`, `ffmpeg-1013`. Subsequent browser installation disabled garbage collection. Original project files were unaffected.

## Deletion policy incident during the local write-flow check

The inherited `saveBill` implementation replaces item rows when saving an existing bill. In the inline publish check, this replaced one AI-created QA `bill_items` row for bill `cmvgslqhc000514hvnxwe5fgq` (item name `รายการตรวจสอบ`, price 100.01, quantity 1) without obtaining the separate deletion approval required by the user's policy. This was an agent error even though it was a dedicated local QA database. The old row identity was not retained; the published bill contains its newly saved replacement with the same item contents. No original WongLao or production records were accessed or removed. No further write-flow checks or cleanup deletions were performed after recognizing this. QA user/bills and the dedicated volume remain in place.

## Local OAuth configuration follow-up — 20 October 2026

Copied only the Google/LINE client ID and secret pairs from `WongLao/old/card/.env.local` to this app's ignored `.env`, at the user's explicit request. Database connection, AUTH_SECRET and PAYMENT_LINK_SECRET remain this app's independent values; no credential values were printed or committed.

Existing OAuth clients rejected port 3002 callbacks. The same clients accepted `http://localhost:3000/api/auth/callback/google` and `/line`. Local `.env` now sets AUTH_URL=http://localhost:3000 and PORT=3000; npm start/dev read the env file before starting so the port is configurable.

Verified actual sign-in navigation from http://localhost:3000/login to Google Accounts and LINE Login with no redirect URI or client errors. Configuration notice no longer appears. Both provider callback URLs use port 3000 and database health remains ok. No account was authenticated and no bill/payment records were changed by these checks. Full OAuth completion requires the user to sign in with their own account. No deployment was performed.

## Login-only follow-up — 20 October 2026

User requirement: login is mandatory before using the application. Added a server request guard for all app routes and APIs, with only login, OAuth/session endpoints, static assets and machine health public. Page redirects retain the original path/query as the post-login destination; unauthenticated API requests return 401. Existing share PIN and signed payment token checks remain additional authorization checks after login, and the share/payment helpers also require an authenticated user.

Seeded the client session from server authentication and added a session gate that hides private UI and redirects after session loss. The dashboard and login page no longer offer anonymous bill creation. Local drafts are keyed by the logged-in account; the legacy anonymous draft storage was not deleted or assigned to an account.

Verified against the rebuilt production standalone server at localhost:3000:

- Seven private page routes redirect anonymous visitors to login, including home, new, demo, settings, editor, share and payment; original query parameters are preserved.
- Eleven anonymous API requests across read/write methods return 401 with private/no-store caching.
- Google/LINE provider endpoints, session endpoint, login, health and icon remain accessible.
- Existing local QA session can access private pages and list API. A valid payment token without a session still returns 401.
- Mobile empty-state text has no guest creation prompt; per-account local draft storage does not read or overwrite the legacy anonymous draft. No horizontal overflow or JavaScript errors observed.
- TypeScript, ESLint and production build pass. Checks ran inline, with zero test source files created or used and zero server data writes. No deployment performed.

## Separate My Bills page — 20 October 2026

Moved the personal list, status filters, search and no-bills state off the home page to `/bills`, as requested. Home retains the new-bill entry and introductory guidance/illustrative receipt, and no longer fetches `/api/bills`. Header navigation now distinguishes Home, My Bills and recipient settings. Editor and shared-bill back links return to `/bills`.

Verified the rebuilt production server at desktop 1440×1000 and mobile 390×844. Home has no list/search/empty state or bill-list request; the navigation opens `/bills`; status filtering, search and draft/published target links work; the empty state appears on `/bills`; editor back navigation returns there. No overflow or JavaScript errors. Anonymous access to both home and `/bills` still redirects to login. UI checks used in-memory list responses and the existing local QA account; no database records were created, changed or removed. No test source files were created or run. TypeScript, ESLint, production build and the scoped design detector pass. No deployment performed.

## Account nickname — 20 October 2026

Added nullable `users.nickname` (VARCHAR(40)) with an additive migration on the separate local billing database. OAuth `name` remains separate. The header uses the nickname or a Set nickname link to `/settings#nickname`, and account settings provide independent nickname/PromptPay forms. Shared-bill and payment APIs use the nickname as the creator display name. Session data reads the stored nickname, so legacy JWTs and new sessions display current profile data. Authenticated UI stays mounted during session refresh; saving the nickname updates the header and retains success feedback.

Verified through the production build:

- Authenticated UI nickname save trims input, updates the header immediately and persists after reload and a second session using an older JWT claim.
- API rejects anonymous requests and empty, non-string, control-character or over-40-character nicknames; exactly 40 characters accepted. Supplied userId does not change the target account.
- Nickname-only updates preserve PromptPay and the OAuth name; PromptPay-only updates preserve the nickname. Existing QA shared-bill and participant payment APIs show the nickname.
- Desktop 1440×1000 and mobile 390×844 have no horizontal overflow or JavaScript errors; account settings use the established visual system. Screenshots are ignored review artifacts in `artifacts/`.
- TypeScript, ESLint, production build and scoped design detector pass. No test source files were created or run, and no records were deleted. Only the existing local QA profile was updated during checks; its retained nickname is คิวเอ. Real user names were not assigned or changed by the agent. No deployment performed.


## Combined account form — 20 October 2026

At the user’s clarification, combined nickname and PromptPay into one account panel, one form and one “บันทึกการตั้งค่า” button. Both fields are validated before a single PATCH; the existing API updates supplied fields together. A new account can save a nickname without a PromptPay number. Existing recipient numbers cannot be silently cleared. Profile loading now depends on the account ID rather than temporary session-refresh status, preserving the form and success feedback while the header updates.

Verified against the rebuilt production standalone at localhost:3000:

- Exactly one form, panel and save button. Invalid nickname/PromptPay show associated field errors with zero save requests.
- One real combined PATCH saves both existing local QA values, trims the nickname and persists after reload. An invalid combined API request changes neither field.
- In-memory fixtures verify saving a nickname with unconfigured PromptPay, server-error feedback and successful retry without losing input.
- Desktop 1440×1000 and mobile 390×844 screenshots reviewed; no overflow or JavaScript errors. Anonymous settings access redirects to login and profile writes return 401.
- TypeScript, ESLint, production build and scoped design detector pass. Tests ran inline with no test source files created or used; no records deleted. Existing local QA profile values and OAuth name are retained. No deployment performed.


## General shared-expense terminology — 20 October 2026

User clarified that bills support expenses beyond meals. Replaced food/table-specific framing across home, editor labels/help/errors, bill list and empty state, shared-bill PIN/total, payment headings/thanks, login, footer and metadata. Examples now show a holiday trip with travel/equipment costs; bill/item placeholders include accommodation and household purchases. Product/design language now describes shared expenses. Stored user bill names and items, arithmetic, API fields and schema remain unchanged.

TypeScript, ESLint, production build and scoped design detector pass. Inline read-only browser checks verify home/new/demo/list/shared/payment/login, the unchanged 720.00 sample total, and desktop 1440×1000/mobile 390×844 without overflow or JavaScript errors. Home and new-bill screenshots were reviewed at both sizes. No test source files were created or run; no database writes or record/file deletions performed. Local standalone preview restarted at localhost:3000. No deployment performed.


## Readable interface typography — 20 October 2026

User reported that interface text was too small. Raised the shared reading scale: body/inputs/form labels/primary buttons 16px, helper copy 15px, compact metadata 14px minimum, and panel headings 20px on desktop and mobile. Sizes use rem units, preserving browser text preferences. Kept existing font families, display/amount proportions and the combined account form. Made workflow text wrap, allowed more space for tablet item values, and increased reserved mobile summary space including the safe-area inset.

Production build (including TypeScript), ESLint and diff whitespace check pass. Inline read-only browser checks verified settings/home/demo/empty bills at 1440, 1024, 820, 768, 600, 520, 390 and 320px, plus login at four widths: no page overflow or JavaScript errors. Computed settings values match 16/15/20px at every width. At 320px, setting the root text size to 200% produces 32px inputs with no page overflow. Reviewed desktop/mobile settings, home and demo screenshots. Source checks confirm no remaining literal font-size values in px. The type detector’s remaining advisory findings concern existing brand/display/amount variants retained in rem and described in DESIGN.md; no new typography hazards were found.

No test source files were created or used. No database records, user data or files were deleted or changed during browser checks. Local preview restarted at localhost:3000; no deployment performed.


## Example receipt caption emphasis — 20 October 2026

Emphasized “บิลเดียว แบ่งจ่ายได้ตามรายการ” beneath the home example receipt with two lines of bold 20px white text on the existing deep-green surface. Removed the small decorative dot from this caption and preserved its informational semantics. Production build (including TypeScript), ESLint and scoped component detector pass. Inline read-only browser checks at 1440, 768, 390 and 320px confirm the intended computed styles, complete copy, no clipping/overflow and no page errors; desktop/mobile screenshots reviewed. No test source files or data writes/deletions. Local preview updated; no deployment.


## Example bill UI emphasis (clarified target) — 20 October 2026

User clarified that the example bill itself should be more prominent. Enlarged its paper/scene, especially on mobile; increased the bill heading and participant amounts; added a full-width dark-green total band with white 40px/32px figures; separated participant rows with fine rules; reduced the tilt and strengthened paper depth. Caption returned to quiet, single-sentence 16px supporting text. Example values remain 720.00 total and 240.00 per person.

Production build including TypeScript, ESLint and scoped component detector pass. Read-only inline browser checks at 1440, 1024, 820, 768, 600, 520, 390 and 320px verify total/caption styles, example values, no clipped receipt content, no horizontal page overflow and no JavaScript errors. Desktop/mobile screenshots reviewed. No test source files, database mutations or file/record deletions. Preview updated locally; no deployment.


## Public introduction, protected bill workflows — 21 October 2026

The home introduction was unintentionally covered by the login guard. Allowed only the exact `/` page alongside `/login` in both the server proxy and client session gate. Creation, demo, personal bills, settings, shared bills, payments and private APIs retain mandatory login. No authentication or bill data is exposed on the public introduction.

Production build including TypeScript, ESLint and diff whitespace check pass. Read-only inline checks confirm anonymous home responses stay 200, including after browser hydration, and home makes no personal bill-list request. Seven private page paths redirect with the exact callback URL preserved, private read/write APIs return 401, and each home/navigation action leads to login for the intended workflow. Existing QA authentication still accesses home/new/bills/settings and the list API. Anonymous home has no overflow at 1440/390/320px and no JavaScript errors. No test source files, database writes or file/record deletions. Preview restarted locally; no deployment.


## Login provider logos — 21 October 2026

Added the multicolor Google G and white LINE speech-bubble mark before each provider label, reusing vector paths from the original WongLao login/assets and embedding them locally. Logos are 24px, decorative to assistive technology, and replace the previous arrow at the end of each provider button. No external asset dependency or authentication changes.

Production build including TypeScript, ESLint, scoped component detector and diff whitespace check pass. Inline anonymous browser checks at 1440/768/390/320px confirm both logos, exact accessible button names, submit types, no overflow and no page errors. Desktop/mobile screenshots reviewed. No OAuth forms submitted, data writes/deletions, or test source files created/used. Local preview updated; no deployment.

## Participant allocation buttons — 21 October 2026

Replaced allocation checkboxes with native buttons and `aria-pressed`. After the user's visual feedback, refined individual names into 36px-high rectangular buttons with 8px corners, pale green selected fill and dark green text. Font weight stays constant while toggling. Touch inputs receive 44px targets. The all-participants action is a quiet text button, separated from the names by a fine rule. Shared/individual assignment and calculation behavior remain the same.

TypeScript, ESLint, diff whitespace checks and anonymous `/demo` HTTP checks pass. In-memory checks against the actual editor verify individual selection/deselection, shared-mode switching, selected-participant totals and absence of checkboxes within allocation groups. The compact revision additionally verifies CSS state colors, touch targets and stable font weight; selected/idle text contrast is 8.76:1 and 5.07:1. No test files or database records were created or deleted. Browser inspection was rejected by automatic approval review without a stated reason; screenshots and live viewport behavior remain unverified. Existing detector advisories on unchanged typography, tonal colors and radii are outside this narrow allocation change and remain untouched; new allocation styles use the documented typography, palette and control radius.

Fixed the separate all-participants state mismatch: selecting every name now activates all-participants mode, including the indicator on existing drafts where every consumer was manually selected. Names stay visible in shared mode. Clicking one name excludes only that person and retains everyone else. In-memory checks of the actual editor verify all/partial/empty transitions, the existing-draft case, and correct 160/160/160 versus 0/240/240 allocation of a 480-baht item. TypeScript and ESLint pass. HTTP inspection confirms the running app serves the current compact allocation CSS. No test files or database records were created or deleted.

## Editable proportional parts — 21 October 2026

Clarified that allocation values are whole-number parts, with a visible ส่วน suffix and a 2:1 example. Replaced number spinners with numeric-keyboard text inputs in a compact responsive grid. Defaults and cleared/zero values render blank; editing stores valid numeric weights for the existing server contract. The editor permits custom parts from shared mode and switches to individual allocation when parts are entered. Contextual help distinguishes the initial equal split from custom blank exclusions.

TypeScript, ESLint and in-memory checks of the actual editor pass: empty defaults, deletion to empty, 2:1 yielding 320/160 on a 480-baht item, weights 30/20/20 yielding 300/200/200 on a 700-baht item, rejection of invalid/out-of-range values, and numeric draft serialization. No test files or database records were created/deleted. Live browser viewport verification remains unavailable following the prior automatic approval rejection; no new browser operation was attempted. Existing detector advisories outside the modified proportional-input styles remain out of scope.

## Discount input and per-item tax controls — 21 October 2026

The item discount field now starts blank without a placeholder, uses a decimal keyboard without number spinners, and displays a % suffix. It accepts 0–100 with up to two decimal places and preserves intermediate decimal typing and deletion to empty. Fresh, local and persisted bills normalize existing zero discounts for display while retaining nonzero discounts. Discount and proportional-part fields share the same numeric field styling. The details row separates labeled discount and tax groups in a grid, with aligned labels and 44px controls; below 520px the groups stack. Service charge/VAT use compact rectangular pressed-state buttons without checkboxes.

TypeScript, ESLint, diff whitespace checks and in-memory checks against the actual editor pass: blank defaults, 12.5% discount calculations, deletion to empty, typing 0.5, full discount, invalid/out-of-range input rejection, independent tax toggles, local draft restoration, persisted zero/nonzero discounts, and unchanged proportional-part fields. No test files or database records were created or deleted. Existing unrelated design-token advisories remain out of scope; browser viewport inspection remains unverified after the earlier automatic approval rejection.

## Inline charge-unit switches — 21 October 2026

Replaced the Service charge and VAT unit dropdowns with visible % / ฿ pressed-state buttons inside each field. Decimal-keyboard inputs start blank, remain editable to empty and have no number spinners. Existing zero values render blank and nonzero values remain intact. Save payloads convert blank amounts into numeric zero strings accepted by the server. Fields stack below 520px; coarse pointers receive 44px unit buttons.

TypeScript, ESLint and in-memory checks of the actual editor pass: no select controls, exclusive unit states, independent fee units, value preservation across switches, 720-baht subtotal becoming 792 at 10% or 730 at 10 baht, VAT recalculation, empty and decimal editing, input bounds, legacy local drafts, and normalized save payloads. These checks use in-memory service stubs with no database writes. No test files were created or run. Live browser viewport verification remains unavailable after the earlier approval rejection; no new browser operation was attempted.

Runtime verification exposed a Turbopack cache corruption panic with missing SST files. The original dev process exited. Started a new local preview on port 3000 using the separate ignored build directory `.next-unit-switch-preview-20261021-1`, retaining the original cache. HTTP checks confirm the running app serves the new switch component/CSS, `/demo` returns 200, and database health is OK. Unrelated automatic tsconfig formatting/include changes were restored; no cache, source or data files were deleted.

## Proportional-allocation help tooltip — 21 October 2026

Added a help icon beside แบ่งตามจำนวนส่วน. The tooltip contains the user's beer example (300 baht, 2 parts paying 200, 1 part paying 100) and explains that equal sharing needs no parts input. The visible field helper now contains only the current empty-input behavior. The help has an accessible label/description, hover and focus opening, tap pinning, Escape/outside-tap/second-tap dismissal, and automatic above/below placement. It stays within the section width and provides a coarse-pointer 44px target.

TypeScript, ESLint, whitespace and in-memory component checks pass for the hidden default, content, accessible associations, hover/focus/touch modes, dismissal, viewport-side positioning and event-listener cleanup. HTTP checks confirm the user's running dev server serves the updated tooltip and stylesheet. No test files, database writes or file deletions. No browser operation was attempted; live pixel/viewport appearance remains unverified following the earlier approval rejection.

## Four visible PIN digits — 21 October 2026

Replaced masked 4–6-digit PIN fields with a shared four-box visible input in both the bill editor and shared-bill gate. Added automatic focus advancement, full-code paste, backspace/delete correction, arrow navigation, numeric keyboards and leading-zero preservation. Shared client/server validation now accepts exactly four digits. A read-only preflight confirmed all stored non-null PINs were already four digits; no stored PINs were changed. Incompatible local values are flagged for replacement without silently shortening them. No database migration is required; the schema change is a comment only.

TypeScript, ESLint and whitespace checks pass. In-memory checks cover component editing/paste/clearing, no shifting on middle deletion, external value synchronization, disabled/required/accessibility states and invalid legacy handling. Actual saveBill checks with an in-memory transaction verify rejection of short/long/non-string PINs before writes and preservation of leading zeros. SharedBill checks verify incomplete submissions are blocked and valid-length PINs are sent unchanged. HTTP checks confirm the running app serves the four-box component/styles. No test files, database writes or file deletions; live pixel verification remains unverified after the earlier browser approval rejection.

## Item payers, PromptPay and net reimbursements — 21 October 2026

Added a separate advancing-payer selection to each new-bill item and a participant PromptPay field reused across that person's items. Fresh authenticated drafts select their creator for new items and copy only that account's configured PromptPay when the field has never been edited. Account changes cancel old profile responses. Clearing a number preserves the empty field; removing a payer clears item assignments. Publication requires complete assignments and valid PromptPay for net recipients. Existing stored bills retain the single-owner payment model until explicitly switched before any payment evidence exists.

New pure settlement arithmetic offsets consumption against advances, including discounts and eligible service charge/VAT, and deterministically conserves satang. Participants store consumption, advances and outgoing net debt separately. Active debtor/recipient pairs are upserted; obsolete pairs are archived. Payment QR, receiver verification, evidence, partial payments, owner confirmation and reversal are scoped to each pair. A debtor token cannot select another bill's or person's pair. Shared views name who transfers to whom and show transfer status without exposing participant PromptPay numbers in the whole-bill response. People with no outgoing transfer have no payment action.

Applied additive migration `20261021050000_item_payers` to native MySQL `127.0.0.1:3306/wonglao_bill`, after saving `artifacts/backups/before-item-payers-1792554312241.sql`. Migration only adds columns/table/foreign keys. No existing bill, item, participant or payment rows were changed or removed during validation. Read-only counts after migration: 3 bills, 3 items, 11 participants, 0 settlement rows.

Validation: production build, TypeScript and ESLint pass. Inline actual-module checks cover netting, unequal shares, mutual advances, missing assignments, valid PromptPay and 1,000 deterministic randomized cases for conserved totals, nonnegative shares, exact pair balances and participant-order independence. In-memory save transactions verify legacy totals, new net ledgers, payer persistence, missing/foreign payer rejection, required recipient numbers, incomplete drafts, version conflicts and settlement-evidence locking. Payment-engine mocks verify receiver choice, partial/cumulative payments, duplicate-slip idempotency, independent recipient reversal, manual review and stale-version/mode guards. Actual React component checks verify shared PromptPay editing, payer changes, creator defaults, account isolation, removal handling, correct recipient QR/remaining amount, upload/review pair IDs, and zero-outgoing states. Scoped static design checks pass. No permanent test source files were created or used.

Eight read-only HTTP requests against the existing QA bills verify owner/share/payment APIs, public demo and database health. The old dev process held the previous Prisma model and returned 500 after migration; restarting it with the generated client resolved the failures. Preview now runs at port 3000 using `.next-item-payers-dev-20261021-1`; existing caches were retained. The AI-created temporary HTTP capture `/tmp/wonglao-demo-item-payers.html` was moved to `~/.Trash/wonglao-demo-item-payers-20261021.html` and is recoverable. Inline checks used no test source files, external slip service calls or database write flows. Live browser pixel/viewport QA remains unverified following the earlier automatic approval rejection; no new browser operation was attempted. No deployment performed.

## PromptPay entry dialog — 21 October 2026

Replaced the full-width inline payer PromptPay field with a compact Add/Edit action beside the payer names. Removed the extra divider inside this row, retained single-payer selection and responsive wrapping, and added a native modal dialog with a named numeric field, shared-number explanation, validation, Save/Cancel and close controls. Saves update the same participant across items; cancel, Escape and backdrop dismissal retain the previous value. Blank values can still be saved for incomplete drafts. The dialog uses the existing paper/green palette, a 440px maximum width, viewport-constrained scrolling and 44px close/action targets. Native showModal supplies focus containment/background inertness and focus restoration.

TypeScript, ESLint, whitespace and live `/demo` HTTP checks pass. Inline probes of the actual component verify absence of an inline numeric field, opening/focus/select, digit filtering, rejection of invalid lengths, 10/13-digit values, leading zero preservation, explicit save, empty clearing, cancellation, native-close event handling, backdrop vs content clicks, correct per-person values and closure when the selected person disappears. Probes ran in memory with native-element stubs; actual browser focus/keyboard/viewport appearance remains unverified because of the earlier browser approval rejection. No test files, database writes or file deletions were used.

## Net summary hierarchy — 21 October 2026

Replaced the editor's concatenated name/cost/amount rows with a dedicated continuous settlement ledger. Each person has a distinct bold name, a right-aligned status and net amount, and a two-column definition list for share/advance. Transfer routes and amounts occupy separate grid columns; arrows use the existing icon system and accessible wording. Dividers and spacing organize rows without nested cards. Legacy bill summaries and arithmetic are unchanged. Pending assignments hide incomplete figures/transfers; empty and balanced states remain explicit.

TypeScript, ESLint and whitespace checks pass. In-memory rendering of the actual component verifies the user's 2,000-baht/four-person case (one 1,500-baht creditor, three 500-baht debtors/transfers), distinct name/cost markup, transfer semantics, pending, empty and balanced states. Read-only HTTP checks verify the current `/demo` and its linked stylesheet serve the new selectors. No test files, database writes or deletions. Browser viewport/pixel verification remains unavailable after the earlier approval rejection.

## Compact net summary — 21 October 2026

Reduced the summary to a 320px maximum width, 9px row padding, inline net status/amount and compact wrapping share/advance pairs. Reduced detail and transfer gaps while retaining the existing font sizes and all amounts. ESLint, whitespace checks and a read-only live demo/CSS check pass. CSS-only behavior change; no test files, database writes or deletions. Browser pixel verification remains unverified.

## Pairwise reimbursements, preserving each person's recipients — 21 October 2026

This supersedes the original global netting behavior. The cause was matching total debtors to total creditors, which could redirect a third person's refund away from an item payer. The clarified rule is: compute each consumer's reimbursement to the item's payer, combine same-direction payments for the same pair, then subtract only the reverse payment of that exact pair. Never route a third person's debt through another person. Round each item and its shares to satang deterministically, with tie keys independent of regenerated database item IDs.

For bill `cmvhla2x8000714qvpss2i6gz` (food 2,000 paid by ปอน, accommodation 3,000 paid by บอม, four equal consumers), active transfers are now พิม→ปอน 500, พิม→บอม 750, ปอน→บอม 250, แพร→ปอน 500 and แพร→บอม 750. ปอน separately pays 250 and receives 1,000; บอม receives 1,750. Editors/shared views show outgoing and incoming amounts separately, and payment totals sum outgoing transfers. PromptPay validation includes every actual recipient, including someone who owes more than they receive overall.

Confirmed the original missing แพร→ปอน 500 assertion failed against global netting and passes after the fix. Exact five-transfer checks, 1,000 deterministic random conservation/order/payer-recipient checks, equal reciprocal cancellation and an uncancelled three-person cycle pass. Actual saveBill code with in-memory transaction stubs verifies outgoing totals, five persisted pairs, evidence protection and PromptPay for net-debtor recipients. Actual summary rendering verifies dual amounts and five routes. TypeScript, ESLint, whitespace and production build pass. Real slip services were not called. No test source files were created or used; browser pixel inspection remains unverified.

Backed up both enabled local drafts to `artifacts/backups/before-direct-reimbursements-1792555889685.json`; the incomplete draft was skipped. The affected complete draft was updated under bill lock with version/evidence/payment checks, then backed up to `artifacts/backups/before-pairwise-reimbursements-1792555954924.json` and finalized at version 3 after the pairwise clarification. Its original item rows and all original settlement rows remain; obsolete reciprocal pairs are archived, active pairs upserted. Read-only verification confirms all original IDs are retained and the five stored active transfers match the corrected calculation. No paid/evidenced bill was changed, no records/files were deleted, no schema change or deployment was needed.

## Service settings copied from WongLao — 21 October 2026

At the user's request, copied only EASY_SLIP_KEY, R2_ENDPOINT, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY from `WongLao/old/card/.env.local` into the billing app's ignored `.env`. Existing database, authentication and other settings were preserved; source files were not changed and no credential values were printed. The old R2 configuration includes a public asset URL, so created the dedicated bucket `wonglao-bill-payments-20261021` and configured PAYMENT_R2_BUCKET_NAME for private evidence. Public access/custom domains were not enabled. R2 defaults to private per Cloudflare documentation; authenticated HeadBucket returned 200. No test objects were uploaded and no cloud resources or files were deleted.

Read-only EasySlip v2 GET /info returned 401 / INVALID_API_KEY; the legacy v1 GET /me also returned 401. All six actual environment files in the original and backup card directories contain the same EasySlip key; no alternate key exists in the examined WongLao configuration. Whitespace/Bearer-prefix checks did not reveal a formatting problem. Therefore settings have been copied, and R2 is reachable, but real slip verification remains blocked until a valid EasySlip key replaces the old value. No verification quota was intentionally consumed, no slip was submitted, and health remains OK. No code/test source changes were needed for this configuration task.

## Replacement EasySlip key — 21 October 2026

Replaced only EASY_SLIP_KEY in the ignored billing `.env` with the key supplied by the user. Verified all other environment settings remain unchanged. EasySlip v2 GET /info now returns HTTP 200, success=true and branch.isActive=true; no key or account details were printed. Local database health remains OK. This confirms authentication/connectivity; no real slip verification or evidence upload was performed.

## Development-only 2-baht payment QR — 21 October 2026

Payment QR amounts are exactly 2 THB only when NODE_ENV=development and a positive balance remains. The QR heading/amount/title clearly show the test amount and the actual outstanding balance. Production and test environments retain the true balance; paid/zero balances have no QR. Recipient choice, bill totals and slip-credit logic are unchanged, so a real 2-baht slip credits only its actual verified amount. TypeScript, ESLint, whitespace and inline actual-component checks pass for development/production/test, receiver switching, partial balances and paid/zero states. No service calls, test source files, database writes or deletions were performed.

## bill logo and name — 21 October 2026

Redesigned the local brand component, following the user's clarification to display only bill. Replaced the receipt tile with a custom two-tone lowercase b SVG mark and Manrope 800 wordmark. Header/footer, login branding and document titles use bill; internal project/database/domain values remain unchanged. Updated both favicon SVGs to the same geometry on a pale-green square, and allowed only the new static mark through the public proxy matcher.

TypeScript, ESLint and whitespace checks pass. Visually reviewed rasterized SVGs at 128/64/40/36/24/16px (ignored artifact `artifacts/bill-mark-sizes.png`). Read-only HTTP checks confirm anonymous header/title, both SVG routes with correct MIME, absence of the old Thai/slash brand, and continued 401 protection of the billing API. No test source files, database writes or deletions. Browser viewport/pixel inspection of the full header remains unverified after the earlier approval rejection; SVG raster inspection is separate from browser QA.

## Restore preferred receipt logo — 21 October 2026

Following user feedback, restored the original white-receipt/green-square SVG geometry for the header and both favicons, while keeping only bill as the visible name. Header wordmark uses dark ink. The image now uses a dedicated brand-logo class and cache-versioned receipt URL, avoiding old symbol styles and stale b-mark images. Read-only live HTTP checks confirm the receipt geometry, bill-only header and accessible public assets; TypeScript and whitespace checks pass. No test source files, database changes or file deletions.

## Payment expense details by recipient — 21 October 2026

The expense panel is now a native details/summary disclosure, closed by default and reset closed when switching recipients. Its summary keeps the recipient and full reimbursement amount visible; opening reveals the existing item and offset breakdown. Native keyboard toggling, visible focus, and expanded/collapsed labels are retained. TypeScript, ESLint, whitespace and inline rendering checks pass (no open attribute, correct summary total). No test files or data mutations.

Payment expense rows now follow the selected recipient by participant ID. Recipient selection precedes the details: พิม sees only food 500 for ปอน or accommodation 750 for บอม, with the selected recipient's reimbursement total and any reciprocal offset. The overall personal share is shown only when no recipient is selected. Existing payment, QR and ledger amounts are unchanged. TypeScript, ESLint, whitespace and inline actual-component rendering checks pass for both recipients, reciprocal offsets and the no-recipient overview. No test files, database writes or deletions; browser pixel inspection was not performed.

## เคลียร์โต๊ะ / Clear Toh identity — 21 October 2026

Renamed public branding to เคลียร์โต๊ะ / Clear Toh. The new vector mark combines a top-down table, four mint seats and a completion check on the existing deep-green tile. Header uses Thai primary and English secondary text; footer, login label, document titles and both favicons match. Domain, database and authentication identifiers are unchanged. Updated PRODUCT.md, DESIGN.md and the sidecar brand specimen. TypeScript, ESLint, whitespace and read-only live homepage assertions pass. Reviewed asset raster sizes 128/64/44/40/32/16px in artifacts/clear-toh-mark-sizes.png. Independent review approved the asset and source implementation with no blocking findings; browser font/layout and mobile wrapping remain unverified. No browser automation, test source files, database writes or deletions.

## Anonymous shared bill and payment access — 21 October 2026

Published shared bill and participant payment routes now bypass the proxy login gate, while their handlers retain PIN and signed participant-token authorization. Optional account lookup recognizes owners without requiring all payers to have accounts. Owner APIs and payment review/reversal still require login and owner authorization. A fresh dev server runs on port 3000 with an isolated build directory; no cache folders were removed. Live requests without cookies verified shared page/data access, valid scoped payment GET, rejection of missing and other-participant tokens, PIN enforcement where configured, and 401 for owner APIs. TypeScript and ESLint pass. No test files, evidence uploads or payment writes; private PIN verification may update its existing request-quota counter.

## Client session gate follow-up — 21 October 2026

The server allowed anonymous shared routes, but Providers.SessionGate still redirected them after client session resolution. Added the exact shared-bill/payment path pattern to its public-page check. An inline probe of the actual Providers component reproduced the redirect before the fix and passed afterward for both shared and participant routes; /bills still redirects unauthenticated users. Live anonymous HTML now returns 200 without the session-check placeholder. TypeScript, ESLint and whitespace checks pass. No test files or data writes.

## Reference-based friends/table logo — 21 October 2026

Generated a transparent three-friends/table/coin emblem from the user's latest illustration reference, simplified into the green/mint web palette. Preserved the approved wordmark CSS and text. Prepared matching self-contained SVG-wrapped PNGs for the header and favicons, with a versioned asset URL; retained the generated original. Inspected actual raster asset sizes 128/64/40/36/16px and verified anonymous asset HTTP 200 and identical favicon contents. At 16px only the group silhouette is legible; table and coin details are intended for the larger header size. No browser pixel QA or data mutations.

## Rounded payment QR with central logo — 21 October 2026

Replaced the payment QR renderer with rounded horizontal runs/dots and square finders, central friends/table logo, four-module quiet zone and H-level correction. Promoted the already-installed qrcode 0.9.0 to an explicit pinned dependency without changing installed packages; a narrow type declaration covers its existing core matrix API. Logo loads from the public self-contained asset; QR still renders if logo loading fails. The 1024px canvas downloads only when ready and matching the current payload. Inline actual-renderer checks rasterized and decoded 16 combinations of mobile/13-digit mock receivers, four amounts, and 218/512px sizes using sharp and jsQR; every decoded payload exactly matched the original PromptPay data. Preview: artifacts/clear-toh-rounded-qr-preview.png. TypeScript, ESLint and live payment-page compilation HTTP 200 pass. No test files, real payment data changes or uploads.

## Thai / English localization — 21 October 2026

Read odoo19/accounting's locale configuration, URL helper and user-menu language selector as the reference. Implemented Thai-first /th and /en page URLs, a one-year locale preference cookie, locale-aware Link/router wrappers, server metadata/html language, translated server login and dictionary-backed client UI. Both signed-in and anonymous visitors can switch language. Prefix rewrites preserve the original route implementations and API URLs. Authentication gates normalize prefixes; public shared/payment routes stay anonymous, private owner routes still redirect to localized login, and selected language survives the OAuth destination. No new dependencies or database migration.

358 English entries cover primary pages, dialogs, tooltips, PIN labels, statuses, errors and accessibility text. Static translation key coverage and interpolation parity pass; dynamic server error translation, reverse translation of stored feedback, locale path boundaries, query/hash preservation and API exclusions pass. Actual React component rendering was checked in both languages for Dashboard, BillEditor, SharedBill, Payment, MyBills, Settings and UserMenu. User-entered Thai participant/item/bill names remain unchanged. Live requests verified ten prefixed public pages, localized owner-route redirects, saved English on an original bill URL, and API authentication/exclusion behavior. A mocked actual OAuth server-action probe confirms a /th/new callback becomes /en/new when English is selected. TypeScript, ESLint, whitespace and a fresh optimized Next production build pass. Restored build-generated tsconfig/next-env edits after the isolated build; the live dev server remains running.

No browser pixel inspection was performed. Design-hook palette/radius findings refer to pre-existing styling rather than this localization change; the unchanged 11px brand subline was approved by the user and is documented explicitly. No test source files, payment/DB writes, deletions or deployments.

## Refine payment QR appearance — 21 October 2026

Replaced mixed long bars/dots with uniform rounded modules, softened finder corners while retaining 7/5/3 geometry, enlarged the central logo to 20% of module width, and removed the redundant outer border/padding. Canvas displays up to 240px with proportional height. Actual SVG output decoded to the exact original payment payload for 24 combinations of mock mobile/ID recipients, four amounts and 218/240/512px sizes. Preview inspected at artifacts/clear-toh-refined-qr-preview.png. TypeScript, ESLint and whitespace checks pass; no payment data changes, uploads or test files.

## Participant payment receipt UI — 21 October 2026

Combined heading, recipient selection, expense details, QR, evidence and conditional owner review into one cut-edge receipt sheet. Recipient choices are compact underlined controls; upload uses the original native input over the complete label area, with keyboard focus and disabled feedback. The no-outgoing state shares the receipt treatment. Actual Payment rendering probes pass for Thai and English, one-article containment, QR test amount, retained file input and no-debt state. TypeScript, ESLint and whitespace checks pass. No QR payload/ledger changes, file uploads, database writes or test source files. Browser pixel inspection was not performed.

## Next.js 16.4.2 upgrade — 21 October 2026

Verified npm's latest stable tag and the official v16.4.2 release, then changed the exact Next version from 16.2.2 to 16.4.2 in package.json/package-lock.json. Installed a fresh dependency tree in an empty staging directory, preserving the entire prior node_modules at artifacts/backups/next-16.2.2-before-16.4.2-20261021/node_modules before switching. Regenerated Prisma Client 6.19.3; no database schema/data changes. Next generated its standard AGENTS.md and root-params type reference.

The new dev server runs Next 16.4.2 on port 3000 in an isolated directory. An initial build raced obsolete generated type paths during the previous server shutdown; a subsequent optimized build completed successfully, including TypeScript and all routes. Typecheck, ESLint and whitespace pass. Live probes pass for Thai/English home and anonymous shared/payment pages, localized owner-login redirects, protected owner API 401 and DB health. Restored project tsconfig formatting/includes and normalized next-env to the default dev type paths; retained generated default dev types for standalone typecheck. No cache/dependency/test files were deleted, no payment uploads and no deployment.

## Immediate language switching, clean URLs and navbar control — 21 October 2026

Reproduced the stale-language bug: the root layout retained its initial locale prop after client navigation. Replaced locale-only context with immediate client state and an explicit setLocale action that updates the cookie/html language and refreshes server copy/metadata while preserving URL and client state. Moved the language selector out of UserMenu; it now appears on the navbar for both authenticated and anonymous visitors. Language choices are buttons rather than links. Internal links/router/auth destinations strip legacy prefixes; old /th and /en page URLs redirect to the corresponding clean path and preserve query strings.

An inline stateful probe of the actual LanguageOptions/LanguageProvider passed both language directions with stale server props, immediate translations, cookie/html updates, two server refreshes, zero router navigation and identical children/URL. Live requests verified clean bill/home URLs for both language cookies, old-prefix redirects and query retention, unprefixed login destinations and protected owner APIs. TypeScript, ESLint and whitespace pass. No browser pixel QA, test files, payment writes, deletions or deployments.

## Whole-table settlement status — 21 October 2026

Added TableProgress to published nonempty shared receipts: settled people/all participants, remaining verified amount and a native progress bar. Copy uses “เคลียร์แล้ว” to include zero-debt participants without claiming they made a transfer; an explanatory note shows their count. New-mode outstanding amounts are clamped per settlement; legacy bills use participant paidAmount. Missing new-mode ledger rows with positive totalPayable remain outstanding. Draft/cancelled/empty bills do not render the section. No polling or payment mutation added.

Inline probes pass the requested 2/4 with 1,250 remaining, partial payments, per-recipient overpayment isolation, zero-debt inclusion, legacy satang precision, complete/empty/missing-ledger cases and Thai/English native-progress rendering. TypeScript, ESLint and whitespace pass. No test files, database writes, uploads or deletions. Browser pixel inspection was not performed.

## Automatic shared/payment status refresh — 21 October 2026

Added useLiveRefresh to shared published bills and participant payments. Polls about every three seconds without page loading flashes; requests do not overlap, have a 15-second deadline, pause in hidden tabs/payment work, abort on route/enable changes and unmount, resume on focus/online, and back off to 30 seconds after failures. Existing PIN/token headers remain in use. Invalid/expired access returns the PIN gate or payment error state instead of continuing stale reads. Added calm Thai/English live/reconnecting indicators. Participant outstanding/payee balances now reflect verified paidAmount per pair, with Received after completion. Existing slip previews and selected receiver state are preserved.

Corrected shared PIN quota handling so successful authorized refreshes do not exhaust the attempt quota; incorrect guesses remain limited. Inline actual-hook probes pass timing/no-overlap, hidden/visible, failure/recovery, abort/cleanup and disabled-upload behavior. Actual GET handler probes pass 40 valid PIN reads without quota use, PIN secrecy, missing PIN denial and 31st wrong-guess rate limiting (mock DB/quota only). TypeScript, ESLint, whitespace and live shared/payment page compilation pass. No browser two-session payment simulation, real uploads, database/payment writes, test files, deletions or deployment.

## Mobile navbar adaptation — 21 October 2026

Replaced the mobile flex-wrap/header gap with an explicit compact grid, aligned brand/language/avatar controls, equal-width 44px navigation tabs and pale-green active state. Mobile account name/chevron are hidden in the trigger, with the full name retained inside the dropdown. Guest login has a narrow-screen accessible icon fallback. Added aria-current to active navigation. TypeScript, ESLint and whitespace pass. A PostCSS cascade probe passes at 320/375/390/440/760/1200px for grid, zero row gap, target sizes, guest fallback and desktop flex preservation. Browser viewport/pixel inspection was not performed. No test files or data mutations.

## Language option click dismissal — 21 October 2026

An inline probe of the actual LanguageMenu reproduced premature dismissal when the summary blurs with a null relatedTarget before an option click. Replaced blur dismissal with document focusin outside dismissal, retaining pointer-outside and Escape behavior. The same probe now passes both language selections, null-target blur before selection, outside focus/pointer dismissal and Escape. TypeScript, component ESLint and whitespace pass. This is event-sequence simulation, not a live Safari interaction check. No test files or data mutations.

## Personal receipt, image sharing, cleared stamp and repeat group — 21 October 2026

Shared receipts now offer a name picker and Everyone reset. Selection limits expense rows and balances to that person; item-payer bills use the existing settlement allocator, preserving weighted splits, eligible charges and satang. Legacy bills filter participating items while retaining original item totals. Confirmed per-recipient outstanding balances drive the export and participant rows. Complete published tables display a short stamp animation, disabled under reduced-motion preferences; reversing a payment removes the derived stamp without changing bill status or locking payments.

Share image opens a native dialog with a generated PNG preview and explicit save/share controls. It includes names, costs, outstanding payable/receivable balances, a decodable bill-opening QR, snapshot notice and private-PIN notice where applicable. The QR contains a clean bill URL without PINs or participant tokens. Native file sharing falls back to PNG download; failure and cancel states are handled. No image is uploaded or sent automatically.

Owners can start a new round with the same active names via /new?repeat=…&round=…. The source lookup is owner scoped. Fresh participant IDs, blank title/item/amount/PIN and a separate account/source/round draft key preserve the original bill and normal unsaved draft. No prior payment records or friends’ PromptPay details are copied. A new bill is persisted only through the existing explicit save workflow.

Inline actual-module probes pass personal item filtering and Everyone reset, weighted splits, fee conservation, per-recipient overpayment isolation, missing-ledger/legacy balances, completion based on confirmed payments, owner/guest repeat authorization, actual editor initialization and independent draft keys. A mocked canvas pipeline checks 100 names, PNG output, stamp/PIN notice and bounded dimensions; Sharp/jsQR decodes the actual exported SVG QR at 220px. TypeScript, changed-file ESLint and whitespace pass; live shared page returns 200 and guest repeat route redirects 307. No live Safari/native-share or pixel inspection, test files, real database writes, deletions or deployment.

The separate shared-receipt name-picker strip and filter state were subsequently removed at the user’s request. Full receipt items/people remain visible, and existing full-row payment navigation opens each person’s details. Image sharing, completion stamp, repeat group and verified remaining balances are retained. TypeScript, component ESLint and whitespace pass.

## Stable translation keys — 21 October 2026

Migrated all existing UI and server metadata translation calls to stable dot-separated keys, including nav.myBills. Added a separate canonical Thai dictionary and a matching English dictionary (394 entries). TranslationKey is inferred from Thai; English uses satisfies Record<TranslationKey, string>. Client/server translators accept typed keys and preserve indexed interpolation. Human-readable API errors and previously stored feedback use an explicit translateFeedback boundary rather than overloading t with prose lookup. Static UI text, statuses and receipt-image captions use keys; user-entered names/items and URL/cookie behavior are preserved.

Inline probes pass dictionary and interpolation-placeholder parity for all 394 keys in both languages, 384 literal call-site keys, API feedback switching with interpolated participant names, unknown-message preservation and virtual TypeScript rejection of nav.myBils. Live homepage, metadata and server login return the correct TH/EN copy from cookies without locale-prefixed URLs. Full TypeScript, ESLint and whitespace checks pass. No test files, database writes, deletions or deployment; live Safari interaction was not retested.

## Usernames, account search, friends and saved groups — 21 October 2026

Applied the additive social_accounts migration locally and generated Prisma Client. Read-only database/schema diff is empty. Existing data was not deleted or renamed; existing usernames remain null until owners choose them. Added immutable unique normalized usernames and mandatory setup for protected account routes/APIs/server draft creation. Public bill reads and participant payment endpoints remain exempt. Profile setup is allowed before onboarding, handles duplicate-key races and refreshes session state.

Added exact authenticated/rate-limited username/full-email search with minimal profile output, PENDING/ACCEPTED/DECLINED friendship states, recipient-only request responses, creator/member auto-friending on successful bill/group save, owned group storage, group-to-new-round initialization and an editor account/group picker. No email or PromptPay number is returned by social search/list endpoints. Account-linked bill participants resolve authoritative names/PromptPay in the save transaction, reject duplicate/missing account IDs and ignore client account number overrides. Existing manual guest participants remain supported. New linked accounts have read-only receiver details; the current account can open its own settings.

Inline actual-module probes pass exact normalized search/privacy, relationship output, recipient-only acceptance and third-party denial, group owner scoping and auto-friend writes, username-gated/guest API denial, reserved/invalid username formats, safe return URLs, actual profile normalization/immutability/idempotence/unique-race responses, actual proxy public payment exceptions and onboarding redirects, actual bill-writer forged name/PromptPay protection and account duplication checks (stopped before the existing item replacement path), and actual editor group-round initialization with duplicate-safe linked additions and independent drafts. All mutation probes use mock transactions; no real friend requests, groups, user updates or bill/payment writes were made. Full TypeScript, ESLint and production build passed. Live guest shared/payment pages return 200; friends/setup pages redirect and social APIs return 401 to guests. No live two-account OAuth/Safari/viewport inspection, test files, deletions or deployment.

Follow-up checks: linked receiver publication requires that account’s own PromptPay setting; duplicate-safe selection refreshes account metadata without adding another participant. Final dictionaries contain 447 paired keys with matching placeholders. Restarted the existing dev server on port 3000 with a new .next-dev-social-20261021-1 cache so the generated Prisma schema is loaded, retaining prior caches. Verified guest/public HTTP behavior after restart and preserved pre-existing TypeScript config by restoring only automatically added local build paths.

## Auditable amount explanations — 21 October 2026

Published participant amounts now open a keyboard-accessible native dialog above the existing full-row payment link. It fetches only through the existing participant-token endpoint, opens the personal overview and offers separate recipient disclosures. Closing aborts the initial request/stops live reads; refreshed shared-page tokens are used without resetting loaded disclosures. Payment pages expose both the personal overview and the selected-recipient calculation, collapsed by default.

The existing settlement allocator now returns explanatory base/service-charge/VAT components per share without changing share totals, payer advances, pairwise transfers or balances. Independently rounded components conserve each bill-wide component; explicit per-person satang adjustments reconcile every item and sum to zero across the bill. The scoped read returns own item amounts/components, advances, net overview, unpaid outgoing/incoming totals, each recipient’s pre-offset debt and the exact reverse-direction items being offset. Verified paid amounts are deducted separately; overpayment remains visible and is not moved to another recipient. Legacy bills use their existing subtotal-based fee formula plus a visible reconciliation to their stored total.

Inline differential probes compare 1,500 seeded weighted/discount/fee cases against the pre-change allocator: all existing ledger fields are identical, every per-share breakdown reconciles, global base/SC/VAT totals are conserved and satang adjustments net to zero. An actual read-handler probe explains Pon→Bom as 750−500=250, confirms the reverse food allocation, deducts verified 100 to remaining 150 and reports incoming remaining 800 (mock read-only DB). Legacy charges reconcile. Actual component SSR passes TH/EN base/fee/tax/offset/payment rows, zero-row hiding and disclosure defaults. Actual event/hook simulation passes opening, scoped reads, stable data across token refresh and stopped refresh on close. Production build, TypeScript, ESLint and whitespace pass. No browser/Safari pixel or two-session payment verification, test files, database writes, deletions or deployment.

Live read-only verification also opened the existing published validation bill with its configured access gate and used the returned scoped participant token against the running API. The response is 200; stored per-item base/SC/VAT/rounding sums match shares, and every recipient’s before-offset amount minus offset equals the stored obligation. No PIN, token, PromptPay number or personal amount was logged. No payment or bill mutation was performed.

## Home refinement — 21 October 2026

Preserved the existing hero headline, palette, receipt silhouette, brand and creation/demo links. Replaced the passive equal-split illustration with three interactive scenarios backed by calculateSettlements: 720 equally (240 each), 900 by consumed item (350/350/200), and 900 with multiple advancing payers (300 each, including a payer who must both send and receive 100). Clicking a sample name discloses its actual allocated item shares and, in payer mode, pairwise transfers. Scenarios are explicitly illustrative and never save or call bill mutation APIs. Added a restrained capabilities line and a complete three-step workflow below the hero, reducing excess hero padding while preserving the incumbent composition.

Inline actual-component event probes pass scenario switching, name disclosure, original CTA routes and workflow coverage. Sample arithmetic conserves all totals and retains pairwise reimbursement behavior. A PostCSS cascade probe passes 320/375/440/600/760/1024/1440px for stacking, desktop columns, and padded 44/58px controls. Live homepage SSR returns correct TH/EN content with one h1, original headline, scenario controls and workflow. TypeScript, ESLint and whitespace pass. No native browser/Safari pixel inspection, test files, database writes, deletions or deployment.

## GitHub Actions deployment preparation — 2026-10-21

Prepared the ESS-style `mac-mini-m2` workflow for `sandboxcomet/bill`, destination `/var/opt/sandbox/bill` on the verified ESS VM. Exact source archives, environment-backed registry credentials, expiring SSH agent, verified known hosts, unique registry backup tags before `latest`, retained release/migration artifacts, refreshed digest/image verification, independent MySQL volume, and Traefik HTTPS routing are configured. Existing app replacement requires manual dispatch with an explicitly approved exact container ID before publication/deployment; no pruning or database recreation is performed.

Production compilation, ESLint, TypeScript, actionlint (declared custom runner label), Compose configuration, Bash and embedded Python syntax checks pass. Inline probes of the actual preservation script pass first publication, prior latest, deployed digest preservation and registry-auth rejection with mocked transports. No test files were created or run. Runtime secrets/caches/artifacts are excluded from staged source and an exact-value local secret scan passed.

Read-only SSH inspection verified the authorized ESS service, production Docker network, no existing billing app/database volume, and available resources. Provisioned a new untracked runtime env only after proving its parent outside Git and rejecting symlinks/existing destination; fresh billing DB/auth/payment secrets and existing configured OAuth/slip-storage integrations were sent over SSH without logging values. No existing remote file, service or database was changed. Public HTTPS currently verifies but `/api/health` returns 404; this is not a successful deployment claim. GitHub API authentication currently resolves to `yanaphats` with READ access to `sandboxcomet/bill`; SSH authenticates as owner `sandboxcomet`. GitHub owner authentication is still needed to configure repository secrets and runner access.


## Production launch — 2026-10-21

GitHub-hosted Ubuntu run https://github.com/sandboxcomet/bill/actions/runs/39571036488 completed successfully for source `202259966eb198f5a84679d038cb7862afbc4318`. Repository Secrets and deployment-root variable were configured after owner-granted write access. The earlier queued runs were cancelled, preserving their records. A dedicated restricted SSH key was added to the verified untracked authorization file; existing keys were retained. No personal GitHub token is in source, runtime env or CI secrets.

The independent app and MySQL containers are healthy at `/var/opt/sandbox/bill`; the migration container exited zero and is retained. Application reference is `sandboxcomet/wonglao-bill:latest`, published/loaded/running digest and image ID `sha256:f13c1bcc1766176da95dee817c838e2bb237cb68b136b82fb09e8a8244c21658`. First publication had neither a deployed billing service nor prior registry latest, so no previous image needed backup. No existing app container was replaced, no existing database imported/changed, and no files, images, containers, volumes or history were deleted. The existing ESS service remains healthy.

Public curl checks through `https://bill.wonglao.com` verify TLS, `/api/health` 200 with database `ok`, Thai branded homepage 200, login 200, Google/LINE provider configuration with production callback URLs, private owner API 401, and guest shared route 200. Real Google/LINE OAuth completion, live payment uploads and browser pixel QA were not performed. No test source files were created or run. Existing local accounts/bills remain local; production starts with its independent database. VM free disk after launch is approximately 3.1 GiB; no cleanup was attempted. This documentation-only follow-up skips CI and does not replace the running release.
