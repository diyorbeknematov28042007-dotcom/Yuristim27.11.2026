# Yuristim — Project Source

> 28.11.2026 | Asosiy loyiha hujjati | Stage 03–06 Owner tomonidan tasdiqlangan; Stage 07 implementatsiyasi davom etmoqda.

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
- №082: Original logo unchanged, Lucide outline SVG16/20/24/32/48 stroke1.8, sticker transparent1:1 SVG/WebP/PNG, master1024/display64–160, WebP target≤100KB, lazy, kebab-case, alt/decorative, Asset Registry. Supplied ZIP technical audit passed in Stage 06; ownership/licence confirmation remains pending.
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
Har bir bosqich faqat uning bo‘limidagi real test va deployment dalillari doirasida bajarilgan hisoblanadi.
- [x] Product decisions 001–089 and core architecture 090; remaining architecture topics approved in principle.
- [x] New canonical repository selected: Yuristim27.11.2026.
- [x] Repository/infrastructure audit and old migration inventory.
- [x] Backend foundation and isolated staging.
- [x] Telegram auth/account/session foundation; real credential integrations deferred.
- [x] Financial Core and ledger tests; real payments remain disabled.
- [x] Design System implementation and supplied asset technical audit; ownership/licence and browser visual audit remain pending.
- [ ] AI Lite/Pro (Stage 07 implementatsiyasi davom etmoqda); legal knowledge/RAG Stage 08.
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
- Supplied logo/sticker pack technical audit passed; ownership/licence provenance still requires Owner confirmation. No separate animation binary pack was found because approved motion is code-native. Historical mockups conflict with №050/078/084 and are reference-only. №079/086 dark-token conflict is provisionally resolved in favor of №079 until Owner review.
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

## 14. Development Stage 03 — Backend Foundation (27.11.2026)

Status: **Completed for the approved Stage 03 scope; Project Manager/Owner audit and merge are pending.** Stage 04 has not started.

### 14.1 Architecture and module boundaries

- Implemented a TypeScript/pnpm modular serverless monorepo with one Hono API Worker. The 16 approved domains remain logical modules rather than separate Workers.
- Dependency direction is explicitly registered and cycle-tested: Security is foundational; Account depends on Security; Auth depends on Security and Account; provider-facing AI/Research depend on Auth, Financial, Knowledge and Document boundaries; Admin depends on Auth, Security and Analytics. HTTP transport, configuration, repositories, security ports, logging and contracts are separated.
- Authentication, Telegram initData verification, session management and admin TOTP are ports only. The protected `/api/v1/account` boundary is registered with a default-deny authenticator and returns `401`; no temporary bypass exists.
- Financial business logic and tables were not implemented. The foundation preserves integer-safe/idempotent and append-only patterns for later ledger work through scoped idempotency keys, prepared repositories and append-only audit events.
- Rate limiting is represented by a transport-independent decision port and standardized `429` error. No unreliable in-isolate counter or unnecessary KV/DO resource was introduced; distributed enforcement is deferred until a concrete policy is approved.

### 14.2 Repository structure and stack

```text
apps/api/                 Worker entrypoint, routes, middleware, services and runtime tests
packages/config/          environment parsing and feature flag keys
packages/contracts/       standard API envelopes
packages/core/            16-module dependency graph
packages/database/        prepared D1 repositories and readiness check
packages/errors/          centralized error taxonomy
packages/logger/          structured JSON logging and redaction
packages/security/        auth/RBAC/rate-limit/Telegram/TOTP ports and secure headers
packages/validation/      Zod validation adapter
migrations/               ordered D1 SQL migrations
scripts/                  migration validation and tracked-file secret scan
.github/workflows/        quality gates and manually controlled staging deploy
```

Pinned foundation versions: Node.js 24, pnpm 11.25.0, TypeScript 6.0.3, Wrangler 4.168.0, Hono 4.13.23, Zod 4.6.7, Vitest 5.1.2 and `@cloudflare/vitest-plugin` 1.9.2. The lockfile is committed. Hono/Zod and the Workers test integration were verified by typecheck, Worker-runtime tests and a real staging deployment.

### 14.3 API Gateway and endpoints

Gateway capabilities implemented: cryptographic request IDs, routing, Zod input validation, authentication/authorization ports, empty-by-default CORS allowlist, a 1 MiB header plus bounded streamed-body limit, extensible rate-limit port, centralized safe errors, structured redacted logs, runtime environment validation, D1-authoritative feature flags, standardized D1 deadline/request cancellation handling and secure response headers.

| Method | Endpoint | Staging result | Purpose |
|---|---|---:|---|
| GET | `/health` | 200 | Fast Worker liveness; no D1 dependency |
| GET | `/ready` | 200 | Real D1 `SELECT 1` readiness |
| GET | `/api/v1/status` | 200 | Stage/environment status |
| GET | `/api/v1/version` | 200 | Application and API version |
| GET | `/api/v1/config/public` | 200 | Safe locales/timezone/currency/auth and public capability states |
| GET | `/api/v1/services` | 200 | Real availability; unimplemented services are `disabled` or `coming_soon` |
| GET | `/api/v1/openapi.json` | 200 | OpenAPI 3.1 contract in the standard response envelope |
| GET | `/api/v1/account` | 401 | Stage 04 protected boundary, default deny |
| GET | unknown route | 404 | Standard `NOT_FOUND` response |
| POST | `/health` | 405 | Standard `METHOD_NOT_ALLOWED` response |

Success and error responses use the approved `{ success, data/error, meta.requestId }` contract. Standard categories cover validation, unauthorized, forbidden, not found, conflict, payload too large, rate limited, feature disabled, service unavailable and internal errors. Stack traces, SQL and secrets are never returned.

Staging URL: <https://yuristim-api-v3-staging.diyorbeknematov28042007.workers.dev>

### 14.4 Database foundation

- Created isolated D1 `yuristim-db-v3-staging` (`01d72d07-1fd7-41f7-9550-3cb58333b3e3`), primary location hint EEUR, read replication disabled. No legacy data was copied.
- Applied and verified `0001_system_foundation.sql` and `0002_seed_feature_flags.sql` locally and remotely. `d1_migrations` contains both ordered records.
- Tables: `system_settings`, `feature_flags`, append-only `audit_events`, and `idempotency_keys`; strict tables, JSON checks, indexes, unique constraints, a self-referencing audit foreign key and prepared queries are used.
- All eight required high-risk flags are seeded disabled: AI execution, research execution, real payments, credit purchases, Pro purchases, public lawyer registration, document uploads and production Telegram webhook.
- Recovery baseline: versioned forward migrations and Cloudflare D1 Time Travel capability are available. Export-before-risky-change and restore drills remain mandatory for later production readiness; no restore drill or RPO/RTO claim was made in Stage 03.

### 14.5 Cloudflare resources

Created only the resources required now:

| Resource | Name | State |
|---|---|---|
| Worker | `yuristim-api-v3-staging` | deployed, workers.dev enabled, observability enabled |
| D1 | `yuristim-db-v3-staging` | migrations applied, readiness verified |

Not created: Bot Worker, KV, Queue, Vectorize, Workflows or Durable Objects. They are unnecessary for the Stage 03 executable scope. R2 remains disabled at account level (`HTTP 403`, code `10042`) and was not enabled because that requires Dashboard/billing action. Existing five Workers and four legacy D1 databases were read-only inventoried and were not changed, redeployed, cleared or joined to V3.

Workers Logs are enabled with full staging sampling; automatic traces are enabled at 1% sampling. Application logs contain request ID, timestamp, environment, method, path, status, duration and error category only; authorization, cookies, tokens, Telegram initData, documents, private conversations and PII are redacted or never logged.

### 14.6 Environments and commands

- Development: local Workers runtime and local D1 state; placeholder-only `.env.example` and `.dev.vars.example`.
- Staging: isolated Worker/D1 above; browser origins denied until an approved frontend origin exists.
- Production: configuration contract exists, but no production resource or deployment was created.

Verified project commands:

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:integration
pnpm db:migrate:local
pnpm db:migrate:staging
pnpm deploy:staging
```

`db:migrate:staging` and `deploy:staging` are valid Wrangler commands and require protected Cloudflare credentials. During this run the connected Cloudflare API was used instead of exposing a token to the shell. The restricted executor cannot call Node.js `os.networkInterfaces()` (`uv_interface_addresses`, errno 1), so the long-running `pnpm dev` smoke check is executed on the GitHub Ubuntu runner; Worker-runtime tests use the same generated binding configuration locally.

### 14.7 CI/CD and security checks

- `quality.yml` runs on pull requests and the Stage 03 branch: frozen install, formatting, ESLint, TypeScript, migration validation/local apply, a real `pnpm dev`/`/health` smoke check on the GitHub runner, all Worker-runtime tests, dry-run bundle, tracked-file secret scanning and high-severity production dependency audit.
- `deploy-staging.yml` is manual-only. A trusted branch checkout validates that the input is a full lowercase 40-character SHA, that GitHub contains the exact commit, and that it is an ancestor of the approved Stage 03 branch head before any input-selected checkout. The deploy job then targets the GitHub `staging` environment, so configured required reviewers must approve it, requires protected Cloudflare credentials, re-runs quality gates, applies remote migrations and deploys staging. Missing credentials fail the workflow. There is no production auto-deploy.
- GitHub Actions have `contents: read` only, concurrency controls and timeouts. External setup actions are pinned to reviewed commit SHAs rather than moving tags.
- No API key, Telegram token, Cloudflare token, session secret or personal data is committed. The previously disclosed Telegram token was not used.

### 14.8 Actual test results

Local final quality run:

| Check | Result |
|---|---:|
| `pnpm format:check` | passed |
| `pnpm lint` | passed |
| `pnpm typecheck` | passed |
| `pnpm db:validate` | passed, 2 ordered files |
| `pnpm db:migrate:local` | passed, 2 migrations |
| `pnpm test` | 32 passed, 0 failed, 0 skipped (28 Worker + 4 deployment-policy tests) |
| `pnpm build` | passed, Wrangler dry-run bundle |
| `pnpm security:secrets` | passed, 64 non-lock tracked files scanned before documentation commit |
| `pnpm audit --prod --audit-level=high` | passed, no known vulnerabilities |

Test distribution: API/integration 8 passed; security 10 passed; database 9 passed; module graph 1 passed; deployment policy/workflow 4 passed. Coverage now also includes a body stream larger than 1 MiB without `Content-Length`, pre-start and in-flight request cancellation, D1 deadline behavior, malicious/partial deployment SHA rejection, exact commit verification policy, approved-branch ancestry statuses and workflow input interpolation regression checks.

Real deployment checks passed for Worker availability, `/health`, D1-backed `/ready`, all public endpoints, disabled features, OpenAPI, protected default deny, 404, 405 and rejected CORS. No fake deployment or simulated staging result is recorded.

### 14.9 Important implementation decisions

1. One modular API Worker was selected to minimize deployment and operational complexity; module seams allow later extraction only when scaling or isolation requires it.
2. D1 is the only new persistence resource. Feature flags are authoritative in D1; no noncritical KV cache was created prematurely.
3. CORS is deny-all in staging until an approved web/Mini App origin is known. Non-browser server requests remain available.
4. Authentication is a locked interface, not a stub identity. This prevents Stage 03 from accidentally exposing protected data.
5. No module-level mutable limiter was used because Worker isolates cannot provide reliable global limits. The rate-limit port can later bind to Cloudflare native rules or a coordinated store.
6. Current Cloudflare Vitest integration (`@cloudflare/vitest-plugin`) was selected over the older pool configuration and executes tests inside workerd with a real local D1 binding.
7. R2/Queue/Vectorize/Bot resources were deferred because uploads, background jobs, retrieval and Telegram webhook execution are explicitly outside Stage 03.

### 14.10 Blockers and Stage 04 readiness

- R2 must be enabled by the Owner in Cloudflare Dashboard before private document storage work; no action is needed for Stage 03.
- GitHub staging environment secrets must be configured before the manual Actions deploy workflow can be proven end-to-end. Direct connected-API staging deployment is verified.
- The workflow is wired to the `staging` environment approval gate, but this connection cannot read repository environment protection settings. The Owner must confirm that required reviewers are configured in GitHub Environment settings before relying on human approval enforcement.
- Uzbekistan personal-data localization, retention, legal-source access and production observability pricing/privacy still require legal/Owner review before real user data.
- D1 restore drill, WAF/rate policy tuning, custom domain, production secrets and production deployment remain later audited work.

Stage 04 may build Telegram-only initData verification, replay protection, account/session tables, secure cookies, session revoke flows and admin TOTP on these ports and migrations. Stage 04 must not begin until this draft PR is audited and approved.

GitHub delivery: branch `development/stage-03-backend-foundation`, foundation code commit `3840f7c1b30761575853b78d744d153d888f5d17`, audit-correction code commit `c8825c62c1be4c2119d4868af706df744a020b25`, draft PR <https://github.com/diyorbeknematov28042007-dotcom/Yuristim27.11.2026/pull/1>. Main remains unchanged.

### 14.11 Project Manager audit corrections — BF-001–004

| Finding | Correction | Verification |
|---|---|---|
| BF-001 | `Content-Length` remains an early rejection hint, but every present request body is also read through a bounded stream before routing. At most 1 MiB of accepted chunks are retained; the reader is cancelled immediately on overflow and the verified body is replayed to downstream handlers. | Headerless 17 × 64 KiB stream returns standardized `413`; the same chunked request returned `413` on V3 staging. |
| BF-002 | Manual deployment validates a full lowercase SHA, retrieves the exact commit through GitHub API, and accepts only `identical`/`ahead` comparison states proving that commit is on the approved branch history. Validation runs from a trusted branch checkout before input-selected checkout. The deploy job is behind the `staging` GitHub Environment gate. | Regression tests passed; GitHub compare returned `identical` for the deployed commit and branch head. Environment required-reviewer configuration remains an Owner-verification item. |
| BF-003 | Dispatch input is passed only through an environment variable to the validator. Shell commands contain no direct `${{ inputs.commit_sha }}` interpolation; the deploy command receives only the validated hex output and quotes the environment variable. | Injection strings, partial SHA, uppercase SHA, direct shell interpolation and direct input checkout regression tests passed. |
| BF-004 | All API D1 calls now use one `runD1Operation` policy with a positive timeout and request `AbortSignal`. It refuses to start after cancellation and returns standardized `503` on timeout/cancellation. | Three deadline/cancellation tests passed and `/ready` remained `200` against staging D1. Current D1 binding methods expose no `AbortSignal`; therefore a timeout stops awaiting the query but cannot forcibly cancel an already-started server-side D1 operation. |

Audit correction evidence: GitHub Quality run #10 (`45945342119`) completed successfully with all steps passed. V3 deployment `18d4576fa765450db84901af0dba1331` serves commit `c8825c62c1be4c2119d4868af706df744a020b25`; health, readiness/D1, all public routes, default-deny auth, 404, 405, rejected CORS and headerless chunked oversize enforcement were rechecked successfully. Legacy Cloudflare Worker modification timestamps remained unchanged.

### Stage 03 changelog

- 27.11.2026: Stage 03 TypeScript monorepo, API Gateway, D1 foundation, security/logging/configuration, Worker-runtime tests, CI/CD, isolated V3 staging deployment and real endpoint validation completed; Stage 04 explicitly not started.
- 27.11.2026: Project Manager findings BF-001–004 corrected, regression-tested, passed GitHub Quality run #10 and redeployed to isolated V3 staging; PR #1 remains draft and unmerged.


### Stage 03 — Owner acceptance (27.11.2026)
Project Manager accepted BF-001–004 within the documented audit scope; Owner explicitly approved Stage 03 and PR #1. GitHub merge succeeded: `f0c352a42797e2a36860477f7613c260290ff1ba`. Stage 03 closed; Stage 04 Authentication & Account next. Environment reviewer protection and manual deployment secrets remain unverified; no production deployment authorized. Preserve Stage 03 branch for existing deployment policy until a reviewed replacement is implemented.

## 15. Development Stage 04 — Authentication & Account

Status on 27.11.2026: **Partial — implementation and isolated V3 staging deployment complete; real Telegram login is blocked by missing credentials.** Stage 05 has not started.

### 15.1 Authentication and account architecture

- Telegram remains the only identity provider. A stable internal UUID is the account key; the verified numeric Telegram user ID is unique and Telegram username is metadata only.
- Mini App login verifies `initData` server-side using Telegram's HMAC-SHA256 construction, validates `auth_date`, rejects duplicate fields and stores one-time replay hashes.
- Website login uses Telegram OpenID Connect Authorization Code flow with PKCE S256, state cookie, nonce, RS256/JWKS signature verification and strict issuer/audience/time checks. The deprecated username-based Telegram Login Widget is not used.
- The bot identity adapter accepts only timestamped HMAC-signed internal requests and rejects expired or replayed requests. Telegram recovery challenges are single-use, short-lived and issued only through this trusted adapter.
- Web/Mini App sessions use 256-bit opaque tokens stored only as SHA-256 hashes, `Secure`/`HttpOnly`/`SameSite=Lax` cookies, double-submit CSRF tokens, 30-day sliding expiry, device metadata, individual revoke, logout and logout-all. Bot sessions use opaque bearer tokens.
- All authentication routes use persistent D1 rate limits keyed by HMAC-pseudonymized client IP. IP and user-agent values are never stored in clear text. Missing credentials fail closed with `503`; protected endpoints remain default deny.
- Admin access requires a verified Telegram account, an assigned RBAC role and TOTP. TOTP secrets are AES-256-GCM encrypted, codes have a ±1 step window, used steps cannot be replayed and admin elevation expires after 12 hours.

Transport, authentication/security services, repository access and provider adapters remain separated inside the Stage 03 modular Worker. No additional Worker or paid Cloudflare service was created.

### 15.2 API contract

All routes remain below `/api/v1` and use the standard success/error envelope. The OpenAPI 3.1 document is available at `/api/v1/openapi.json`.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/auth/telegram/mini-app` | Verify Mini App `initData` and create the unified account/session |
| POST | `/auth/web/start` | Create OIDC state, nonce and PKCE authorization request |
| POST | `/auth/web/callback` | Exchange code and verify Telegram OIDC ID token |
| POST | `/auth/telegram/bot/session` | Authenticate a trusted bot identity adapter request |
| POST | `/auth/recovery/telegram/issue` | Issue a one-time recovery challenge through the bot adapter |
| POST | `/auth/recovery/telegram/complete` | Consume recovery challenge and create a web session |
| POST | `/auth/logout`, `/auth/logout-all` | Revoke current or all sessions |
| GET | `/account` | Current unified profile and settings |
| PATCH | `/account/onboarding` | Record “Sizni kim deb chaqirsak bo‘ladi?” |
| PATCH | `/account/profile` | Update display name, locale and notification settings |
| GET/POST | `/account/consents` | Read or record versioned consent |
| GET/DELETE | `/account/sessions[/:sessionId]` | Device/session inventory and revocation |
| GET | `/account/security-events` | Account security event history |
| POST | `/account/export` | Record export request; execution is blocked until private storage exists |
| POST | `/account/deletion` | Disable account, revoke sessions and record reversible deletion request foundation |
| GET | `/account/financial-context` | Stage 05 account-status/ledger-eligibility contract |
| POST | `/admin/auth/totp/setup`, `/confirm`, `/verify` | Admin TOTP lifecycle |
| GET | `/admin/auth/context` | TOTP-gated RBAC roles and permissions |

### 15.3 Database and configuration

Remote and local D1 now track four ordered migrations. `0003_authentication_account.sql` adds strict account, settings, consent, role, session, challenge, replay, rate-limit, encrypted TOTP, append-only security-event and privacy-request tables with foreign keys, unique constraints and indexes. `0004_seed_authentication_flags.sql` adds disabled export/deletion execution flags. Staging verification found all four migration records and zero accounts; no real or synthetic user was written to staging.

Required staging secrets are intentionally absent from source control: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_OIDC_CLIENT_ID`, `TELEGRAM_OIDC_CLIENT_SECRET`, `TELEGRAM_OIDC_REDIRECT_URI`, `BOT_ADAPTER_SECRET`, `AUTH_ENCRYPTION_KEY` and optional `OWNER_TELEGRAM_ID`. They must be added through Cloudflare Secrets after credential provisioning. Placeholder-only local examples are provided. Previously disclosed tokens were not used.

### 15.4 Security and tests

The Stage 04 regression suite covers Mini App signature/freshness/replay, unified identity, bot HMAC, Telegram recovery one-time use, OIDC PKCE/state and RS256 claims, opaque sessions, CSRF, onboarding/profile/consent, session inventory, export/deletion foundations, account-state denial, RBAC, TOTP replay prevention, D1 constraints and the Stage 05 contract.

Final local gates:

| Check | Result |
|---|---:|
| `pnpm format:check` | passed |
| `pnpm lint` | passed |
| `pnpm typecheck` | passed |
| `pnpm db:validate` | passed, 4 ordered files |
| `pnpm db:migrate:local` | passed, 4 migrations |
| `pnpm test` | 42 passed, 0 failed, 0 skipped (38 Worker + 4 deployment-policy tests) |
| `pnpm build` | passed, Wrangler dry-run bundle |
| `pnpm security:secrets` | passed, no known secret pattern |
| `pnpm audit --prod --audit-level=high` | passed, no known vulnerability |

The manual staging deployment policy now authorizes only full SHAs on `development/stage-04-authentication-account`, keeps the GitHub `staging` environment approval boundary, uses minimal permissions and never interpolates dispatch input directly into shell commands. Production auto-deploy remains absent.

### 15.5 Staging deployment and blockers

The existing isolated `yuristim-api-v3-staging` Worker was deployed with application version `0.4.0` and Git commit `0f73d1fc14123090941391767038ae93dc09897c`; deployment ID `3aabd465a6464c64a9707b70a86f4ce6`. The existing `yuristim-db-v3-staging` received migrations 0003–0004. Observability remains enabled, query strings are now redacted, and all legacy Workers/D1 databases were left untouched.

Real checks at <https://yuristim-api-v3-staging.diyorbeknematov28042007.workers.dev> returned: `/health` `200`, D1-backed `/ready` `200`, `/api/v1/version` `200` with `0.4.0` and the deployed SHA, `/api/v1/config/public` `200`, protected `/api/v1/account` `401`, OpenAPI `200` with 22 paths, and Mini App login `503` because authentication secrets are deliberately not configured. This is fail-closed behavior, not a successful real Telegram login.

Remaining blockers:

1. Owner must provision fresh Telegram bot and OIDC credentials, set the Cloudflare secrets, register the exact web redirect URI and provide the verified Owner Telegram ID before real Mini App/web/bot/admin login can be tested.
2. R2 is still unavailable, so export execution remains `blocked_storage`; no billing-dependent service was enabled.
3. Final irreversible deletion/anonymization, legal retention rules and export artifact generation remain later privacy/legal work; Stage 04 only supplies the safe request and immediate account-disable foundation.
4. GitHub staging required-reviewer settings and Actions Cloudflare secrets remain Owner-verification items. Direct connected-API deployment is verified.

### 15.6 Stage 05 readiness

`AccountFinancialContext` and `/api/v1/account/financial-context` expose only internal account ID, status and ledger eligibility. This lets Stage 05 enforce active-account and no-deletion-pending rules without depending on Telegram identity or session tables. No ledger, credits, balance or payment logic was started.


### Stage 04 — Owner acceptance
Owner approved Stage 04 implementation with outstanding integrations deferred. PR #2 merged into main: `f647ac69d6908cadde1b7b8a1f123b5f0af667f5`. Real Telegram authentication, R2 export, final deletion/retention and deployment environment verification remain pending; no production authorization. Stage 05 Financial Core may begin. Per Owner direction, use concise stage reports and defer comprehensive audit to integration/testing, without deferring critical security fixes.

## 16. Development Stage 05 — Financial Core

Status on 28.11.2026: **Completed within the authorized Stage 05 scope; Owner audit is pending.** Real payments, credit purchases, Pro purchases and AI provider execution remain disabled by design. Stage 06 has not started.

### 16.1 Financial architecture and invariants

- `AccountFinancialContext` is the account boundary: only active, ledger-eligible Stage 04 accounts may enter Financial Core.
- One append-only ledger and typed credit buckets implement weekly, compensation, promo/referral, subscription, purchased and admin bonus credit sources. The spending order is weekly → compensation → promo/referral/bonus → subscription → purchased, then earliest expiry.
- One credit is represented as `1,000,000` integer microcredits. Provider and direct infrastructure cost is converted to UZS and multiplied by four before reservation; floating-point balances are never stored.
- Reservation, top-up, settlement, release, expiry and grants use D1 transactional batches, prepared statements, database constraints and operation-scoped idempotency. Bucket accounting enforces `initial = available + reserved + consumed + expired`, so negative or duplicated credit cannot be committed.
- Valid reservations survive source-bucket expiry. When such a reservation settles or expires, unused credit from an already-expired bucket moves to expired credit rather than becoming spendable again.
- Weekly `2,000` credits are granted at Monday 00:00 Asia/Tashkent (`0 19 * * SUN` UTC) exactly once per account/week. Hourly maintenance releases abandoned reservations and processes expiry, subscriptions and eligible referrals.
- The official CBU JSON adapter verifies USD/EUR/RUB rate, nominal and effective date daily at 00:10 Asia/Tashkent. Provider failure is safely logged and the last verified rate is used with an explicit stale-rate marker.

### 16.2 Engines and API

Implemented engines: Credit/Ledger, Weekly Credits, Free/Pro Subscription, Cost/Pricing, Reservation, Promo/Trial, Referral, Compensation, Budget, disabled Payment Adapter foundation, Reconciliation and Financial Analytics. Pro is modelled as 49,000 UZS per 30 days with a 70,000-credit bucket; early renewal is queued without overlapping the active term. Admin/trial grants never create revenue.

User routes below `/api/v1/financial` include balance, ledger history, subscription state, cost estimate, reservation create/read/settle/cancel, promo redemption, referral code/apply and the disabled payment-intent boundary. Admin routes below `/api/v1/admin/financial` manage versioned pricing, controlled grants/trials, promos, linked compensation, budgets, verified FX rates, referral activity, reconciliation and analytics. All routes are present in the OpenAPI 3.1 contract.

Financial administration requires authenticated RBAC plus current TOTP elevation. Pricing, FX and budget changes are Owner-only. Payment intent creation is server-side feature-disabled; no request header or client flag can enable payments or purchases.

### 16.3 Database and staging configuration

`0005_financial_core.sql` and `0006_seed_financial_flags.sql` are applied locally and to the existing isolated `yuristim-db-v3-staging`. Remote `d1_migrations` contains six ordered records and 20 Financial Core tables. Append-only ledger triggers, foreign keys, unique idempotency constraints, reservation guards, indexes and strict tables are active.

Financial reservation, promo redemption, reviewed referral reward and weekly grant flags are enabled. `real_payments`, `credit_purchases` and `pro_subscription_purchases` remain disabled. No account, fake payment, fake revenue or fake provider price was inserted into staging. Current USD/EUR/RUB rows were seeded only from the official CBU response and future rows are refreshed by the daily cron.

The existing V3 Worker was updated; no new Worker, D1, R2, KV, Queue, Vectorize or paid service was created. Legacy Cloudflare resources were not addressed by any write operation.

### 16.4 Tests and deployment evidence

Final local gates:

| Check | Result |
|---|---:|
| `pnpm format:check` | passed |
| `pnpm lint` | passed |
| `pnpm typecheck` | passed |
| `pnpm db:validate` | passed, 6 ordered migrations |
| `pnpm test` | passed: 60 Worker tests + 4 deployment-policy tests, 0 failed/skipped |
| `pnpm build` | passed, Wrangler dry-run bundle |
| `pnpm security:secrets` | passed, 92 tracked files scanned |
| `pnpm audit --prod --audit-level=high` | passed, no known vulnerability |

The suite covers parallel reservation overspend, idempotent grants/settlement/compensation, bucket expiry while reserved, abandoned release, spending order, promo capacity races, referral 3-operation + 72-hour eligibility, Pro renewal, budget stop, CBU conversion/fallback, reconciliation, append-only ledger and disabled real payments. GitHub Actions Quality run #19 (`46072813060`) passed for commit `36469101d90eb632114d3f572fdca6e57a526553`.

V3 staging deployment `4fead69f24b64f4e9b137a00e7916300` serves application `0.5.0` at <https://yuristim-api-v3-staging.diyorbeknematov28042007.workers.dev>. Real checks returned `/health` 200, D1-backed `/ready` 200, `/api/v1/version` 200 with the deployed commit, `/api/v1/services` 200 with Financial Core available and payments disabled, OpenAPI 200 with 28 paths, protected financial routes 401 without credentials, unknown route 404, unsupported method 405 and rejected CORS 403.

### 16.5 Remaining integration boundaries and Stage 06 readiness

1. Deferred Stage 04 Telegram credentials are still absent, so authenticated financial transactions were verified in workerd integration tests but not through a real Telegram-authenticated staging session. The deployed boundary fails closed with 401/503 as applicable.
2. No AI/provider contract currently supplies real usage or provider prices. Therefore no fake production pricing version was seeded; Stage 07+ integrations must publish an Owner-approved version before real reservations are created.
3. Real payment provider verification, webhooks, refunds/disputes and revenue recognition remain disabled until a later Owner-approved payment integration. The lifecycle and idempotent adapter boundary are ready.
4. Production reconciliation policy, accounting/tax review, D1 restore drills and operator alert routing require Owner/legal review before real money or production users.

Stage 06 Design System can consume the documented balance, subscription, estimate and reservation contracts without embedding financial rules in the client. Stage 06 must not start and this branch must not merge until Owner review approves the draft PR.


### Stage 05 — Owner acceptance
Owner approved Financial Core implementation and deferred remaining integrations. PR #3 merged into main: `b4e452f19dad9212226b128fda8dc2c98e230226`. Real Telegram-authenticated financial flows, provider pricing, payments/refunds/disputes/revenue recognition, production accounting/tax/reconciliation/recovery remain pending. Payments remain disabled. Stage 06 Design System may begin. Comprehensive audit remains deferred to integration/testing per Owner direction.

## 17. Development Stage 06 — Design System

Status on 28.11.2026: **Partial; implementation, supplied asset technical audit and automated gates pass; Owner provenance/dark-token decisions and real-browser visual audit remain pending.** No product frontend, backend business rule, database, Cloudflare resource or production deployment was added or changed.

### 17.1 Architecture and packages

- `@yuristim/design-tokens` is the framework-neutral source for approved brand/light/dark/semantic colors, typography, spacing, radii, shadows, motion durations, breakpoints and layout dimensions. CSS custom properties expose the same source to every client.
- `@yuristim/ui` is the shared React layer for Web, Telegram Mini App and Admin Panel. It uses typed composition, Radix primitives, Lucide outline icons, Motion adapters and Tailwind CSS utilities without embedding account, AI or Financial Core business logic.
- `@yuristim/design-preview` is a Vite component catalog instead of a full product application. It presents tokens, Light/Dark/System controls, UZ/RU/EN switching, responsive navigation, components, feedback states and asset availability in one review surface.
- Bot clients remain native; the package exports the same UZ/RU/EN brand and feedback translations for reuse. Platform-specific behavior is isolated behind theme, Telegram viewport, haptic and asset adapters.

The package version is `0.6.0`. Public imports are intentionally routed through each package root; product applications must not import internal component files.

### 17.2 Implemented component and platform contracts

| Area | Implemented contracts |
|---|---|
| Primitives | Button (36/44/52 and icon), Input, Textarea, SearchField, Card |
| Interaction | Composer, Modal, Sheet, Dropdown, Switch, Tabs, SegmentedControl |
| Navigation | Sidebar 280/72, mobile sheet max 340/85%, Header 56/64, Lite/Pro selector, local navigation, profile control |
| Layout | Mobile-first 4/8/12-column grid, AppShell, skip link, responsive padding/gutters, safe-area and Telegram viewport wrappers |
| Theme | Light/Dark/System, local device preference, `prefers-color-scheme`, Telegram theme adapter, no-flash boot script, reduced-motion-safe transition |
| Localization | Typed Uzbek/Russian/English common, navigation, theme, model and feedback strings |
| Motion | Approved duration tokens, CSS/Motion reduced-motion policy and optional Telegram haptic adapter |
| Feedback | Loading, skeleton, empty, error, offline, success, insufficient credits, access denied and maintenance |
| Assets | Original logo source, 512 WebP/256 PNG sticker variants, kebab-case/duplicate/source/weight validation and policy-aware Asset Registry |

Only `Lite` and `Pro` are exposed as model labels. There is no global bottom navigation. CSS safe-area variables and 44 px touch targets are applied at the shared layer. Focus-visible styles, keyboard-compatible Radix behavior, labels, live regions and a skip link support the WCAG 2.2 AA target.

### 17.3 Decisions made during implementation

1. The custom Vite catalog was selected as the Storybook-equivalent preview because it adds no separate documentation tree and exercises the exact production package/build path.
2. №079 is the provisional canonical dark palette. The conflicting №086 prototype palette is not mixed into the implementation and still requires explicit Owner resolution.
3. Theme preference is device-local by design; it is not written to the account API. System is the default and an inline bootstrap script prevents an initial wrong-theme flash.
4. The supplied sticker archive (`SHA-256 f943995b…`) contains the original logo plus 11 stickers. The exact original JPEG (`SHA-256 2a61ce2f…`), a transparent 1024 PNG, runtime 512 WebP and 256 PNG fallbacks were retained. All 512 WebP files are 1:1, alpha-enabled and ≤100 KB. `special-login` and `secure-login` remain packaged for provenance but are policy-prohibited because №050 permits Telegram-only authentication.
5. The supplied historical mockup archive (`SHA-256 1d3531b4…`) was not imported into runtime code: it contains fake device chrome, `Chat/Work` labels and password/six-digit login flows that conflict with №050/078/084. It served only as a visual reference.
6. No separate animation binary archive was available or required. Approved animation behavior is implemented code-first through CSS/Motion duration and reduced-motion contracts; no animation was fabricated.
7. Financial values and availability remain server-authoritative. Feedback components accept already-authorized display data and contain no credit calculation or feature-flag bypass.

### 17.4 Development and quality evidence

Run `pnpm design:dev` for the catalog, `pnpm design:build` for its production bundle and `pnpm design:preview` to serve the built catalog. Root `pnpm build` now builds both the unchanged API Worker bundle and the catalog.

Final local gates:

| Check | Result |
|---|---:|
| `pnpm format:check` | passed |
| `pnpm lint` | passed |
| `pnpm typecheck` | passed |
| `pnpm db:validate && pnpm db:migrate:local` | passed; 6 ordered migrations, no new migration |
| `pnpm test:api` | passed: 60 tests |
| `pnpm test:design` | passed: 15 tests in 5 files |
| `pnpm test:workflow` | passed: 4 tests |
| `pnpm build` | passed; Worker dry run + catalog build (397.65 kB JS, 125.92 kB gzip; 35.79 kB CSS, 7.45 kB gzip) |
| `pnpm security:secrets` | passed; 153 tracked files scanned |
| `pnpm audit --prod --audit-level=high` | passed; no known vulnerability |

Design tests cover exact tokens and primary-theme contrast, component state/keyboard behavior, theme resolution, translation parity, asset validation, representative axe-core rules, skip-link/grid/safe-area contracts and the absence of a global bottom navigation. The axe `color-contrast` browser rule is disabled only in jsdom; equivalent approved token pairs have programmatic contrast assertions.

### 17.5 Preview, blockers and Stage 07 readiness

The catalog production build is functional and can be reviewed locally at `pnpm design:dev`. It shows the original logo, audited sticker gallery and policy labels alongside the emerald token palette, component states, Lite/Pro navigation, Light/Dark/System and UZ/RU/EN controls, responsive shell and all feedback patterns. No public/staging preview was deployed because Stage 06 does not authorize new Cloudflare resources or a production product frontend.

Remaining blockers:

1. Owner must confirm original logo/sticker ownership and licence provenance. Technical dimensions, alpha, file weight, naming and archive hashes are verified.
2. Owner must choose the final dark palette between №079 and №086; №079 remains the explicit provisional source.
3. The current execution image has a broken Chromium installation, so real-browser screenshot, Playwright, 200% zoom/400% reflow and cross-browser screen-reader audits were not run. Automated DOM, axe, responsive-contract and production-build tests passed, but this is not presented as a completed visual accessibility audit.
4. Inter font files are not bundled; non-Apple clients use installed Inter when available and fall back to the approved system stack. Font licensing/loading can be finalized with the first product frontend.

Stage 07 can consume tokens, shared components, `Lite`/`Pro` model selection, composer, loading/progress/error/insufficient-credit states and reduced-motion adapters without owning UI primitives. AI provider execution, conversation state, streaming and Financial Core settlement were not started. Stage 07 must not start and this branch must not merge until Owner review approves the draft PR.


### Stage 06 — Owner acceptance
Owner approved Design System implementation. PR #4 merged into main: `94ff9ef82ca962c8d777ab401b13f9edb0f7f372`. Owner confirmed decision 079 dark palette as authoritative over conflicting 086 examples. Asset ownership/licence provenance remains pending and must be resolved before public distribution; Inter font integration deferred to Stage 12; real browser accessibility audit deferred to Stage 15; no public component preview deployment. Stage 07 Yuristim AI may begin. Comprehensive audit remains deferred per Owner direction.

## 18. Development Stage 07 — Yuristim AI

Status on 28.11.2026: **Partial — backend foundation, synthetic regression suite, V3 migrations, deployment and public endpoint verification are complete; the real Gemini probe did not pass.** The bounded Google provider request ended with `SERVICE_UNAVAILABLE` / cancellation at the 45-second timeout after the request contract was aligned with the official Interactions API. OpenAI credentials, approved provider pricing, R2 and a durable background queue are not available, so the affected capabilities remain fail-closed. Stage 08 has not started.

### 18.1 Architecture and provider boundaries

- `@yuristim/ai` owns provider-neutral request/result/stream contracts, prompt-injection guards, safe legal-response notices and the official REST adapters. `GeminiInteractionsAdapter` uses Google Gemini Interactions API with `store: false`; `OpenAIResponsesAdapter` uses OpenAI Responses API with `store: false`. Provider credentials are optional Worker secret bindings and are never read from repository files.
- The only user-visible model names are `Lite` and `Pro`. D1 `ai_model_registry` maps them to Google and OpenAI provider model IDs, versioned maximum-output configuration, streaming state and Financial Core price keys. Admin model changes require Owner role plus recent TOTP. Free/Pro tariff state never changes model eligibility: credit, technical limits and provider readiness are evaluated separately.
- `apps/api/src/services/ai.ts` executes the guarded pipeline: authenticated active account → account-owned conversation → feature/model/provider checks → conservative unit estimate → Stage 05 credit reservation → provider call or SSE → provider-reported usage → idempotent settlement → history/usage event. Missing pricing, secret or usage fails closed. An uncertain provider outcome is marked `reconciliation_required`; the reservation is retained until reconciliation/expiry rather than silently releasing possibly incurred cost.
- Legal answers are always returned as `unverified`, with an explicit caution and an empty verified-citation collection. Stage 07 does not promote model-generated citations. Verified citations and authoritative retrieval remain the Stage 08 Legal Knowledge Base contract.
- Provider tools are not passed through from users. The tool registry response lists document analysis/comparison as blocked by storage, legal lookup as Stage 08 pending and Deep Research as Stage 10 pending. Durable background execution is blocked until Queue/Workflow billing and architecture are authorized.

### 18.2 D1 migrations and data isolation

Migrations `0007_yuristim_ai.sql` and `0008_seed_ai_foundation.sql` introduce strict, indexed tables for model registry, prompt versions, conversations, messages, idempotent runs, consent-bound memories, tool progress, document/version metadata, citations and append-only usage events. All user records include `account_id`; repository queries require both account and object identifiers to prevent cross-account access. Temporary conversations receive a 24-hour deletion deadline and the hourly Worker task redacts message content before soft deletion.

The seed enables the guarded AI execution flag and registers current configurable provider model IDs, but **does not seed provider pricing**. Real user generations therefore remain closed until Owner-approved Gemini/OpenAI price items and verified currency inputs are activated through Financial Core. No fake price, credit, revenue, citation or provider result is created.

### 18.3 API surface

All routes below are under `/api/v1`, use the standard response envelope and default-deny authentication unless explicitly marked as an operational probe.

| Method | Route | State |
| --- | --- | --- |
| GET/POST | `/ai/conversations` | List/search and create Lite/Pro, temporary or persistent conversations |
| GET/PATCH/DELETE | `/ai/conversations/:conversationId` | History, rename, archive, memory preference and soft deletion |
| POST | `/ai/conversations/:conversationId/messages` | Non-stream generation with idempotency and financial settlement |
| POST | `/ai/conversations/:conversationId/stream` | SSE delta/stop/error/completion contract with final settlement |
| PATCH/POST | `/ai/conversations/:conversationId/messages/:messageId` and `/regenerate` | User edit version and controlled regeneration |
| POST | `/ai/runs/:runId/stop` | Persisted cancellation request; stream polls and cancels provider reading |
| GET/POST/DELETE | `/ai/memory` | Explicit-consent persistent memory and user deletion |
| GET | `/ai/models`, `/ai/tools`, `/ai/voice/capabilities`, `/ai/legal-sources/status` | Safe capability discovery without secrets or fake availability |
| POST | `/ai/documents/create` | D1 draft/version foundation; export remains blocked |
| POST | `/ai/documents/upload`, `/ai/documents/:id/export` | Fail-closed while private R2 is unavailable |
| GET/PATCH/POST | `/admin/ai/*` | TOTP/RBAC model registry, prompts, usage and emergency disable |
| POST | `/ops/ai/gemini/probe` | Staging-only, fixed-content, separately secret-authenticated and rate-limited real provider health probe; not a user auth bypass |

### 18.4 Security and privacy

- Sessions, CSRF, active-account checks, request-body limits and CORS from Stage 03–04 are preserved. AI generation adds per-account D1 rate limits and requires an `Idempotency-Key` before any external execution.
- High-risk prompt-injection patterns are rejected server-side. Provider tools are absent from ordinary Lite/Pro requests, so user content cannot authorize arbitrary execution. Conversation/message/memory queries are account-scoped and cross-tenant access returns not found.
- Provider responses use a 25-second abort signal. SSE supports client disconnect, provider cancellation and persisted stop requests; because a remote provider may already have incurred cost before cancellation, unknown-usage runs are held for reconciliation. D1 timeouts retain the Stage 03 limitation: they bound Worker waiting but cannot guarantee cancellation of an already accepted remote database operation.
- Prompts, document contents, conversation contents, authorization headers, Telegram data and API keys are excluded from structured logs. OpenAI and Gemini request persistence is disabled. Emergency model disable requires Owner + TOTP and writes a security event containing only a reason hash.

### 18.5 Testing and operational state

Local Cloudflare Workers tests currently report **72 passed, 0 failed** before the staging deployment pass. The suite covers official provider request privacy, provider-secret fail-closed behavior, prompt-injection rejection, authentication, CSRF, tenant isolation, conversation lifecycle/search, explicit memory consent/deletion, Pro without OpenAI, Lite reservation/usage/settlement/idempotency, SSE final settlement, the protected operational probe boundary, blocked R2 upload, migrations, constraints, append-only records and all previous Auth/Financial regressions. MSW Cloudflare outbound mocks are synthetic and are not described as real Gemini/OpenAI results.

GitHub Actions Quality run [`46137409745`](https://github.com/diyorbeknematov28042007-dotcom/Yuristim27.11.2026/actions/runs/46137409745) passed for commit `ae6b32e37fdf62b2249c26fa454da1200a6b9c74`: formatting, lint, typecheck, local migration, development smoke test, all tests, build, tracked-file secret scan and production dependency audit succeeded. D1 migrations `0007` and `0008` are recorded on staging; `PRAGMA foreign_key_check` returned zero violations, while the absence of an active `ai.*` pricing item keeps real user execution closed.

V3 deployment `e44cb6f9-fc04-45b8-bdd7-31b714a43ce3` (Worker version `f1e34af4-cb5e-4043-a418-c00a39d6b0c1`) serves application `0.7.0` at <https://yuristim-api-v3-staging.diyorbeknematov28042007.workers.dev>. Real checks returned `/health` 200, D1-backed `/ready` 200, `/api/v1/version` 200 with the deployed commit, `/api/v1/services` 200 with Yuristim AI `coming_soon` and documents disabled, OpenAPI 200, and protected `/api/v1/ai/models` 401 without credentials. The separately secret-authenticated real Gemini probe returned 503 after its bounded provider timeout; it is **not** counted as passed and no provider output or cost was represented as real.

V3 resource audit reconfirmed Worker `yuristim-api-v3-staging` and D1 `yuristim-db-v3-staging`; all previous Workers and D1 databases remain unchanged. Only `GEMINI_API_KEY` and the operational probe credential were added as Worker Secrets; no OpenAI secret was added. R2 still returns Cloudflare code `10042` and was not enabled. No Queue, Workflow, Vectorize or paid monitoring resource was created. The repository retains its full-SHA/approved-branch manual staging workflow and GitHub `staging` environment boundary; this deployment used the connected Cloudflare API because the cloud-browser GitHub session was not authenticated.

### 18.6 Blockers and Stage 08 readiness

1. Gemini credentials are present only as a Cloudflare Secret, but the bounded real provider probe timed out/cancelled and remains unverified. Lite user execution must remain fail-closed until provider connectivity and an approved price version both pass.
2. OpenAI API key is absent; Pro architecture is implemented but provider execution remains fail-closed.
3. Owner-approved provider prices are absent; real user AI calls cannot create a financially valid reservation yet. The isolated operational Gemini probe does not create user credits or revenue and is used only for the explicitly authorized staging connectivity check.
4. R2 is disabled, so PDF/DOCX/DOC/TXT/image upload, OCR inputs and PDF/DOCX export cannot be enabled. Existing D1 text-draft/version metadata is not a substitute for private file storage.
5. Durable background jobs require Queue/Workflow authorization; no paid resource was enabled. Voice adapters expose a closed capability contract until a provider/security/cost decision is approved.
6. Stage 08 can consume the model/prompt registry, account-isolated chat context, citation verification states and legal-source status contract. Stage 08 must not begin until Stage 07 Owner review and merge.


### Stage 07 — Owner acceptance
Owner approved the partial AI backend implementation. PR #5 merged into main: `debdde7c56f7d2396b167e74b407cb3cd0c0f9ed`. Gemini operational timeout, OpenAI credentials and verified provider pricing deferred to Stage 15; R2, document analysis/creation and voice execution to be completed by Stage 15; Queue/Workflow activation as needed in later stages subject to authorization. Real user AI execution remains disabled until prerequisites are verified. Stage 08 Legal Knowledge Base may begin. No production authorization; comprehensive audit deferred per Owner direction.

## 19. Development Stage 08 — Legal Knowledge Base

Status on 28.11.2026: **Partial — the verified registry, versioned D1 schema, real FTS5 search, citations, AI retrieval boundary, administration APIs, local quality gates, V3 migrations and deployment are implemented. The complete legislation corpus, automatic full-document ingestion and semantic Vectorize search are not enabled.** Stage 09 has not started.

### 19.1 Architecture and trust model

- `@yuristim/knowledge` owns framework-neutral legal authority/status/completeness types, the exact official-domain allowlist, safe FTS query construction, citation context formatting and the fail-closed semantic-search state.
- `D1LegalKnowledgeRepository` separates database access from HTTP transport. It uses prepared statements and the existing Stage 03 timeout/cancellation policy for source status, effective-date document selection, FTS retrieval, bounded manual imports, ingestion history, quarantine review and reindexing.
- Legal sources are classified as normative registry, judicial authority or official publisher. Documents separately identify normative force, judicial practice and official guidance. A source being official does not turn metadata, commentary or court-practice listings into normative text.
- Versions carry `current`, `historical`, `repealed`, `future` or `quarantined` status, effective date range, source/content hashes, verification state and `full`/`partial`/`metadata_only` completeness. Search never mixes a version outside the requested `asOf` date and excludes quarantined/unverified content.
- AI-grade retrieval excludes `metadata_only` rows. Lite and Pro receive at most five verified D1 passages plus canonical citation metadata. Generated AI text remains `unverified`; only citations resolved from the Legal Knowledge Base are stored as `verified`. No model-generated law or citation is promoted automatically.
- Semantic retrieval is explicitly `blocked_vectorize_not_authorized`; D1 FTS5 remains operational. Vectorize, R2, Queue and Workflow adapters are future boundaries only, and no paid resource was created.

### 19.2 Database, ingestion and update engine

Migrations `0009_legal_knowledge_base.sql` and `0010_seed_verified_legal_sources.sql` add strict/indexed tables for sources, documents, versions, provisions, relations, ingestion runs, change events and quarantine, plus a trigger-maintained D1 FTS5 index. Foreign keys, one-current-version uniqueness, version date checks, source/external-ID uniqueness and provision path uniqueness are enforced.

The initial verified import intentionally contains only **4 real official records**:

| Official source | Imported record | Completeness |
| --- | --- | --- |
| [Lex.uz](https://lex.uz) | Oʻzbekiston Respublikasi Konstitutsiyasi, current 25.07.2026 version; verified 1, 2 and 15-moddalar | `partial` |
| [Sud.uz](https://sud.uz/la/plenum-la/documents-civil-la/) | Oliy sud Plenumi civil-practice decisions №35/2020, №20/2024 and №18/2026 | `metadata_only` |

The database therefore contains 2 sources, 4 documents, 4 verified versions, 6 indexed provisions/metadata rows and 2 completed manual ingestion runs. This is a functional verification corpus, **not the complete Uzbek legislation database**. Sud.uz listing entries are searchable only when `includeMetadata=true` and are never supplied as AI-grade legal text.

Lex.uz and Sud.uz were checked as official sources. Lex.uz exposes official documents and RSS/update metadata, but an explicit bulk automated-ingestion permission/API contract was not established during this stage. Sud.uz public Plenum paths are available, but full-document extraction still requires a stable reviewed adapter. Accordingly, both sources use `manual_verified`, `auto_sync_enabled=0`; hourly and daily scheduler boundaries exist but safely skip remote fetching until access/format approval. No access restriction, robots rule or rate control is bypassed.

### 19.3 API, administration and AI integration

Authenticated user routes:

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/v1/legal/status` | Registry counts, FTS and semantic/ingestion availability |
| GET | `/api/v1/legal/search` | Rate-limited verified FTS5 search with type, authority and effective-date filters |
| GET | `/api/v1/legal/documents/:documentId` | One verified version effective at the requested date |
| GET | `/api/v1/ai/legal-sources/status` | Stage 07 compatibility and verified-source availability |

Administration below `/api/v1/admin/legal` requires an authenticated admin role plus recent TOTP. Source/run/quarantine reads allow `admin`; imports, reindex and quarantine decisions require `owner` or `super_admin`. Manual import accepts only bounded validated content for the registered exact HTTPS domain, computes hashes server-side and writes document/version/provisions/run atomically through D1 batch. It does not fetch arbitrary user-provided URLs.

Search is server-side feature controlled by `legal_knowledge_search`; client headers cannot enable it. `legal_semantic_search` remains disabled. FTS input is normalized and each token is quoted before `MATCH`, so raw SQLite/FTS operators are never executed. Search is limited to 25 rows and 30 requests/account/minute.

The Stage 07 generation pipeline retrieves legal context before credit estimation, includes that context in the billed provider input estimate, binds citation identity/version/provision into the AI request hash and stores verified citations after successful settlement. Missing relevant material produces an explicit “verified source not found” instruction rather than a fabricated legal answer.

### 19.4 Testing, staging and operational evidence

Final local quality gates:

| Check | Result |
| --- | ---: |
| `pnpm format:check` | passed |
| `pnpm lint` | passed |
| `pnpm typecheck` | passed |
| `pnpm db:validate` | passed, 10 ordered migrations |
| `pnpm test:api` | passed: 87 tests |
| `pnpm test:design` | passed: 15 tests |
| `pnpm test:workflow` | passed: 4 tests |
| `pnpm build` | passed: Worker dry run and Design Preview production build |
| `pnpm security:secrets` | passed |
| `pnpm audit --prod --audit-level=high` | passed, no known high/critical vulnerability |

The new suite covers registry counts, verified citation shape, current/effective-date selection, metadata isolation, feature-flag enforcement, authentication/RBAC/TOTP import, exact-domain SSRF protection, FTS/SQL injection input, FTS triggers/reindex, migration tracking, foreign keys, unique current versions, semantic fail-closed state and all previous backend/design/deployment regressions.

Staging migrations `0009` and `0010` are recorded on `yuristim-db-v3-staging`. Remote verification returned 2 sources, 4 documents, 4 verified versions, 6 provisions, 6 FTS rows, a real FTS match for Constitution 2-modda and zero foreign-key violations. The existing `yuristim-api-v3-staging` Worker deployment `2a1a06d8c36e416a8c9a21d39273e138` (Worker version `2a1a06d8-c36e-416a-8c9a-21d39273e138`) serves commit `b8ef9e9a890fb298d5d7cc5862650ca395242edc` at <https://yuristim-api-v3-staging.diyorbeknematov28042007.workers.dev>. The schedule contains weekly credits, hourly maintenance/update checks, daily CBU sync and daily legal sync boundaries.

Real staging checks returned `/health` 200, D1-backed `/ready` 200, `/api/v1/status` 200 with `legal_knowledge_base`, `/api/v1/version` 200 with application `0.8.0` and the exact commit, `/api/v1/services` 200 with Legal Knowledge available, OpenAPI 200 with five legal paths, protected legal status/search 401 without a session, unknown route 404, unsupported method 405 and rejected untrusted CORS 403. Authenticated legal search was verified through workerd integration tests and direct staging D1 FTS because no real Telegram-authenticated staging session is available. No other Worker or D1 database was written.

### 19.5 Blockers and Stage 09 readiness

1. The full Constitution and the remaining codes, laws, presidential/cabinet acts and Plenum texts are not imported. A source-owner-approved API/feed/bulk-access method, parser fixtures, integrity sampling and operational rate policy are required before automatic population.
2. Hourly change checks and daily synchronization are wired to bounded scheduled adapters but remote fetch is deliberately skipped while source `auto_sync_enabled=0`. This is not presented as completed continuous synchronization.
3. Vectorize and an approved embedding provider are absent; semantic retrieval/reranking remains blocked. Lexical D1 FTS5, metadata filters and authority/effective-date ranking continue without it.
4. R2 is unavailable for immutable raw snapshots and large source artifacts. Current verified text/hash/version rows fit D1, but this is not a substitute for the approved long-term evidence archive.
5. Gemini connectivity, OpenAI credentials and provider pricing remain the accepted Stage 07 blockers. Legal retrieval works independently, while real Lite/Pro generation remains fail-closed under the existing prerequisites.

Stage 09 Yurist topish can consume the shared official-source/citation contracts without changing Authentication, Financial Core or AI provider boundaries. This branch must remain unmerged until Owner review, and Stage 09 must not start before that approval.
