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

หน้าแรก `/` และหน้าตัวอย่าง `/demo` เปิดได้โดยไม่ต้องเข้าสู่ระบบ หน้าตัวอย่างให้ลองแก้ไขและคำนวณบิลโดยไม่บันทึกลงฐานข้อมูล บิลที่เผยแพร่และคำอธิบายยอดรายคนเปิดดูก่อนล็อกอินได้ โดยบิลส่วนตัวต้องผ่าน PIN และคำอธิบายยอดต้องมี token ของผู้ร่วมบิล ต้องเข้าสู่ระบบและมีทั้งชื่อผู้ใช้และชื่อเล่นก่อนสร้างบิลจริง ใช้หน้ารวมบิล ตั้งค่าบัญชี หรือเปิดหน้าชำระเงิน ข้อมูลชำระเงินเต็ม การส่งสลิป และรูปสลิปต้องผ่านการตรวจบัญชี ส่วนผู้ร่วมบิลที่ไม่ใช่เจ้าของยังต้องมี token และบัญชีที่เชื่อมกับรายการนั้นสำหรับการจ่าย ส่วนบัญชีอื่นที่มี token ถูกต้องเปิดดูยอดและรายการแบบอ่านอย่างเดียวได้ โดยไม่เห็นเลขผู้รับเงินหรือหลักฐาน และยืนยันหรือส่งสลิปแทนไม่ได้ PIN และ token ไม่ใช้แทนการล็อกอิน ร่างในเครื่องแยกตามบัญชีผู้ใช้ ผู้ที่ยังไม่ล็อกอินจะถูกส่งไปหน้าเข้าสู่ระบบพร้อม URL ที่จะกลับไปต่อ หากบัญชียังตั้งค่าไม่ครบจะไปหน้ากรอกชื่อผู้ใช้และชื่อเล่นก่อน

## หน้าหลักและบิลของฉัน

หน้า `/` ใช้เริ่มสร้างบิลและแนะนำการแบ่งบิล ส่วนรายการบิลส่วนตัว การค้นหา แท็บบิลของฉันและบิลที่ต้องจ่าย และสถานะยังไม่มีบิล อยู่ที่ `/bills` เข้าผ่านเมนู **บิลของฉัน** แสดงสถานะการชำระแยกจากสถานะบิล และมีแท็บ **บิลที่ต้องจ่าย** สำหรับยอดค้างของบัญชีที่ผูกกับผู้ร่วมบิล โดยรวมบัญชีเดิมที่รวมเข้าบัญชีหลักแล้ว บิลที่จ่ายครบ ยกเลิก หรือพิมพ์ชื่อไว้แต่ยังไม่ผูกบัญชีจะไม่อยู่ในแท็บนี้ ยอดที่แสดงในแท็บนี้คือยอดค้างของคุณ ไม่ใช่ยอดรวมทั้งบิล และยังต้องผ่าน PIN เดิมเมื่อเปิดบิลส่วนตัว ลิงก์ย้อนกลับจากตัวแก้ไขจะกลับมาหน้านี้ หน้าแรกและบิลที่เผยแพร่เปิดดูได้โดยไม่ต้องล็อกอิน ส่วนหน้าบิลของฉัน การสร้างหรือแก้ไขบิล และการชำระเงินต้องล็อกอินและตั้งค่าบัญชีให้ครบ

## ฟีเจอร์

แบ่งค่าใช้จ่ายได้ทั้งค่าทริป ค่าที่พัก ซื้อของร่วมกัน และค่าอาหาร ใช้ชื่อบิลและรายการได้ตามต้องการ

- เพิ่มผู้ร่วมบิล เลือกหารทุกคน เลือกรายคน หรือแบ่งตามสัดส่วน
- ส่วนลดรายรายการ, Service charge, VAT แบบเปอร์เซ็นต์หรือจำนวนเงิน และเลือกคิด VAT รวม Service charge
- สรุปยอดรายคนขณะกรอก ใช้ Decimal และคำนวณซ้ำที่เซิร์ฟเวอร์
- ร่างที่บันทึกแล้ว, ลิงก์แชร์แบบสาธารณะหรือ PIN 4 หลักแบบแสดงตัวเลข 4 ช่อง, QR PromptPay รายคน
- แนบสลิป, ตรวจยอด/วัน/สลิปซ้ำ, รอเจ้าของตรวจเมื่อยืนยันอัตโนมัติไม่ได้
- เจ้าของยืนยันหรือย้อนยอดได้พร้อมเหตุผล โดยคงหลักฐานและ audit ไว้
- ป้องกันการบันทึกทับข้ามหน้าต่างด้วย version และล็อกการแก้รายการเมื่อมีหลักฐานชำระ
- UI ไทยสำหรับมือถือและ desktop พร้อมการพิมพ์บิล

## ชื่อเล่นและตั้งค่าบัญชี

ต้องตั้งชื่อผู้ใช้และชื่อเล่นให้ครบก่อนเริ่มบิลหรือชำระเงิน บัญชีเดิมที่ขาดอย่างใดอย่างหนึ่งจะต้องกรอกให้ครบในหน้าเริ่มต้น ชื่อผู้ใช้เดิมแสดงไว้และแก้ไขไม่ได้ ส่วนชื่อเล่นต้องมี 1–40 ตัวอักษรและแก้ไขภายหลังได้ เมื่อเริ่มบิลใหม่ ระบบเพิ่มผู้สร้างเป็นผู้ร่วมบิลให้อัตโนมัติโดยใช้ชื่อเล่น ฉบับร่างในเครื่องเดิมจะเพิ่มให้ครั้งเดียวโดยไม่เพิ่มชื่อซ้ำ และยังนำตัวเองออกจากผู้ร่วมบิลได้

กดชื่อมุมบนหรือเมนู **ตั้งค่าบัญชี** เพื่อบันทึกชื่อเล่น 1–40 ตัวอักษร ชื่อเล่นจะใช้แสดงแทนชื่อเต็มในมุมบนและเป็นชื่อผู้สร้างบิล/ผู้รับเงินในหน้าบิลที่แชร์ ชื่อจาก Google/LINE ยังคงเป็นข้อมูลบัญชีเดิม ตั้งชื่อเล่นและหมายเลข PromptPay ในฟอร์มเดียว แล้วกด **บันทึกการตั้งค่า** ครั้งเดียว หากยังไม่มีหมายเลขรับเงิน สามารถบันทึกเฉพาะชื่อเล่นก่อนได้

## เข้าสู่ระบบ

กำหนด Google หรือ LINE OAuth ใน `.env` อย่างน้อยหนึ่ง provider ปุ่ม provider จะปรากฏเมื่อมีทั้ง ID และ secret ไม่มีช่องทาง guest login สำหรับสร้างบัญชีถาวร

หลังเข้าสู่ระบบ เปิด **ตั้งค่าบัญชี → เข้าใช้งานด้วย Passkey → เพิ่ม Passkey** เพื่อผูกกับบัญชีเดิม ครั้งต่อไปใช้ปุ่ม **เข้าสู่ระบบด้วย Passkey** โดยเลือก Face ID/ลายนิ้วมือ/รหัสปลดล็อกจากอุปกรณ์ได้ ไม่สร้างบัญชีใหม่และยังใช้ Google/LINE เดิมกลับเข้าบัญชีได้ การเพิ่มและปิดใช้ต้องมีการเข้าสู่ระบบภายใน 15 นาที มีชื่อกำกับแต่ละ Passkey และปิดใช้ได้จากหน้าตั้งค่า (เก็บประวัติไว้และยุติเซสชันที่ใช้ Passkey นั้น)

Passkey ใช้ `AUTH_URL` เป็น origin และใช้ hostname นั้นเป็น RP ID แบบเจาะจง: production ต้องเป็น `https://bill.wonglao.com` ส่วน local ใช้ `http://localhost:3000` ได้ กุญแจของ local ใช้แทนกุญแจ production ไม่ได้ ไม่ต้องเพิ่ม OAuth client/secret สำหรับ Passkey; ใช้ migration `20261026150000_passkeys` ผ่าน `npm run db:deploy` ก่อนรันโค้ดใหม่ CI/CD ใช้ขั้นตอน migration เดิม หากเบราว์เซอร์ในแอปไม่รองรับ ให้เปิด Safari/Chrome ผ่านคำแนะนำ IG หรือใช้ Google/LINE

ใช้ SimpleWebAuthn 14 ผ่าน npm aliases `@wonglao/webauthn-server` / `@wonglao/webauthn-browser` เพื่อแยกจาก optional peer ของ WebAuthn 9 ใน Auth.js ซึ่งไม่ได้เปิดใช้ ระบบนี้ตรวจ WebAuthn ฝั่ง server แล้วเข้า JWT session เดิมผ่าน Credentials provider โดยไม่เปิดการสมัครบัญชีด้วย Passkey และไม่ส่ง biometric/private key มาที่ server คำขอผูกกับ HttpOnly cookie มีอายุ 5 นาที ใช้ครั้งเดียวแม้ตรวจไม่ผ่าน และเก็บ record ว่าถูกใช้แล้วแทนการลบทิ้ง

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

Migration `20261021140000_social_accounts` adds nullable unique usernames for existing users, friendship states, owned groups, group memberships and optional participant/account links. Existing users missing a username or nickname must complete both on their next protected account or payment visit. Usernames remain immutable; onboarding prefills an existing username as read-only and requires a 1–40 character nickname. PATCH `/api/profile` refuses an update that leaves either field missing. Public shared bills and safe amount explanations remain available before setup; payment and slip access require a complete signed-in profile. Exact account search uses POST `/api/people/search` with `{ query }`; only signed-in onboarded users can search, and results omit email/PromptPay numbers. GET/POST/PATCH `/api/friends` list, request and answer connections. GET/POST `/api/friend-groups` list/create owned groups; `/new?group=…&round=…` creates a separate empty editor round.

Saving linked accounts in a bill/group auto-accepts the creator/member friendship (including a pending request). Manual requests remain pending until answered by their recipient. All account PromptPay values used in a bill are read server-side at save time; posted overrides are ignored. The saved receiver snapshot remains on existing linked bills until a permitted bill save. A profile number is self-configured and is not proof of account ownership.

## สลิปกรุงเทพที่ยังรอธนาคารยืนยัน

ระบบยังตรวจสลิปด้วย sync endpoint เดิมก่อน เปลี่ยนไปตรวจเบื้องหลังเฉพาะเมื่อ EasySlip ตอบ `SLIP_PENDING` เท่านั้น ข้อผิดพลาดอื่นไม่เข้าคิว สลิปที่ผ่านทันทีใช้ขั้นตอนเดิม

สลิปที่รอจะถูกเก็บใน private storage และสร้างหลักฐานสถานะ `PENDING` โดยยังไม่เพิ่มยอดจ่าย พร้อมข้อความรับสลิปแล้ว ไม่ต้องแนบหรือโอนซ้ำ ระหว่างรอจะซ่อน QR และช่องแนบสลิปของผู้รับคนนั้น ผลตรวจผ่านยังต้องผ่านการตรวจวันเวลา ยอดคงเหลือ และเลขอ้างอิงซ้ำก่อนเพิ่มยอด ไม่บังคับให้เลขผู้รับตรงกับ PromptPay เพราะบิลอาจใช้หลายบัญชีรับเงิน ยอดเกินหรือวันเวลาที่ตรวจไม่ได้ยังรอเจ้าของตรวจ สลิปเดิมที่รอเฉพาะการยืนยันผู้รับสามารถแนบซ้ำเพื่อประเมินตามเงื่อนไขใหม่นี้ได้ โดยไม่เพิ่มยอดซ้ำ

- รัน `npm run db:deploy` และ `npm run db:generate` แล้ว restart แอป เพื่อใช้ migration `20261021170000_pending_slips` (เพิ่มคอลัมน์และ index เท่านั้น) งานนี้ apply เฉพาะฐาน local แล้ว
- บน Node/Docker ที่เปิดต่อเนื่อง `instrumentation.ts` เริ่ม worker ทุก 15 วินาที มี lease ในฐานข้อมูลป้องกันหลาย instance ทำซ้ำ และทำงานต่อได้หลังปิดหน้าเว็บหรือ restart
- Production ใช้ `POST /v2/verify/bank/async` แล้วดึง `GET /v2/verify/bank/jobs/:jobId` มาตรวจผลจริง `callbackUrl` เริ่มต้นคือ `${AUTH_URL}/api/webhooks/easyslip`; ใช้ `EASY_SLIP_CALLBACK_URL` หากต้องการ public HTTPS URL อื่น
- ตั้ง `EASYSLIP_WEBHOOK_SECRET` ให้ตรงกับ secret ใน EasySlip branch เพื่อรับ signed webhook ได้ endpoint จะปฏิเสธลายเซ็นขาด/ไม่ถูกต้อง และเพียงปลุก worker ให้ดึงผลด้วย API key อีกครั้ง ไม่ใช้ข้อมูล callback เพิ่มยอดโดยตรง หาก callback ส่งไม่ถึงหรือยังไม่ได้ตั้ง secret การ polling ของ worker ยังตรวจต่อให้
- Local HTTP ซึ่งไม่มี public callback จะใช้ sync retries ใน worker หลัง 30/60/120/240 วินาทีแทน ไม่ต้องสร้าง tunnel สลิปที่ตรวจไม่สำเร็จหลังหมดรอบให้แนบเดิมใหม่ได้โดยไม่โอนซ้ำ
- QR payload และบัญชีผู้รับสำหรับงานค้างถูกเข้ารหัสด้วยคีย์ที่ derive จาก `PAYMENT_LINK_SECRET` หรือ `AUTH_SECRET` ต้องรักษา secret นี้ระหว่างมีงานค้าง ไม่มีการส่ง encrypted payload/provider job ID ให้ client
- งานค้างเกิน 24 ชั่วโมงจะหยุดและให้ลองแนบเดิมใหม่ กรณี upload ค้างเกิน 5 นาทีจะเปิดให้ลองใหม่ เก็บหลักฐานและไฟล์เดิมไว้ ไม่มีการลบประวัติ
- `SLIP_WORKER_DISABLED=1` ใช้หยุด worker สำหรับ build/probe เท่านั้น; Dockerfile ตั้งค่านี้เฉพาะคำสั่ง build ไม่ได้ปิด worker ใน runtime ไม่รองรับการพึ่ง interval บน serverless ที่หยุด process เมื่อจบ request

เอกสารอ้างอิง: [EasySlip Async Verify](https://document.easyslip.com/en/v2/async/bank/), [Webhook](https://document.easyslip.com/en/v2/async/webhook), [Job polling](https://document.easyslip.com/en/v2/async/bank/jobs)

## เชื่อม Google และ LINE และรวมบัญชีเดิม

ไปที่ **ตั้งค่าบัญชี → ช่องทางเข้าสู่ระบบ** แล้วกดเชื่อม Google หรือ LINE ที่ยังไม่ได้เชื่อม ระบบจะให้ยืนยันตัวตนกับ provider นั้นก่อน หากพบว่าเป็นบัญชีเดิมอีกบัญชีหนึ่ง ให้เลือกบัญชีหลักที่ต้องการใช้ชื่อผู้ใช้ ชื่อแสดง และ PromptPay ต่อ ตรวจสอบข้อมูล แล้วทำเครื่องหมายยืนยันก่อนกดรวมบัญชี หากเป็นช่องทางเข้าสู่ระบบใหม่ที่ยังไม่มีบัญชี จะเชื่อมเข้าบัญชีปัจจุบันโดยไม่ต้องเลือกบัญชีหลัก

หลังยืนยัน ให้เข้าสู่ระบบใหม่ด้วย Google หรือ LINE ที่เชื่อมแล้ว ทั้งสองช่องทางจะเข้าบัญชีหลักเดียวกัน บิล กลุ่ม เพื่อน และประวัติการจ่ายของทั้งสองบัญชียังคงอยู่ หากทั้งสองบัญชีเคยเป็นผู้ร่วมบิลเดียวกัน แถวผู้ร่วมบิล ยอดเงิน และเลขรับเงินที่บันทึกไว้ยังแยกกัน บัญชีหลักเป็นแหล่งข้อมูล PromptPay ระดับบัญชีของเจ้าของบิล ส่วนเลขรับเงินที่บันทึกกับผู้ร่วมบิลเดิมไม่ถูกเขียนทับจากการรวมบัญชี

ก่อนเริ่มเชื่อมต้องเข้าสู่ระบบล่าสุดภายใน 15 นาที และยืนยันการเชื่อมภายใน 10 นาทีหลังเริ่มขั้นตอน การยืนยันใช้ได้ครั้งเดียว หากข้อมูลเปลี่ยน หมดเวลา หรือพบช่องทาง provider ที่ขัดกัน ให้กด **เริ่มเชื่อมบัญชีใหม่** เพื่อยืนยันอีกครั้ง ปุ่ม provider ที่ยังไม่ได้ตั้งค่า OAuth จะใช้งานไม่ได้ การเชื่อมและรวมบัญชีกับ Google/LINE จริงครบกระบวนการยังต้องตรวจสอบกับบัญชีผู้ใช้จริง

## ยืนยันตัวตนผู้ร่วมบิลก่อนชำระ

หากเจ้าของบิลพิมพ์ชื่อผู้ร่วมบิลไว้เอง ผู้จ่ายต้องเข้าสู่ระบบ กรอกชื่อผู้ใช้และชื่อเล่นให้ครบ แล้วกดยืนยันว่ารายการนี้เป็นของตนหนึ่งครั้งก่อนใช้ส่วนชำระเงิน ระบบแสดงชื่อที่บันทึกไว้คู่กับชื่อเล่นและชื่อผู้ใช้ของบัญชีที่กำลังเข้าสู่ระบบ การยืนยันเชื่อมรายการกับบัญชีจริงจาก session โดยไม่เปลี่ยนชื่อผู้ร่วมบิล เลขรับเงินที่บันทึกไว้ หรือยอดเงินเดิม ครั้งถัดไปใช้บัญชีที่เชื่อมแล้วได้เลย เจ้าของยังจัดการรายการของคนอื่นได้โดยไม่ถูกเชื่อมเป็นคนเหล่านั้นโดยอัตโนมัติ

รายการที่เชื่อมกับบัญชีอื่นแล้ว หรือบัญชีที่มีผู้ร่วมบิลอีกคนในบิลเดียวกัน จะยืนยันซ้ำไม่ได้ โดยนับ alias ของบัญชีที่รวมแล้วเป็นบัญชีเดียวกัน รายการที่เก็บถาวร บิลที่ยกเลิก หรือเวอร์ชันบิลที่เปลี่ยนไปจะถูกปฏิเสธ ให้กลับไปเปิดจากหน้าบิลอีกครั้ง

POST `/api/bills/:id/participants/:pid/claim` รับ `{ claimSelf: true }` ใช้บัญชีจาก session, ตรวจ same-origin และ token ของผู้ร่วมบิลสำหรับผู้ที่ไม่ใช่เจ้าของ แล้วล็อกบิลก่อนเชื่อมบัญชี ส่วน GET `/api/bills/:id/participants/:pid/expenses` ใช้ token จากหน้าบิลที่ผ่านสิทธิ์แล้ว และคืนเฉพาะ `expenseDetails` กับ `settlements` สำหรับคำอธิบายยอดด้วยสูตรเดียวกับหน้าชำระเงิน โดยไม่คืนข้อมูลผู้รับเงิน หลักฐานสลิป หรือบัญชี จึงเปิดคำอธิบายยอดก่อนล็อกอินได้ การเปลี่ยนสิทธิ์และเชื่อมผู้ร่วมบิลครั้งนี้ไม่ต้องเพิ่ม schema migration


เจ้าของบิลกด **หยุดแชร์** ได้จากหน้าแก้ไข แม้มีหลักฐานการจ่ายที่ล็อกยอดแล้ว ระบบเก็บรายการ ยอด และประวัติทั้งหมดไว้ แต่เปลี่ยนสถานะเป็น `UNSHARED` และเพิ่ม version ลิงก์ `/:id` และหน้าจ่ายของบิลที่หยุดแชร์จะเป็น 404 รวมถึงเมื่อเจ้าของเปิดเอง ส่วนหน้า `/manage/:id` ยังใช้ได้ เจ้าของกด **แชร์อีกครั้ง** เพื่อเปิดใหม่ได้ โดยบิลที่ล็อกยอดแล้วใช้ snapshot การเงินเดิมและยังตรวจ PIN ตามเดิม บิลที่หยุดแชร์ยังอยู่ในรายการบิลที่สร้าง แต่ไม่อยู่ในแท็บบิลที่ต้องจ่าย การเปลี่ยนสถานะนี้ไม่ต้องเพิ่ม schema migration


URL ปัจจุบันใช้ `/:id` สำหรับลิงก์บิล, `/:id/:pid` สำหรับหน้าชำระเงิน และ `/manage/:id` สำหรับแก้ไขโดยเจ้าของ เช่น `https://bill.wonglao.com/cmvnv8ac0000zpe07px9yjjiv` ลิงก์เดิม `/bill/:id`, `/bill/:id/:pid` และ `/bills/:id/edit` ส่งต่อแบบ 308 โดยเก็บ query string เดิมไว้ ลิงก์แชร์และ QR ในภาพบิลสร้าง URL รูปแบบใหม่ ส่วน API และรหัส/token ของผู้ร่วมบิลใช้รูปแบบเดิม การล็อกอิน สิทธิ์เจ้าของ PIN และการหยุดแชร์เป็น 404 ยังคงบังคับใช้
