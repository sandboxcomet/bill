# Validation — 20 October 2026

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
