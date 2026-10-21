# WongLao Bill

เว็บแบ่งบิลสำหรับ `bill.wonglao.com` เป็น Git repository และฐานข้อมูลแยกจาก WongLao เดิม ไม่มีการอ้างอิงไฟล์ workspace เดิม ไม่มีเกม ระบบวางแผนทริป หรือ LINE bot และไม่ได้ย้ายบัญชีหรือบิลเก่ามาอัตโนมัติ

## ใช้งานในเครื่อง

ใช้ Node.js 24 (`.nvmrc`) และ MySQL บนเครื่องที่พอร์ต 3306 ไม่ต้องเปิด Docker สำหรับการพัฒนา local:

```sh
npm ci
# สำหรับ checkout ใหม่เท่านั้น: เตรียม .env จาก .env.example และกำหนด secret/password ใหม่
# .env ในเครื่องที่สร้างงานนี้มีค่า local พร้อมแล้ว ไม่ต้องเขียนทับ
# สำหรับเครื่องใหม่: สร้างฐาน wonglao_bill และผู้ใช้ bill บน MySQL local
# แล้วกำหนด DATABASE_URL ให้ตรงกับบัญชีที่สร้าง
npm run db:generate
npm run db:deploy
npm run dev
```

เปิดพอร์ตตาม `PORT` ใน `.env` โดยเครื่องนี้ใช้ <http://localhost:3000> และ <http://localhost:3000/demo> เพื่อให้ตรงกับ callback ของ Google/LINE ที่นำมาจาก WongLao เดิม ส่วน `.env.example` ตั้งพอร์ต 3002 สำหรับ OAuth client ที่เพิ่ม callback พอร์ตนั้นแล้ว หน้า demo เป็นข้อมูลตัวอย่างและไม่บันทึกลงฐานข้อมูล

ฐานข้อมูล local: MySQL `wonglao_bill` พอร์ต `127.0.0.1:3306` ใช้ผู้ใช้ `bill` ที่มีสิทธิ์เฉพาะฐานนี้ รหัสผ่านอยู่ใน `.env` ที่ไม่เข้า Git และใช้แยกจากฐาน WongLao เดิม ย้ายข้อมูลจากฐาน Docker มาครบแล้ว โดยเก็บฐาน Docker และสำเนาสำรองใน `artifacts/` ไว้ ส่วน database service ใน `compose.yaml` ใช้สำหรับ deployment แบบ container

หน้าแรก `/` และหน้าตัวอย่าง `/demo` เปิดได้โดยไม่ต้องเข้าสู่ระบบ หน้าตัวอย่างให้ลองแก้ไขและคำนวณบิลโดยไม่บันทึกลงฐานข้อมูล ต้องเข้าสู่ระบบก่อนสร้างบิลจริง ใช้หน้ารวมบิล ลิงก์แชร์ และหน้าชำระเงิน ผู้ร่วมบิลต้องเข้าสู่ระบบด้วย Google หรือ LINE ก่อนดูยอดและส่งสลิป PIN และ token ของรายการจ่ายยังเป็นสิทธิ์เพิ่มเติมหลังล็อกอิน ร่างในเครื่องแยกตามบัญชีผู้ใช้ ผู้ที่ยังไม่ล็อกอินจะถูกส่งไปหน้าเข้าสู่ระบบพร้อม URL ที่จะกลับไปต่อ API ของแอปตอบ 401 โดยยกเว้นเฉพาะ endpoint ของ OAuth/session และ health check

## หน้าหลักและบิลของฉัน

หน้า `/` ใช้เริ่มสร้างบิลและแนะนำการแบ่งบิล ส่วนรายการบิลส่วนตัว การค้นหา ตัวกรองสถานะ และสถานะยังไม่มีบิล อยู่ที่ `/bills` เข้าผ่านเมนู **บิลของฉัน** ลิงก์ย้อนกลับจากตัวแก้ไขจะกลับมาหน้านี้ หน้าแรกเปิดดูได้โดยไม่ต้องล็อกอิน ส่วนหน้าบิลของฉันและการใช้งานบิลต้องล็อกอิน

## ฟีเจอร์

แบ่งค่าใช้จ่ายได้ทั้งค่าทริป ค่าที่พัก ซื้อของร่วมกัน และค่าอาหาร ใช้ชื่อบิลและรายการได้ตามต้องการ

- เพิ่มผู้ร่วมบิล เลือกหารทุกคน เลือกรายคน หรือแบ่งตามสัดส่วน
- ส่วนลดรายรายการ, Service charge, VAT แบบเปอร์เซ็นต์หรือจำนวนเงิน และเลือกคิด VAT รวม Service charge
- สรุปยอดรายคนขณะกรอก ใช้ Decimal และคำนวณซ้ำที่เซิร์ฟเวอร์
- ร่างที่บันทึกแล้ว, ลิงก์แชร์แบบสาธารณะหรือ PIN 4 หลักแบบแสดงตัวเลข 4 ช่อง, QR PromptPay รายคน
- แนบสลิป, ตรวจผู้รับ/ยอด/วัน/สลิปซ้ำ, รอเจ้าของตรวจเมื่อยืนยันอัตโนมัติไม่ได้
- เจ้าของยืนยันหรือย้อนยอดได้พร้อมเหตุผล โดยคงหลักฐานและ audit ไว้
- ป้องกันการบันทึกทับข้ามหน้าต่างด้วย version และล็อกการแก้รายการเมื่อมีหลักฐานชำระ
- UI ไทยสำหรับมือถือและ desktop พร้อมการพิมพ์บิล

## ชื่อเล่นและตั้งค่าบัญชี

เมื่อเริ่มบิลใหม่ ระบบเพิ่มผู้สร้างเป็นผู้ร่วมบิลให้อัตโนมัติ โดยใช้ชื่อเล่น หรือชื่อบัญชีหากยังไม่มีชื่อเล่น ฉบับร่างในเครื่องเดิมจะเพิ่มให้ครั้งเดียวโดยไม่เพิ่มชื่อซ้ำ และยังนำตัวเองออกจากผู้ร่วมบิลได้

กดชื่อมุมบนหรือเมนู **ตั้งค่าบัญชี** เพื่อบันทึกชื่อเล่น 1–40 ตัวอักษร ชื่อเล่นจะใช้แสดงแทนชื่อเต็มในมุมบนและเป็นชื่อผู้สร้างบิล/ผู้รับเงินในหน้าบิลที่แชร์ หากยังไม่ตั้งจะแสดงลิงก์ **ตั้งชื่อเล่น** ชื่อจาก Google/LINE ยังคงเป็นข้อมูลบัญชีเดิม ตั้งชื่อเล่นและหมายเลข PromptPay ในฟอร์มเดียว แล้วกด **บันทึกการตั้งค่า** ครั้งเดียว หากยังไม่มีหมายเลขรับเงิน สามารถบันทึกเฉพาะชื่อเล่นก่อนได้

## เข้าสู่ระบบ

กำหนด Google หรือ LINE OAuth ใน `.env` อย่างน้อยหนึ่ง provider ปุ่ม provider จะปรากฏเมื่อมีทั้ง ID และ secret ไม่มีช่องทาง guest login สำหรับสร้างบัญชีถาวร

| Environment | Google callback | LINE callback |
| --- | --- | --- |
| Local — ใช้ OAuth เดิม | `http://localhost:3000/api/auth/callback/google` | `http://localhost:3000/api/auth/callback/line` |
| Local — พอร์ตตัวอย่าง 3002 | `http://localhost:3002/api/auth/callback/google` | `http://localhost:3002/api/auth/callback/line` |
| Production | `https://bill.wonglao.com/api/auth/callback/google` | `https://bill.wonglao.com/api/auth/callback/line` |

`AUTH_URL` ต้องตรงกับ origin ที่เปิดแอป และ `PORT` ต้องตรงกับพอร์ต local ที่อนุญาตใน OAuth client เครื่องนี้คัดลอกเฉพาะ `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_LINE_ID`, `AUTH_LINE_SECRET` จาก config เดิมมาไว้ใน `.env` ที่ไม่เข้า Git โดยยังใช้ฐานข้อมูลและ session secret ของแอปบิลเอง

ตั้ง `AUTH_URL=https://bill.wonglao.com` ใน production พร้อม `AUTH_SECRET` และ `PAYMENT_LINK_SECRET` ที่สุ่มใหม่ แอปใช้ session cookie ชื่อเฉพาะและ host-only จึงไม่ใช้ session ของ WongLao เดิม

การตรวจสลิปต้องตั้ง `EASY_SLIP_KEY` และ R2 ตาม `.env.example` ใช้ bucket แบบ private แยกจากระบบเดิม รูปอ่านผ่าน API ที่ตรวจสิทธิ์เท่านั้น ก่อนตั้งค่าบริการเหล่านี้ QR/การแบ่งบิลยังใช้งานได้ แต่แนบสลิปจะรายงานว่าบริการยังไม่พร้อม

## ตรวจโค้ด

```sh
npm run typecheck
npm run lint
npm run build
```

อ่านผลตรวจและข้อจำกัดใน [docs/validation.md](docs/validation.md) ไม่มีไฟล์ทดสอบถาวรใน repo นี้ตามนโยบาย cleanup ของผู้ใช้

## Deploy ไป bill.wonglao.com

ใช้ GitHub Actions รูปแบบเดียวกับ ESS: runner `ubuntu-latest` build และ push `sandboxcomet/wonglao-bill:latest` พร้อม backup image ก่อน deploy ผ่าน SSH และ Traefik ไป `bill.wonglao.com` ดูขั้นตอนและ Secrets ใน [deployment/README.md](deployment/README.md) Deploy แล้วที่ [bill.wonglao.com](https://bill.wonglao.com) จาก repository `sandboxcomet/bill` ไปเครื่อง ESS ที่ `/var/opt/sandbox/bill` รอบแรกผ่าน [GitHub Actions #39571036488](https://github.com/sandboxcomet/bill/actions/runs/39571036488) และ `/api/health` ตอบ `200` พร้อมสถานะฐานข้อมูล `ok`

ขั้นตอน manual ด้านล่างเป็นทางเลือกสำหรับโฮสต์ที่ใช้ Nginx:

1. สร้าง remote repository แยกแล้ว push source นี้ เลือกโฮสต์และชี้ DNS `bill.wonglao.com` ไปที่โฮสต์นั้น
2. เตรียม `.env` production แบบ untracked ใน checkout ใหม่ ใช้ฐาน `wonglao_bill` ของโปรเจกต์นี้เท่านั้น ตั้ง `AUTH_URL` และ callback ตามด้านบน รหัส DB ต้องเป็นตัวอักษร/ตัวเลขหรือ hex เพื่อประกอบเป็น URL ได้ตรงกัน
3. Publish image ด้วย `bash tool/publish-image.sh <image-repository>` สคริปต์จะสำรอง image เดิมด้วย tag ไม่ซ้ำและ push backup ก่อนอัปเดต `:latest` หากมี deployment เดิมต่างจาก registry ให้กำหนด `PREVIOUS_IMAGE` เป็น digest ที่รันจริง
4. การ publish ครั้งแรกต้องตรวจยืนยันว่าไม่มี image/deployment เก่า ก่อนกำหนด `CONFIRMED_NO_PREVIOUS_IMAGE=1` ไม่ใช้ flag นี้ข้ามข้อผิดพลาดเรื่องสิทธิ์หรือ network
5. ตั้ง `BILL_IMAGE` ใน `.env` ให้ตรง repository แล้วรัน `bash tool/deploy.sh` สำหรับ initial deployment สคริปต์ refresh `latest`, รัน migration, เปิดบริการที่พอร์ต local `3002` และเทียบ image ID ของ container จริง
6. ติดตั้ง reverse proxy/HTTPS ผ่านกระบวนการปกติของเซิร์ฟเวอร์ ตัวอย่างใน [docs/nginx.conf](docs/nginx.conf) รองรับไฟล์สลิป 4 MB
7. ตรวจ `https://bill.wonglao.com/api/health`, OAuth login, บันทึก/แชร์บิล, ส่งและตรวจสลิปด้วยบัญชีทดสอบของสภาพแวดล้อมนั้น

หากอัปเดต checkout บน VM ให้ตรวจ branch/upstream และ local changes, fetch และตรวจ incoming changes ก่อน `git pull --ff-only` ห้ามแก้ไฟล์ Git-tracked บน VM โดยตรง นโยบายขออนุมัติก่อนลบใช้กับการกระทำโดยตรงของ AI ส่วน GitHub Actions CI/CD แทนที่ app container `wonglao-bill` ได้อัตโนมัติตามขั้นตอน deploy โดยไม่ต้องกรอก container ID แต่ยังสำรอง image เดิมก่อน publish `latest` และตรวจ digest/health ตามเดิม ไม่ลบหรือสร้าง database เดิมใหม่ ไม่ล้าง volume/image หรือ backup สคริปต์ manual `tool/deploy.sh` ยังคงมีการยืนยัน container ID ก่อนแทนที่

สคริปต์ migration เก็บ container ที่จบแล้วไว้เพื่อรักษานโยบายไม่ลบอัตโนมัติ ไม่มีคำสั่ง prune/clean/remove ในขั้นตอนนี้ เก็บ image และ volume สำหรับ rollback จนกว่าจะได้รับอนุมัติให้ลบ

## คนออกเงินรายรายการ

บิลใหม่เลือกคนออกเงินแต่ละรายการได้ พร้อมเลข PromptPay ของคนนั้น ระบบคิดเงินคืนตามคนออกเงินแต่ละรายการ แล้วหักลบเฉพาะยอดโอนสวนกันของคนคู่เดียวกัน เช่น ปอนต้องให้บอม 750 และบอมต้องให้ปอน 500 จึงเหลือปอนโอนบอม 250 ส่วนแพรยังโอนให้ผู้รับเดิมแต่ละคน หากต้องโอนหลายคน หน้าชำระมีตัวเลือกผู้รับพร้อม QR และสลิปแยกตามผู้รับ บิลเดิมใช้ผู้รับคนเดิมจนกว่าจะเปิดแยกคนออกเงินรายรายการ ก่อนมีหลักฐานการชำระ

Schema ใช้ migration `20261021050000_item_payers` แบบเพิ่มคอลัมน์และตาราง หลัง `npm run db:deploy` และ `npm run db:generate` ให้ restart dev server เพื่อโหลด Prisma Client ใหม่

โหมด development (`npm run dev`) สร้าง QR ชำระเงินเป็น **2 บาท** สำหรับทดลอง พร้อมแสดงยอดคงเหลือจริงไว้ ส่วน production ใช้ยอดจริงตามบิล สลิปยังบันทึกยอดที่โอนจริง ไม่เปลี่ยนยอดบิลหรือยืนยันว่าเต็มจำนวนโดยอัตโนมัติ

### Translation keys

Use stable semantic keys such as `t("nav.myBills")` and `t("payment.personTitle", [name])`. Thai copy lives in `lib/translations/th.ts`; English copy lives in `lib/translations/en.ts`. Add the same key to both dictionaries. `TranslationKey` is inferred from Thai, and the English dictionary must satisfy every key; invalid UI keys fail type checking. Client components obtain `t` from `useI18n()`, while server pages call `translate(locale, key)`.

Use `feedback(message)` only at the boundary for human-readable API errors or previously stored feedback. It supports locale changes without changing existing API contracts. Do not use it for static UI labels, bill titles, participant names or item names. User content remains untranslated. Language selection still uses the navbar cookie without locale prefixes in URLs.

### Usernames, friends and saved groups

Migration `20261021140000_social_accounts` adds nullable unique usernames for existing users, friendship states, owned groups, group memberships and optional participant/account links. Existing users choose a username on their next protected account visit; guest bill/payment links are unaffected. Username setup uses PATCH `/api/profile`. Exact account search uses POST `/api/people/search` with `{ query }`; only signed-in onboarded users can search, and results omit email/PromptPay numbers. GET/POST/PATCH `/api/friends` list, request and answer connections. GET/POST `/api/friend-groups` list/create owned groups; `/new?group=…&round=…` creates a separate empty editor round.

Saving linked accounts in a bill/group auto-accepts the creator/member friendship (including a pending request). Manual requests remain pending until answered by their recipient. All account PromptPay values used in a bill are read server-side at save time; posted overrides are ignored. The saved receiver snapshot remains on existing linked bills until a permitted bill save. A profile number is self-configured and is not proof of account ownership.
