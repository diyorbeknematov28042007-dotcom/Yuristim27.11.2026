# Yuristim — Project Source

> 27.11.2026 | Asosiy loyiha hujjati | Rejalashtirish tasdiqlangan, implementatsiya tekshirilmagan.

Yuristim — O‘zbekiston uchun AI yordamidagi huquqiy ekotizim: veb-sayt, Telegram Mini App va Telegram bot, alohida web Admin Panel. Ushbu README yagona loyiha spetsifikatsiyasi va qarorlar reyestri. Loyiha egasi yakuniy qarorlarni tasdiqlaydi. Quyidagi matn tasdiqlangan qarorlarning konspekti, to‘liq suhbat stenogrammasi emas. 10.02–10.16 faqat umumiy darajada tasdiqlangan; batafsil texnik yechimlar implementatsiyada tekshiriladi.

## Mundarija
1. [Mahsulot](#1-mahsulot)
2. [AI](#2-ai)
3. [Yurist-topish](#3-yurist-topish)
4. [Yuridik izlanish](#4-yuridik-izlanish)
5. [Interaktiv xizmatlar](#5-interaktiv-xizmatlar)
6. [Hisob](#6-hisob)
7. [Admin](#7-admin)
8. [Moliya](#8-moliya)
9. [Design System](#9-design-system)
10. [Arxitektura](#10-arxitektura)
11. [Roadmap](#11-roadmap)
12. [Ishlash qoidalari](#12-ishlash-qoidalari)

## 1. Mahsulot
- №001: Yagona hisob, yagona backend, to‘rtta asosiy xizmat: Yuristim AI, Yurist topish, Yuridik izlanish, Interaktiv xizmatlar. Kengaytiriladigan arxitektura.
- Tillar: o‘zbek, rus, ingliz. Valyuta UZS, vaqt Asia/Tashkent.
- Platforma huquqiy axborot beradi, natijani kafolatlamaydi; zarur hollarda mutaxassisga yo‘naltiradi.

## 2. AI
- №002: Lite — kundalik huquqiy savol-javob; Pro — chuqur tahlil, hujjat, fayl, rasm, ovoz. Ikkalasida tarix va tekshirilgan manbalar.
- №003: Ichki qonunchilik bazasi + rasmiy internet qidiruvi; hujjat, modda, havola, amaldagi tahrir; Pro kengroq tadqiqot.
- №004–005: iOS uslubidagi chat, hamburger, markaziy model segmenti, profil, logo, pastki composer. Yangi chat, tarix, nomlash, o‘chirish, edit, regenerate, copy/share/rate/stop. №084 bo‘yicha model nomlari Lite / Pro, Chat / Work emas.
- №006: Pro professional tools avtomatik yoki qo‘lda, aniqlashtirish, bosqichlar, progress, editor, eksport.
- №007: PDF/DOCX/DOC/TXT/JPG/JPEG/PNG tahlili, OCR, taqqoslash, xato va risk darajalari, manbalar, maxfiy saqlash, o‘chirish.
- №008: Ariza, da’vo, shartnoma, shikoyat, ishonchnoma va boshqa hujjatlar; chat/shablon/mavjud fayl, tahrirlash, autosave, versiyalar, PDF/DOCX, chop etish. Uydirma ma’lumot yo‘q; avtomatik sudga yuborish yo‘q.
- №009: Ovozli input, read aloud, live voice, interrupt/mute/subtitr/transkript; UZ/RU/EN; audio roziliksiz doimiy saqlanmaydi. Provayder va limitlar keyin.
- №010: Tarix, qidiruv, pin/archive/delete, rozilik asosida xotira, temporary chat, Pro professional task memory, alohida ishlar izolyatsiyasi.
- №011: Lite qisqa, Pro tahlil/risk/yechim/xulosa; manba kartasi hujjat/modda/band/tahrir/tekshiruv sanasi/rasmiy link. Fakt va AI xulosasi ajratiladi.
- №012–017: Kredit va tarif qoidalari 8-bo‘limda; barcha AI funksiyalari kredit yetarli bo‘lsa Free tarifda ham ochiq, Research bundan mustasno.
- №018: Lite Google Gemini API, Pro OpenAI GPT API. Model registry; aniq model ID va voice/OCR provayderlari keyin tekshiriladi.
- №019: Qonunchilik avtomatik va admin orqali yangilanadi: soatlik o‘zgarishlar, kunlik tekshiruv/backup, tarixiy va kelajakda kuchga kiruvchi tahrirlar. Lex.uz, Sud.uz va boshqa rasmiy manbalar; kirish huquqi tekshiriladi.
- №020: Shifrlash, izolyatsiya, maxfiy kalitlar, 2FA admin, audit, rozilik, eksport/o‘chirish. Oddiy chat/hujjat/xotira o‘chirilguncha, temporary max 24h, upload 30d, moliya qonuniy muddat. Lokalizatsiya va retention huquqiy tekshiruv talab qiladi.
- №021: Profil, til, tema, notification, voice, tarif, tarix, privacy/security/help. Javob tili, hajmi, uslubi, darajasi, custom instructions, memory; tema qurilmaga xos.

## 3. Yurist topish
- №022: Katalog, profil, verifikatsiya, qidiruv, AI tavsiya, telefon/Telegram, sevimlilar, sharhlar. Ichki chat, buyurtma, video yoki xizmat to‘lovi yo‘q.
- №023: Yurist/advokat qo‘lda verifikatsiya; ariza, maxfiy hujjatlar, admin tasdiq/rad/sabab/qayta topshirish/revoke/audit.
- №024: Ism, foto, maqom, soha, tajriba, hudud, bio, kontakt, ta’lim, tillar, xizmatlar; narx/ofis/sertifikat ixtiyoriy. Muhim o‘zgarish qayta tekshiriladi. Ko‘rish/kontakt bosish/sevimlilar statistikasi mijozlar soni emas.
- №025: Fuqarolik, jinoyat, oila, mehnat, iqtisodiy, ma’muriy, soliq, yer, uy-joy, meros, bank-moliya, korporativ, IP, xalqaro, migratsiya, bojxona, ijtimoiy ta’minot, ijro, iste’molchi, boshqa. Hudud/soha/tajriba/til/rating/narx/masofaviy filtr; relevance default.
- №026: Kontakt tugmasi bosilgan bo‘lishi kerak (xizmat isboti emas), 1–5 yulduz, ixtiyoriy matn/anonimlik, bir faol sharh, edit/delete/reply/moderation; arifmetik o‘rtacha; soxta sharh taqiqlanadi.
- №027: V1 bepul, komissiya va pullik rating yo‘q; kelajak reklama belgilangan.
- №028: Professional kabinet, profil, xizmatlar, statistika 7/30/90, verifikatsiya, sharhlar; web/Mini App to‘liq, bot qisqa.
- №029: Shikoyat, dalil, ID, ikki taraf, asosli qaror, ogohlantirish/yashirish/blok/revoke/apellyatsiya. Platforma xizmat shartnomasining tarafi emas.

## 4. Yuridik izlanish
- №030: Mustaqil AI Deep Research, milliy/xorijiy huquq, ilmiy maqola, kitob, dissertatsiya, sud amaliyoti, xalqaro manbalar, statistika.
- №031: Source Finder, Deep Research, Academic Research. Reja → tasdiq → parallel qidiruv → tekshiruv → tahlil → hisobot → citation audit. Background job, stop, progress, bildirishnoma.
- №032: OpenAlex/Crossref/Semantic Scholar/Unpaywall/Lex.uz/ichki baza/web search; DOAJ va xalqaro manbalar qo‘shimcha. DOI, muallif, nashr, retraction, relevance, metodologiya, full-text tekshiruvi. Paywall bypass yo‘q; abstract-only belgilanadi.
- №033: Hisobot, literature review, taqqoslash, bibliography, research gap; APA/OSCOLA/Chicago/GOST; PDF/DOCX/BibTeX/RIS/TXT/MD; editor, autosave, versiya, eksport. Uydirma manba yoki o‘qilmagan matnni o‘qilgan deb ko‘rsatish yo‘q.
- №034: Eng kuchli mavjud OpenAI reasoning modeli, maksimal reasoning, yashirin downgrade yo‘q. Xarajat bahosi, rozilik, rezerv, haqiqiy sarf, ortiqcha rezerv qaytariladi.
- №035: Loyihalar, kutubxona, notes, folders/tags, izolyatsiyalangan xotira. Faol Pro obuna + kredit barcha pullik amallar uchun; Free oldingi natijalarni ko‘rish/nusxalash/link/o‘chirish/balans. Jamoa funksiyasi V1 yo‘q. AI/API va bevosita infra ×4.
- №036: Mavzu, rejim, til, geografiya, davr, manba turi, full text, citation style, max budget; Pro 3 concurrent, 50MB/file, 10/upload. 30/100/300 manba va 3/15/40 daqiqa faqat taxminiy maqsad. Real progress, stop, intermediate result, idempotent retry.
- №037: Saqlash xarajati davriy 30d; Pro tugasa read-only, 1–30d grace, 31–90d archive/storage, 90d dan keyin to‘lanmagan fayllar ogohlantirish bilan o‘chiriladi; asosiy hisobot matni/metadata saqlanadi. Manfiy balans yo‘q.
- №038: Izlanish/Loyihalar/Kutubxona/Tarix, web/Mini App to‘liq, bot start/monitor/report/notify.
- №039: Admin sifat, manba, model, xarajat, storage, monitoring; OpenAI outage pause, budget stop, citation audit, maxfiylik.

## 5. Interaktiv xizmatlar
№040–049: 8 ta deterministik, bepul, 0 kredit xizmat; TypeScript Workers + D1 versioned legal parameters, rasmiy manba, BHM/MHEKM, tarixiy sana, UZ/RU/EN. AI alohida.
| Qaror | Xizmat | Qamrov |
|---|---|---|
| 041 | Aliment | Ulush, minimum, qat’iy summa, qarz, indeksatsiya, jadval |
| 042 | Davlat boji | Sud/notarial, foiz/fixed/min-max, imtiyoz, kechiktirish, qaytarish |
| 043 | Mehnat | Ish haqi, ta’til, kompensatsiya, overtime/tun/bayram, termination |
| 044 | Huquqiy muddatlar | Protsessual, da’vo, apellyatsiya, mehnat, meros; bayram, suspension/interruption; eslatma 30/7/3/1/0 kun |
| 045 | Meros | Qonun/vasiyat, majburiy ulush, er-xotin mulki, navbat, qarz, representation/transmission |
| 046 | Jarimalar | Yo‘l/ma’muriy/mehnat/soliq va boshqa; modda, BHM, chegirma, takroriy, apellyatsiya |
| 047 | Sudlovlilik | Predmet/hududiy/alternativ/mutlaq/shartnomaviy/bog‘liq; sud katalogi va huquqiy asos |
| 048 | Ipoteka | Boshlang‘ich to‘lov, annuitet/differensial, jadval, taqqoslash, muddatidan oldin to‘lash |
| 049 | Umumiy boshqaruv | Xizmatlar/Tarix/Eslatmalar, versioning, admin tasdiq, rollback, legal+technical tests |
Formulalar va stavkalar amaldagi qonunchilik bo‘yicha tekshirilmaguncha productionga chiqmaydi. Davlat jarimalarini shaxsiy tekshirish/to‘lash, bank API va arizalar keyin.

## 6. Hisob
- №050: Faqat Telegram auth. Bot /start, Mini App server-side initData verification, web secure Telegram auth. Telegram ID + internal ID, username identifikator emas. Replay protection, sessiyalar, audit.
- №051: Onboarding faqat “Sizni kim deb chaqirsak bo‘ladi?”; Free, 2000 weekly, auto language, system theme. Terms/privacy consent huquqiy tekshiruv.
- №052: Telegram orqali recovery, web 30d renewable, device sessions/revoke/new device alert; HttpOnly Secure SameSite cookies, admin TOTP. Telegram hisobini yo‘qotish access yo‘qotishiga olib kelishi mumkin.
- №053: Yagona kabinet: profil, kredit/ledger, tarif, obuna, personalization, memory, voice, til/tema, notifications, privacy/security, sessions, export/delete, professional cabinet, help/logout. Tema lokal.
- №054: Bepul ZIP/JSON export, background, secure download 24h; account deletion reauth+confirmation, darhol disable/revoke, irreversible deletion job, moliyaviy qonuniy retention, backup max30d. Security logs 90d. Refund va lokalizatsiya tekshiriladi.

## 7. Admin
- №055: Alohida responsive web admin, Telegram+TOTP, RBAC, bot alerts, Mini App admin yo‘q.
- №056: Owner yagona, Super Admin/Admin/Moderator/Support; least privilege, default deny, Owner tarif/koeffitsiyent/Super Admin nazorati, audit, maxfiy access asoslangan/vaqtli, secrets masked.
- №057: User metadata, ledger, usage, sessions, support; warning/restrict/suspend/ban/unblock, credit correction ledger, Pro grant, revoke. Impersonation/direct balance edit/ledger deletion yo‘q. Antifraud, appeal.
- №058: Revenue/cost/margin/service/model/user/tariff/resource, XLSX/CSV/PDF, overhead alohida, Owner pricing/budgets.
- №059: Model registry, API key rotate/test/disable, prompt version/draft/test/approve/rollback, quality/citations, outage pause, no double charge.
- №060: Legal Knowledge Center: hujjat/tahrir/modda/kuchga kirish sanasi, diff, impact, index, quarantine, hybrid FTS/vector/RAG, rasmiy matnni asossiz o‘zgartirmaslik.
- №061: Infra monitoring, independent emergency stop, dev/staging/prod, daily backup max30d, monthly restore test; RPO15min/RTO60min faqat tekshirilmagan maqsad.
- №062: Notification center, bot/web/Mini App, consent Web Push, UZ/RU/EN, templates, campaigns, schedule, dedup, marketing max2/week, news1/day, quiet22–08 (urgent/user reminders mustasno).
- №063: FAQ + human tickets, status Open/Assigned/In Progress/Pending/Resolved/Closed/Reopened; Pro priority same severity. Ish vaqtidagi SLA maqsad P0 15min/P1 1h/P2 6h/P3 24h, kafolat emas.
- №064: WAF/DDoS/rate/auth/RBAC/isolation/prompt injection/antifraud/audit, SEV1–5; security logs90d/API30d/audit365d qonuniy tekshiruv bilan; Owner emergency recovery protokoli keyin. Pentest prelaunch/major.
- №065: Global settings, feature flags, rollout, maintenance, versioned terms/consent, config approval/rollback, D1 authoritative, KV noncritical.
- №066: DAU/WAU/MAU, activation, conversion, retention, churn, funnel/cohort, A/B safety cheklovlari, minimal events, no private content, export PDF/XLSX/CSV/JSON.
- №067: 14 admin modul: Dashboard, Users, AI, Lawyers, Research, Interactive, Finance, Legal Knowledge, Infrastructure, Notifications, Support, Security, Analytics, Settings. Desktop-first, emerald, Inter, Lucide, light/dark/system, UZ/RU/EN; React/TS/shadcn/Tailwind/Recharts/TanStack taklif.

## 8. Moliya
- №012–017: 1 kredit = 1 so‘m nominal; actual API va bevosita infra ×4. Free haftasiga 2000, dushanba 00:00 Tashkent reset, foydalanilmagan weekly expire. Pro 49 000 so‘m/30d, 70 000 kredit + weekly 2000; subscription credits expire, purchased never expire. Free file5MB/3 per message/1 concurrent Pro task; Pro50MB/10/5 concurrent; Research alohida 3 concurrent. Chat unlimited, AI/voice balance-dependent, Pro priority. Balance breakdown/ledger/expiry/refunds.
- №068: To‘lovlar va haqiqiy xarid V1 hozircha “Ishlanmoqda”, backend flags off. Soxta payment yo‘q. Admin test grant audit bilan.
- №069: Paketlar 10k/25k/50k/100k/250k/500k, custom5k–5m integer, 1:1 UZS, bonus0%, purchased expire qilmaydi.
- №070: Manual renewal, early renewal keyingi siklga queue, overlap yo‘q, reminders7/3/1/0, expiry downgrade, Research read-only. Admin grant revenue emas.
- №071: Append-only ledger, correction linked, reserve expense emas, money/credit separate, actual cost settlement, consent before exceeding, no negative, atomic/idempotent. Payment lifecycle Created/Pending/Verified/Processing/Completed/Failed/Cancelled/Expired/Refunded/Disputed (disabled).
- №072: System/provider no-result error100% credit compensation; duplicate/wrong-price difference; user stop actual cost; quality review. Original bucket; expired weekly/sub compensation7d; purchased nonexpire. Claim free, internal30d, 24/72 working-hour targets. Money refund keyin.
- №073: Promo/trial, promo default30d; spending weekly → compensation7d → promo/bonus → subscription → purchased; earliest expiry within bucket. Trial configurable, no automatic70k, no auto-payment. Code/budget/limits/antifraud.
- №074: Referral inviter2000/invitee1000, 30d bonus, 100 rewarded/month, 3 successful AI operations +72h review, one inviter, no self/multilevel/cashout. Max direct750 UZS at ×4 excluding other costs.
- №075: Cost Engine versioned prices, measured vs allocated, daily CBU FX, last verified fallback alert, 1 credit=1m integer microcredit units, estimate/reserve/settle, budget alerts50/75/90/100%, stop new affected jobs, unknown cost restrict.
- №076: Forecast, break-even, MRR/ARPU/ARPPU/CAC/LTV/churn/burn/runway; target direct margin≥60%, operating≥25%, conversion≥5%, LTV/CAC≥3, reserve3mo. Targets not measured.
- №077: Credit/Subscription/Cost/Pricing/Promo/Referral/Compensation/Budget/Reservation/Payment Adapter/Reconciliation/Analytics modules. D1 authoritative ledger, no cached balance, concurrency/idempotency/expiry/restore tests. Valid reserved credits survive expiry for approved task; unused expired not restored.

## 9. Design System
- №078: Original geometric emerald logo, premium iOS style, white/light gray, grouped settings, sidebar, center model selector, bottom composer; no fake device chrome.
- №079: Brand #00865F, #005C40, #DDF5E9, #F0FAF5. Light #FFFFFF/#F5F6F8/#101114/#606878/#E5E7EB. Dark #101312/#171B19/#202523/#F5F7F6/#A1ABA6/#303934/#153D2E/#34C997/#23A77C. Semantic success #00865F, warning #A16207, error #DC2626, info #2563EB, Pro #7C3AED.
- №080: Apple native system font where available, Inter otherwise/admin; display36/44 700, H1 28/36 700, H2 24/32 600, H3 20/28 600, title18/24 600, body16/24 400, button16/24 500, secondary14/20, caption12/16. Docs Times New Roman or suitable alternative. No SF Pro redistribution.
- №081: React TS Tailwind shared accessible components; button36/44/52, touch44, radius4/8/12/16/24/full, spacing4/8/12/16/20/24/32/40/48/64; mobile padding16. Inputs/cards/sheets/dialogs/segments/all states.
- №082: Original logo unchanged, Lucide outline SVG16/20/24/32/48 stroke1.8, sticker transparent1:1 SVG/WebP/PNG, master1024/display64–160, WebP target≤100KB, lazy, kebab-case, alt/decorative, Asset Registry. ZIP audit pending.
- №083: Motion button100ms/icon150/switch200/model200/tooltip150/sidebar280/page300/sheet300/modal250/success500/splash400; CSS/Motion/Lottie, haptic supported, Reduce Motion, real progress, target60FPS, assets≤150KB guideline.
- №084: Lite/Pro labels; sidebar logo/AI/Lawyers/Research/Interactive/recent/history/profile; default AI, no global bottom nav. Mobile overlay85% max340, desktop280/72, header56/64. Lawyers Katalog/Sevimlilar/Kabinet; Research Izlanish/Loyihalar/Kutubxona/Tarix; Tools Xizmatlar/Tarix/Eslatmalar. Bot /start /menu /new /balance /profile /help /cancel. Authenticated deep links.
- №085: Mobile-first breakpoints320–479/480–767/768–1023/1024–1279/1280–1535/1536+, grids4/8/12, padding16/24/32, gutters12/16/24, safe area, keyboard, orientation, desktop split editor/research.
- №086: Light/Dark/System default System, device-local, prefers-color-scheme, Telegram themeChanged, explicit override, no flash/reload, 150ms transition/reduced motion, official docs white/black, no AMOLED/custom color V1. Dark prototype tokens differ from №079 (#101114/#1C1E22/#F5F6F8/#A1A8B3/#30343B/#42C99A/#153D30); reconcile with Owner before implementation.
- №087: WCAG2.2 AA target, 14–24px text, line1.5–2, 200% zoom/400% reflow, contrast4.5:1 normal/3:1 large/relevant UI, screen readers, keyboard/focus/skip links, touch44, high contrast, reduce motion, haptic/subtitles, accessible alternatives. Free settings; voice API existing credit rules. Audit required.
- №088: Loading/skeleton/empty/no results/offline/error/success/credits/access/maintenance/coming soon. Indicator after200ms, explanation after10s, real progress, toast3–5s, critical persistent. Safe drafts, no uncontrolled private cache, offline calculators trusted version/date only. Safe error ID, no secrets, server authoritative finance, 0 credit display.
- №089: Shared tokens/UI/icons/assets/motion/themes/accessibility/localization/layout/adapters for web/Mini/admin; bot native brand/translations. React/TS/Tailwind/Radix/shadcn/Lucide/Motion/Lottie/Storybook/Vitest/Playwright/axe-core/pnpm/GitHub Actions. Semver/changelog/Owner approval, visual/unit/accessibility/responsive/performance tests. No separate documentation files per Owner instruction; update this README.

## 10. Arxitektura
№090: Cloudflare-first Modular Serverless, API-first, TypeScript, REST+SSE, WebSocket when needed, provider adapters, monorepo, GitHub Actions, isolated dev/staging/prod. 16 logical modules, not necessarily 16 Workers: Account, Auth, AI, Research, Lawyer, Interactive, Financial, Knowledge, Document, Storage, Notification, Support, Admin, Analytics, Security, Job.

Client (Bot/Mini/Web/Admin) → Cloudflare Edge (DNS/TLS/WAF/rate limit) → API Gateway (auth/RBAC/routing) → business modules → infrastructure/external adapters.

| Resource | Purpose |
|---|---|
| Workers | Backend/API |
| D1 | Relational authoritative data |
| R2 | Private files/exports/archives |
| Vectorize | Semantic retrieval |
| Queues | Async tasks |
| Workflows | Multi-stage jobs |
| Cron | Scheduled operations |
| KV | Noncritical cache |
| Durable Objects | Coordination only if needed |
| AI Gateway | Monitoring subject to privacy review |
| Analytics Engine | Minimal analytics |
| Secrets | Server-side keys |
| Static Assets | Future frontend hosting option |

AI pipeline: authenticate → authorize → model selection → estimate/reserve → legal retrieval → provider → validate citations → settle actual cost → result/history. Streaming may precede final settlement, clearly marked.

### 10.01–10.16 scope
10.01 Core System Architecture detailed approval. Remaining topics approved in principle only:
10.02 Cloudflare Infrastructure; 10.03 Backend; 10.04 Database; 10.05 Storage; 10.06 API Gateway; 10.07 AI Integration; 10.08 Legal Knowledge/RAG; 10.09 Jobs/Workflows; 10.10 Real-time/Sync; 10.11 Security; 10.12 Performance/Scalability; 10.13 DevOps/CI/CD; 10.14 Testing/QA; 10.15 Disaster Recovery/Backup; 10.16 Production Deployment.

### Database and API boundaries
Detailed schema and endpoint contracts not yet approved or implemented. Required domains: users/sessions/RBAC, conversations/messages/memory, documents/files, lawyers/verifications/reviews/complaints, research/jobs/sources/projects, legal documents/versions/articles, calculators/reminders, credit buckets/ledger/reservations/subscriptions/costs/promos/referrals, notifications/support/audit/config. Design atomic finance and idempotency first. Version APIs, validate inputs, authorize every resource, safe errors, pagination, rate limits, no client-trusted balances. Exact tables/routes require audit and tests.

## 11. Roadmap
All implementation items below pending verification; planning is not deployed software.
- [x] Product decisions 001–089 and core architecture 090; remaining architecture topics approved in principle.
- [x] New canonical repository selected: Yuristim27.11.2026.
- [ ] Repository/infrastructure audit and old migration inventory.
- [ ] Backend foundation and isolated staging.
- [ ] Telegram auth/account/session.
- [ ] Financial Core and ledger tests.
- [ ] Design System and asset audit.
- [ ] AI Lite/Pro and legal knowledge/RAG.
- [ ] Lawyer directory and verification.
- [ ] Research.
- [ ] Eight interactive services and legal formula review.
- [ ] New web/Mini App.
- [ ] Telegram bot integration.
- [ ] Admin Panel.
- [ ] Integration, security, accessibility, load and recovery tests.
- [ ] Production release approval.

### Open blockers
- Existing migration branch, draft PR #21 and staging D1 were referenced for the previous repository; do not assume they exist here. Audit before reuse. Do not modify old repo or old frontend without Owner instruction.
- API keys to be connected later; no secrets in Git. Rotate any previously shared bot token before real use.
- Payments disabled until Owner/legal/payment provider approval.
- Uzbekistan personal-data localization, retention, provider terms, official source access, legal formulas, cloud limits/prices, model IDs, document processing feasibility require verification.
- Sticker/animation/design archives not audited; color token conflict №079/086 unresolved.
- No claim of WCAG compliance, RPO/RTO, actual margin or production readiness before tests.

## 12. Ishlash qoidalari
- Owner is final decision maker. Implement approved scope; material changes require approval. Record changes here with date, decision ID and reason.
- Never expose secrets, tokens, private user data or sensitive logs. This repository is public.
- Do not invent completed work, test results, legal citations, API access or infrastructure.
- No destructive changes, production deployment or real payments without appropriate authorization.
- Keep old frontend untouched. New frontend development is separate from previous backend migration.
- Before changes inspect existing files and branch; avoid overwriting unrelated work. Small reviewable commits, tests, rollback plan, environment separation.
- Report changed paths, commit, tests actually run, blockers, next step. Update README as the single documentation source.
- This README is a condensed project baseline, not a verbatim transcript; consult Owner/project conversation for ambiguity rather than silently inventing requirements.

### Changelog
- 27.11.2026: Decisions 001–090 summarized; 10.02–10.16 marked general approval; new repository selected; Owner requests all documentation in README.md only.


## 13. Development Stage 02 — Infrastructure Audit (27.11.2026)
Status: initial read-only inventory completed; functional/security audit pending.
- New repo: main only, README.md only, no Actions runs at audit time. Old migration branch and PR #21 returned 404 at previously referenced repository; recovery/access not confirmed.
- Cloudflare: 5 existing Workers, 4 D1 databases. Existing Workers and databases preserved; no deployment or resource changes.
- Workers: bot staging, P1 API staging, P1 frontend staging, KDF benchmark, V2 staging. All five have zero Cron schedules. Existing deployment history is not evidence of functional readiness.
- D1 application table counts (excluding Cloudflare internal table): P1 staging 17, V2 staging 31, production 3, staging 3. Read-only schema-name inventory; no personal records read. Legacy marketplace, Founding100 and special-login tables require compatibility review; no deletion authorized.
- R2 disabled (HTTP 403, code 10042; enable in Dashboard). KV, Queues, Workflows, AI Gateway, Pages list empty; no Vectorize index found.
- Next recommendation: isolated new staging foundation, preserve legacy resources; assess source recovery and schema compatibility before reuse. Do not use real personal data until localization/security requirements verified. R2 activation required before document storage; not required for initial health/API scaffold. Rotate previously exposed bot token before use.
- Pending: full source recovery, endpoint tests, schema constraints/migrations, billing/limits, DNS/WAF, backups/restore, deployment provenance, secrets validity and legal localization. No production readiness claim.
