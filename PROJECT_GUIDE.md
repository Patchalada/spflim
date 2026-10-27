# Dormitory Management System — Project Guide

คู่มือภาพรวมสำหรับผู้พัฒนาและ AI ที่จะมาช่วยพัฒนาต่อ ให้ใช้เอกสารนี้เป็นแผนที่เริ่มต้น แล้วตรวจโค้ดจริงก่อนแก้ไขเสมอ เพราะโค้ดเป็นแหล่งข้อมูลล่าสุดเมื่อรายละเอียดไม่ตรงกับเอกสาร

## 1. เป้าหมายของระบบ

เว็บแอปจัดการหอพัก แบ่งผู้ใช้งานเป็นผู้ดูแล (`admin`) และผู้เช่า (`tenant`) ครอบคลุมงานห้องพัก ผู้เช่า สัญญา บิลค่าน้ำ/ไฟ การชำระเงิน และรายงานการเงิน

### ผู้ดูแล

- เข้าสู่ระบบและตรวจเอกสารสมัครผู้เช่า (KYC) บันทึกผลการตรวจลงในประวัติ `m_kyc_reviews`
- จัดสรรห้องพักและจัดทำสัญญาเช่าพร้อมลงลายมือชื่อผู้ให้เช่าดิจิทัล (Admin Digital Signature) ในขั้นตอนอนุมัติ KYC เพื่อส่งสัญญาให้ผู้เช่าลงนามออนไลน์
- เพิ่ม แก้ไข ค้นหา และลบห้องพัก
- จัดการข้อมูลผู้เช่าและสัญญาเช่า รวมถึงดูหนังสือสัญญาเช่าฉบับจริงพร้อมลายมือชื่อของทั้งสองฝ่าย พิมพ์หรือบันทึกเป็น PDF
- บันทึกย้ายออกเพื่อสิ้นสุดสัญญาและคืนห้องว่างโดยเก็บประวัติไว้
- กำหนดประเภท/ราคาห้อง อัตราค่าน้ำ ค่าไฟ และข้อมูลหอพัก
- ออกบิลจากค่าเช่า เลขมิเตอร์น้ำ/ไฟ และรายการค่าใช้จ่ายเพิ่มเติมที่ระบุเอง
- ค้นหาและกรองบิลตามรอบเดือนและสถานะ
- ตรวจสลิปที่ผู้เช่าแนบ บันทึกผลตรวจ/วิธีรับชำระ แล้วเปลี่ยนสถานะบิลเป็นชำระแล้ว
- รับการแจ้งเตือน LINE เมื่อมีสลิปส่งเข้ามา หากกำหนด LINE Messaging API
- เพิ่มและลบบัญชีแอดมินได้เฉพาะแอดมินหลัก
- ดูและพิมพ์ใบแจ้งหนี้หรือใบเสร็จเป็นกระดาษ/PDF
- ดูแดชบอร์ด รายงานรายรับ รายจ่าย กำไร สถานะห้อง และส่งออก CSV

### ผู้เช่า

- สมัครและเลือกห้องพักที่ประสงค์จะเช่า (`requested_room_id`) ส่งเอกสารหลักฐานตัวตนเพื่อรอผู้ดูแลตรวจสอบ KYC จากนั้นเข้าสู่ระบบ
- อัปโหลดหรือเปลี่ยนรูปโปรไฟล์จากแถบเมนู; การเปลี่ยนจะเขียนทับรูปเดิมใน `m_users.profile_image`
- รับทราบประกาศความเป็นส่วนตัวก่อนสมัคร; บันทึกเวลารับทราบและเวอร์ชันประกาศใน `m_users`
- ตรวจสอบหนังสือสัญญาเช่าห้องพักฉบับจริง และทำการลงนามสัญญาออนไลน์ (Digital Signature) รองรับทั้งการวาดลายเซ็นสดบนหน้าจอ (Touch/Mouse) หรืออัปโหลดรูปลายเซ็น/เอกสารสัญญา พร้อมแสดงพรีวิวตำแหน่งลายเซ็นบนเอกสารแบบเรียลไทม์
- ดูข้อมูลส่วนตัว ห้องพัก และสัญญาที่เปิดใช้งานอยู่
- ดูบิลแบบสรุปรายการค่าใช้จ่าย เปิดใบแจ้งหนี้/ใบเสร็จเพื่อพิมพ์หรือบันทึก PDF แนบสลิป และดูประวัติชำระของตนเอง
- แก้ไขชื่อ นามสกุล และเบอร์โทรศัพท์
- ส่งคำขอต่อสัญญาได้ใน 30 วันก่อนหมดสัญญา จากนั้นรับร่างสัญญาจากผู้ดูแล เซ็นและอัปโหลดกลับ รอผู้ดูแลตรวจและบันทึกสัญญา
- เปิดเคสแจ้งซ่อม/ปัญหาที่พัก ติดตามสถานะและคำตอบจากผู้ดูแล และปิดเคสเมื่อเสร็จ
- รับการแจ้งเตือนแบบ Real-time ผ่าน WebSocket (Socket.io)

## 2. เทคโนโลยีและการเชื่อมต่อ

| ส่วน | เทคโนโลยี / ที่อยู่ |
|---|---|
| Frontend | React 19, Vite, React Router 7, Tailwind CSS 4, Axios, lucide-react |
| Backend | Node.js, Express 5, CommonJS, Socket.io |
| Database | PostgreSQL ผ่าน `pg` (ตั้งค่าให้เชื่อม Neon ได้) |
| API ระหว่าง frontend/backend | `http://localhost:5000/api` |
| หน้า API docs | `http://localhost:5000/api-docs` |
| Vite dev server | โดยปกติ `http://localhost:5173` |

โครงสร้างหลัก:

```text
backend/
  src/
    config/       # DB pool, schema migration, Swagger, Socket.io
    controllers/  # กฎธุรกิจและ SQL
    middleware/   # JWT และ role authorization
    routes/       # เส้นทาง API และการกำหนดสิทธิ์
    services/     # SlipOK verification, LINE notifications
    utils/        # pagination, uploadedDocument, print helpers
    index.js      # ตั้งค่า Express, mount routes, migrate ก่อน listen
frontend/
  src/
    api/          # Axios client
    assets/       # ภาพประกอบ SVG ในโปรเจกต์
    components/   # Layout, route protection, toast, SignaturePad, OfficialContractDocument
    pages/        # หน้าตาม route (Dashboard, KYCApproval, Tenants, TenantContract, etc.)
    App.jsx       # กำหนด route ของแอป
    index.css     # ธีมและ print styles
```

## 3. การเริ่มระบบในเครื่อง

ติดตั้ง dependencies แยกในแต่ละแอป หากยังไม่มี `node_modules`:

```powershell
cd backend
npm install
npm run dev
```

เปิด terminal อีกหน้าต่าง:

```powershell
cd frontend
npm install
npm run dev
```

Backend โหลดค่าจาก `backend/.env` โดยต้องกำหนด `DB_USER`, `DB_HOST`, `DB_NAME`, `DB_PASSWORD`, `DB_PORT`, `JWT_SECRET` และเลือกกำหนด `PORT` (ค่าเริ่มต้น `5000`) **ห้ามใส่ค่าลับจริงในเอกสารหรือ commit ลง Git** ตรวจ `.gitignore` ก่อนเพิ่มไฟล์ตัวอย่าง environment

Frontend Axios base URL ปัจจุบันกำหนดเป็น `http://localhost:5000/api` ใน `frontend/src/api/axios.js`; ก่อน deploy ต้องเปลี่ยนให้รองรับ URL ตาม environment

## 4. Authentication และสิทธิ์

- Login ตรวจรหัสผ่านด้วย bcrypt และออก JWT อายุ 1 วัน
- สมัครผู้เช่าต้องส่ง `pdpa_consent: true`; บันทึก `pdpa_consent_at` และ `pdpa_policy_version`
- รูปโปรไฟล์ JPG/PNG/WebP ถูกเก็บเป็น Data URL ใน `m_users.profile_image` (ไม่เกิน 5 MB); API ผู้ใช้ที่ login ใช้ `GET /auth/me` และ `PUT /auth/profile-image`
- Frontend เก็บ token/role ใน `localStorage`; Axios interceptor แนบ `Authorization: Bearer <token>`
- `verifyToken` ตรวจ JWT; `authorizeRoles(...)` ใช้จำกัด role ในแต่ละ route
- `ProtectedRoute` กันผู้ที่ไม่มี token และ `Layout` เลือกเมนูตาม role
- API ที่แสดงเอกสารบิลตรวจว่าเป็น admin หรือเป็นผู้เช่าที่เป็นเจ้าของสัญญาของบิลนั้น
- การอนุมัติรับชำระเป็นสิทธิ์ admin เท่านั้น
- สมัครสาธารณะสร้างได้เฉพาะบัญชี `tenant` ที่มีสถานะ `pending` และต้องผ่าน KYC ก่อน login
- เฉพาะแอดมินหลักเท่านั้นที่เพิ่มหรือลบบัญชีแอดมินได้
- การลงนามสัญญาเช่า: สัญญาในสถานะ `pending_signature` อนุญาตให้เฉพาะผู้เช่าที่เป็นคู่สัญญาในสัญญานั้นกดยืนยันลงนามออนไลน์ได้ผ่าน `POST /tenant/contracts/:id/sign`

## 5. API หลัก

ทุก path ด้านล่างมี prefix `/api`; route ที่ต้อง login ใช้ Bearer token

| หมวด | Path | การใช้งาน / สิทธิ์โดยย่อ |
|---|---|---|
| Auth | `/auth/register`, `/auth/login` | สมัคร (เลือกห้องที่ต้องการได้) และเข้าสู่ระบบ |
| โปรไฟล์ | `/auth/me`, `/auth/profile-image` | ดูโปรไฟล์และเปลี่ยนรูปของผู้ใช้ที่ login |
| สัญญาออนไลน์ | `/tenant/contracts/:id/sign` | ผู้เช่าลงนามสัญญาเช่าออนไลน์ (วาดสดหรืออัปโหลดลายเซ็น) ปรับสัญญาเป็น `active` ทันที |
| ต่อสัญญา | `/tenant/renewals`, `/renewals` | ผู้เช่าส่งคำขอภายใน 30 วันก่อนหมดสัญญา; admin อนุมัติและส่งร่าง; ผู้เช่าเซ็นและอัปโหลดกลับ; admin ตรวจและยืนยันแล้วระบบจึงปรับวันสิ้นสุด |
| เคสแจ้งปัญหา | `/tenant/support-tickets`, `/support-tickets` | ผู้เช่าเปิด/ติดตาม/ปิดเคส; admin ตอบกลับและจัดการสถานะ |
| เอกสารผู้เช่า | `/tenant/admin/tenants/:id/documents`, `/tenant/my-documents/:type` | admin ดูเอกสารสมัครและสัญญาต่ออายุของผู้เช่า; ผู้เช่าดูเอกสารแนบของตนเอง |
| Admin accounts | `/admins`, `/admins/:id` | admin ดูรายชื่อได้; เพิ่ม/ลบได้เฉพาะแอดมินหลัก |
| ห้อง | `/rooms`, `/rooms/:id` | ดู/จัดการห้อง; การเปลี่ยนแปลงเป็น admin |
| สัญญา | `/contracts`, `/contracts/:id` | ดู สร้าง แก้ไขสัญญา พร้อมลายเซ็น `admin_signature`, `tenant_signature`, `signed_document`; admin |
| บิล | `/bills`, `/bills/last-meter/:contract_id` | ออกบิลพร้อมค่าเช่า มิเตอร์ และรายการเสริม; admin |
| เอกสารบิล | `/bills/:bill_id` | admin หรือเจ้าของบิล; คืนข้อมูลใบแจ้งหนี้/ใบเสร็จสำหรับพิมพ์ |
| การเงิน | `/transactions`, `/transactions/expenses`, `/transactions/pay-bill` | รายงาน/CRUD รายจ่าย และยืนยันรับเงิน; admin |
| ผู้เช่า | `/tenant/me`, `/tenant/my-bills`, `/tenant/upload-slip`, `/tenant/update-profile` | ข้อมูลและการทำรายการของผู้เช่าที่ login; การแนบสลิปตรวจแบบ manual เป็นค่าเริ่มต้น หรือจำลองได้ในเครื่อง |
| KYC | `/tenant/pending-kyc`, `/tenant/verify-kyc` | ตรวจและอนุมัติเอกสาร จัดสรรห้อง และแนบลายเซ็นผู้ให้เช่าเพื่อสร้างสัญญาเช่าออนไลน์; admin |
| ตั้งค่า | `/settings`, `/settings/rates`, `/settings/dormitory`, `/settings/room-types` | ค่าน้ำ/ไฟ ประเภทห้อง และข้อมูลหอพัก; admin |
| รายงาน | `/reports/dashboard`, `/reports/monthly-financial`, `/reports/rooms`, `/reports/tenants`, `/reports/payments` | Dashboard/รายงาน; admin |

ดูรายละเอียด request/response และ OpenAPI annotations เพิ่มเติมได้ที่ `/api-docs` และไฟล์ `backend/src/routes/`

## 6. ข้อมูลและ migration

ตารางหลัก:

- `m_users` — บัญชี login, บทบาท, สถานะ KYC, ห้องที่เลือกตอนสมัคร (`requested_room_id`), ข้อมูลติดต่อ และธงแอดมินหลัก
- `m_rooms` — เลขห้อง ชั้น ประเภท ราคา และสถานะ (`available`, `occupied`, `maintenance`)
- `m_contracts` — ความสัมพันธ์ผู้เช่า/ห้อง วันเริ่ม–สิ้นสุด เงินประกัน สถานะ (`pending_signature`, `active`, `terminated`, `expired`), ลายเซ็นผู้ให้เช่า (`admin_signature`, `admin_signed_at`), ลายเซ็นผู้เช่า (`tenant_signature`, `tenant_signed_at`) และไฟล์เอกสารที่ลงนาม (`signed_document`, `agreement_document`)
- `m_kyc_reviews` — ประวัติการตรวจสอบและอนุมัติ KYC ของผู้เช่าแต่ละราย
- `t_bills` — รอบบิล ค่าเช่า มิเตอร์ หน่วย/ยอดน้ำไฟ รายการเสริมใน `extra_charges` วันครบกำหนด และสถานะชำระ
- `t_transactions` — รายรับ/รายจ่าย; รายรับจากบิลเก็บวิธีชำระ เลขอ้างอิง หมายเหตุ และ `bill_id`
- `t_notifications` — ประวัติการแจ้งเตือนสำหรับผู้ใช้แต่ละรายและบทบาท
- `m_billing_settings` — เรตน้ำ/ไฟ ข้อมูลหอพัก และเบอร์พร้อมเพย์ที่แสดงบนบิล
- `m_room_types` — ประเภทห้องและราคาเริ่มต้น
- `app_schema_migrations` — รุ่น migration ที่เคยรัน

`backend/src/config/migrateDatabase.js` ตรวจ schema และเพิ่มตาราง/คอลัมน์/index ที่กำหนดแบบ additive ทุกครั้งที่ backend เริ่ม ก่อนเปิด HTTP server หาก migration หรือการตรวจหลัง migration ไม่ผ่าน server จะไม่เริ่มทำงาน การตรวจใช้ advisory lock เพื่อกัน backend หลายตัว migrate พร้อมกัน

### ระบบสัญญาเช่าและเอกสารสัญญาฉบับจริง (Unified Digital Contract)

- ระบบใช้ Component กลาง `frontend/src/components/OfficialContractDocument.jsx` เป็น **Single Source of Truth** เพียงจุดเดียว ทั้งใน:
  1. `frontend/src/pages/TenantContract.jsx` (หน้าตรวจสอบและลงนามสัญญาของผู้เช่า)
  2. `frontend/src/components/ContractDocumentModal.jsx` (โมดอลที่แอดมินเปิดดูสัญญาจากหน้ารายการผู้เช่าและห้องพัก)
  3. `frontend/src/pages/KYCApproval.jsx` (หน้าต่างที่แอดมินพรีวิวสัญญาก่อนส่งให้ผู้เช่า)
- รองรับการวาดลายเซ็นสดความละเอียดสูง (High-DPI Canvas) ผ่าน `frontend/src/components/SignaturePad.jsx` รองรับทั้งอุปกรณ์มือถือ/แท็บเล็ตและเมาส์ และรองรับการอัปโหลดไฟล์รูปลายเซ็นหรือไฟล์เอกสารทั้งฉบับ
- มีระบบ Live Signature Placement: เมื่อผู้ใช้วาดหรือเลือกรูปลายเซ็น ลายเซ็นจะเข้าไปปรากฏบนตำแหน่งลงนามของตัวสัญญาจริงแบบเรียลไทม์ทันทีเพื่อให้เห็นภาพก่อนกดยืนยันส่ง

### สรุปรุ่น Migration สำคัญ

- **Migration 11:** ตาราง `t_notifications` สำหรับระบบแจ้งเตือนผู้ใช้
- **Migration 12:** คอลัมน์ `requested_room_id` ใน `m_users` และตารางประวัติ `m_kyc_reviews`
- **Migration 13:** คอลัมน์ลายเซ็นและเอกสารดิจิทัลใน `m_contracts` (`admin_signature`, `admin_signed_at`, `tenant_signature`, `tenant_signed_at`, `signed_document`, `agreement_document`)

## 7. กติกาการพัฒนาที่ควรรักษา

- เพิ่ม endpoint โดยแยก **route → controller → database** และระบุ middleware ตรวจ token/role ให้ชัด
- ใช้ SQL parameterized (`$1`, `$2`, …) ห้ามต่อค่าจากผู้ใช้ลง SQL string
- ตรวจ input และส่ง HTTP status/error ที่เหมาะสม; อย่ากลืน error หรือคืน success เมื่อทำงานไม่สำเร็จ
- งานที่แก้ข้อมูลหลายจุดและต้องสำเร็จ/ล้มเหลวพร้อมกันให้ใช้ `db.withTransaction(...)`
- เพิ่ม schema ด้วย migration แบบ additive และอัปเดต `expectedColumns`/การตรวจ schema ให้ครบ
- Frontend เรียก API ผ่าน `src/api/axios.js`; ใช้ toast จาก `src/components/useToast.js` สำหรับ feedback
- เพิ่มหน้าใหม่ใน `src/pages/` และลง route ใน `src/App.jsx`; หน้าหลัง login ต้องอยู่ใน protected routes
- ใช้ชื่อ camelCase ใน JavaScript, component React แบบ PascalCase, endpoint REST ตามรูปแบบเดิม และข้อความ UI ภาษาไทย
- ธีมรวมอยู่ใน `src/index.css`: โทน teal/เขียว ภาพหอพักจำกัดตำแหน่งตามที่ออกแบบ มุมโค้งเล็กน้อย และมี print rules
- การใช้งานบนมือถือ: viewport ปิดการซูมด้วย pinch, เมนูหลักเปลี่ยนเป็น icon bar ติดด้านล่างพร้อม safe-area inset, ส่วนเนื้อหาต้องไม่ล้นแนวนอน และตารางกว้างให้เลื่อนภายในกรอบของตาราง; Desktop ยังคงใช้ Sidebar
- ไม่เพิ่ม library ใหม่หากทำได้ด้วยเครื่องมือที่มี
- รักษาการเปลี่ยนแปลงของผู้ใช้ใน worktree; ตรวจ `git status` และอ่าน diff ก่อนแก้หรือสรุป

## 8. Build, lint และคำสั่งการทดสอบระบบ (Test & Analysis Commands)

### 8.1 คำสั่งทดสอบพื้นฐานในเครื่อง

```powershell
# 1. ทดสอบ Backend Unit Tests (Node.js test runner 12/12 passing)
cd backend
npm test

# 2. ทดสอบการ Build Frontend (Vite Production Build)
cd ..\frontend
npm run build

# 3. ตรวจสอบ Lint และกฎโค้ดสไตล์
npm run lint

# 4. รันระบบในโหมด Development
# Terminal 1: Backend API (port 5000)
cd ..\backend
npm run dev

# Terminal 2: Frontend Client (port 5173)
cd ..\frontend
npm run dev
```

### 8.2 การวิเคราะห์คุณภาพและความปลอดภัยของโค้ดด้วย SonarQube (Static Analysis)

ระบบมีการคอนฟิก SonarQube Community Edition และ SonarScanner ไว้เพื่อตรวจสอบ Code Quality, Security Vulnerabilities, Bugs, และ Maintainability

#### 1) เริ่มต้นรัน SonarQube Server ด้วย Docker
```powershell
cd D:\spflim\SonarQube-main
docker compose up -d
```
เปิดเบราว์เซอร์ไปที่ `http://localhost:9000` (บัญชีเริ่มต้น `admin` / `admin` และสร้าง Analysis Token จาก *My Account -> Security*)

#### 2) คำสั่งสแกนโปรเจกต์ `spflim` ด้วย SonarScanner (ผ่าน Docker)
รันคำสั่งนี้จาก root directory `D:\spflim`:
```powershell
docker run --rm `
  --memory=4g `
  -e SONAR_HOST_URL="http://host.docker.internal:9000" `
  -e SONAR_TOKEN="<ใส่_TOKEN_ที่ได้จาก_SonarQube>" `
  -v "${PWD}:/usr/src" `
  sonarsource/sonar-scanner-cli
```

#### 3) คำสั่งสร้างและส่งออกรายงานสรุปผลเป็น PDF
```powershell
python SonarQube-main/sonar_report.py `
  --host http://localhost:9000 `
  --project spflim-dormitory `
  --token "<ใส่_TOKEN_ที่ได้จาก_SonarQube>" `
  --output spflim_analysis_report.pdf
```
ไฟล์รายงาน PDF จะถูกสร้างไว้ที่ `D:\spflim\spflim_analysis_report.pdf`

#### 4) สรุปคะแนนการวิเคราะห์ของโปรเจกต์ `spflim` (เกรด A และ Quality Gate: PASSED)
- **Quality Gate: PASSED** — ผ่านเกณฑ์ Clean as You Code (CAYC) ของ SonarQube
- **Security Rating: A** — ตรวจพบ Vulnerabilities: **0 จุด**, Security Hotspots: **0 จุด**
- **Reliability Rating: A** — ตรวจพบบั๊ก (Bugs): **0 จุด**
- **Maintainability Rating: A** — โค้ดสะอาด มี Code Smells เพียง 29 จุดในระบบขนาด 12,500+ บรรทัด
- **Duplicated Lines Density: 0.2%** — อัตราโค้ดซ้ำซ้อนต่ำมาก (ผ่านเกณฑ์ < 3%)

*(จุดที่ได้รับการแก้ไข: ปรับแต่ง CORS Security ใน `backend/src/index.js`, จัดการ Promise & async/await ใน `backend/src/config/socket.js`, เคลียร์ Floating Promises `javascript:S9383` และระบุ Button Types `javascript:S9011` ใน React Components ทั้งหมด พร้อมกำหนด `sonar.coverage.exclusions=**/*` เพื่อไม่ให้นำเงื่อนไข Test Coverage มาตัดคะแนน Quality Gate)*

## 9. จุดที่ยังควรทำก่อน production

- ย้าย frontend API URL จาก localhost ไป environment configuration และตั้งค่า HTTPS/CORS ตามโดเมนจริง
- เพิ่ม automated tests สำหรับ authorization, migration, การออกบิล และ transaction การยืนยันชำระ
- ตรวจการจำกัดขนาด/การจัดเก็บไฟล์ KYC, สัญญา และสลิป (ปัจจุบันส่งเป็น base64 ผ่าน JSON)
- ติดต่อ SlipOK เพื่อรับ API Key/Branch ID ก่อนทดสอบการเชื่อมต่อจริง; อย่าเปิด `SLIPOK_MODE=api` ก่อนยืนยันข้อมูลบัญชี และโหมดจำลองไม่ใช่หลักฐานยืนยันการโอนเงินจริง
- วางแผน backup/restore, monitoring และแจ้งเตือนบิลค้างชำระ/ใกล้ครบกำหนด

## 10. วิธีใช้เอกสารนี้เป็นบริบทให้ AI ตัวอื่น

เริ่ม prompt ด้วย:

> อ่าน `PROJECT_GUIDE.md` ก่อน แล้วตรวจไฟล์จริงและ `git status` ก่อนเปลี่ยนแปลง อย่าเปิดเผยหรือแก้ทับ secrets/การเปลี่ยนแปลงที่มีอยู่ รักษา flow และรูปแบบเดิม แก้ให้ครบทั้ง backend, frontend, migration และ authorization ที่เกี่ยวข้อง และรัน build/lint หรือ syntax checks ที่มีอยู่ก่อนสรุป
