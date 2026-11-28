PRAGMA foreign_keys = ON;

INSERT INTO legal_sources (
  id, code, name, base_url, official_domain, authority_kind,
  access_mode, terms_url, auto_sync_enabled, status, last_checked_at, last_success_at
) VALUES
  ('source-lex-uz', 'lex_uz', 'Oʻzbekiston Respublikasi Qonunchilik maʼlumotlari milliy bazasi',
   'https://lex.uz', 'lex.uz', 'normative_registry', 'manual_verified',
   'https://lex.uz/agreement', 0, 'active', '2026-11-28T00:00:00.000Z', '2026-11-28T00:00:00.000Z'),
  ('source-sud-uz', 'sud_uz', 'Oʻzbekiston Respublikasi Oliy sudi',
   'https://sud.uz', 'sud.uz', 'judicial_authority', 'manual_verified',
   NULL, 0, 'active', '2026-11-28T00:00:00.000Z', '2026-11-28T00:00:00.000Z');

INSERT INTO legal_documents (
  id, source_id, external_id, title, document_number, document_type,
  legal_authority, language, adopted_at, official_url, status
) VALUES
  ('legal-doc-constitution-uz', 'source-lex-uz', '-6445145',
   'Oʻzbekiston Respublikasi Konstitutsiyasi', NULL, 'constitution',
   'normative', 'uz-Latn', '2023-04-30',
   'https://lex.uz/uz/docs/-6445145?ONDATE=25.07.2026+00', 'active'),
  ('legal-doc-plenum-2020-35', 'source-sud-uz', 'civil-2020-35',
   'Sudlar tomonidan fuqarolik ishlari bo‘yicha dalillar va isbotlashga oid qonun normalarini qo‘llash amaliyoti to‘g‘risida',
   '35-son', 'plenum_resolution', 'judicial_practice', 'uz-Latn', '2020-12-19',
   'https://sud.uz/la/plenum-la/documents-civil-la/', 'active'),
  ('legal-doc-plenum-2024-20', 'source-sud-uz', 'civil-2024-20',
   'Sudlar tomonidan fuqarolik ishlarini taftish tartibida ko‘rishning ayrim masalalari to‘g‘risida',
   '20-son', 'plenum_resolution', 'judicial_practice', 'uz-Latn', '2024-06-25',
   'https://sud.uz/la/plenum-la/documents-civil-la/', 'active'),
  ('legal-doc-plenum-2026-18', 'source-sud-uz', 'civil-2026-18',
   'Sudlar tomonidan fuqaroni muomala layoqati cheklangan yoki muomalaga layoqatsiz deb topish haqidagi ishlarni ko‘rish amaliyoti to‘g‘risida',
   '18-son', 'plenum_resolution', 'judicial_practice', 'uz-Latn', '2026-07-03',
   'https://sud.uz/la/plenum-la/documents-civil-la/', 'active');

INSERT INTO legal_document_versions (
  id, document_id, version_label, legal_status, effective_from, effective_to,
  published_at, verified_at, verification_status, completeness, ingestion_method,
  source_hash, content_hash, source_url
) VALUES
  ('legal-ver-constitution-2026-07-25', 'legal-doc-constitution-uz', '25.07.2026',
   'current', '2026-07-25T00:00:00.000Z', NULL, '2026-07-25T00:00:00.000Z',
   '2026-11-28T00:00:00.000Z', 'verified', 'partial', 'manual_verified',
   '907dc4a94f700a3be2affc3b8d2ec26d5160b5a4eb118b44e845771b46c046e4',
   '839c6d7aedccaeb55af7820b94f67fa2bac5a5ea2496b41592005006229fdeac',
   'https://lex.uz/uz/docs/-6445145?ONDATE=25.07.2026+00'),
  ('legal-ver-plenum-2020-35', 'legal-doc-plenum-2020-35', '19.12.2020',
   'current', '2020-12-19T00:00:00.000Z', NULL, '2020-12-19T00:00:00.000Z',
   '2026-11-28T00:00:00.000Z', 'verified', 'metadata_only', 'manual_verified',
   '1c685b4fab486a4f426c4f80c678de797af19d0aeeeadb78d7ac305ac73aa0d1',
   'a70d659d8acd2025f5f9e01a966919fc0e2432f9cec8acfa4c6f9bbd933f6db0',
   'https://sud.uz/la/plenum-la/documents-civil-la/'),
  ('legal-ver-plenum-2024-20', 'legal-doc-plenum-2024-20', '25.06.2024',
   'current', '2024-06-25T00:00:00.000Z', NULL, '2024-06-25T00:00:00.000Z',
   '2026-11-28T00:00:00.000Z', 'verified', 'metadata_only', 'manual_verified',
   '1c685b4fab486a4f426c4f80c678de797af19d0aeeeadb78d7ac305ac73aa0d1',
   'af27322456e84c8cbfd807b85b9b65bbed5a196d7a969e2b92c6eeaf23f1fe53',
   'https://sud.uz/la/plenum-la/documents-civil-la/'),
  ('legal-ver-plenum-2026-18', 'legal-doc-plenum-2026-18', '03.07.2026',
   'current', '2026-07-03T00:00:00.000Z', NULL, '2026-07-03T00:00:00.000Z',
   '2026-11-28T00:00:00.000Z', 'verified', 'metadata_only', 'manual_verified',
   '1c685b4fab486a4f426c4f80c678de797af19d0aeeeadb78d7ac305ac73aa0d1',
   'd6c2a4deeadb4fe5b2993999ea1ed28fe270b42cdd763490e5c04c7bb2c67f41',
   'https://sud.uz/la/plenum-la/documents-civil-la/');

INSERT INTO legal_provisions (
  id, version_id, provision_kind, provision_number, heading, body, path, ordinal, content_hash
) VALUES
  ('legal-prov-constitution-1', 'legal-ver-constitution-2026-07-25', 'article', '1',
   '1-modda',
   'Oʻzbekiston — boshqaruvning respublika shakliga ega boʻlgan suveren, demokratik, huquqiy, ijtimoiy va dunyoviy davlat.\n\nDavlatning “Oʻzbekiston Respublikasi” va “Oʻzbekiston” degan nomlari bir maʼnoni anglatadi.',
   'section-1/chapter-1/article-1', 1,
   '33265505be2c0aabf3a5a432ff04ba5cdab41c402386aa2f5242ca8bb902e463'),
  ('legal-prov-constitution-2', 'legal-ver-constitution-2026-07-25', 'article', '2',
   '2-modda',
   'Davlat xalq irodasini ifoda etib, uning manfaatlariga xizmat qiladi. Davlat organlari va mansabdor shaxslar jamiyat va fuqarolar oldida masʼuldirlar.',
   'section-1/chapter-1/article-2', 2,
   '20b8e9e641fe1d1b84337a2fff76579657b0c8ccc553dbcb6403cee2cc42dc87'),
  ('legal-prov-constitution-15', 'legal-ver-constitution-2026-07-25', 'article', '15',
   '15-modda',
   'Oʻzbekiston Respublikasida Oʻzbekiston Respublikasi Konstitutsiyasi va qonunlarining ustunligi soʻzsiz tan olinadi.',
   'section-1/chapter-3/article-15', 15,
   '97dd840064348d938937465b8756689f7b95573b70f5dfb1809c6aa6cebfd83b'),
  ('legal-prov-plenum-2020-35-meta', 'legal-ver-plenum-2020-35', 'metadata', '35-son',
   'Rasmiy roʻyxat metamaʼlumoti',
   'Sudlar tomonidan fuqarolik ishlari bo‘yicha dalillar va isbotlashga oid qonun normalarini qo‘llash amaliyoti to‘g‘risida (2020 yil 19 dekabr, 35-son)',
   'metadata', 0,
   'a70d659d8acd2025f5f9e01a966919fc0e2432f9cec8acfa4c6f9bbd933f6db0'),
  ('legal-prov-plenum-2024-20-meta', 'legal-ver-plenum-2024-20', 'metadata', '20-son',
   'Rasmiy roʻyxat metamaʼlumoti',
   'Sudlar tomonidan fuqarolik ishlarini taftish tartibida ko‘rishning ayrim masalalari to‘g‘risida (2024 yil 25 iyun, 20-son)',
   'metadata', 0,
   'af27322456e84c8cbfd807b85b9b65bbed5a196d7a969e2b92c6eeaf23f1fe53'),
  ('legal-prov-plenum-2026-18-meta', 'legal-ver-plenum-2026-18', 'metadata', '18-son',
   'Rasmiy roʻyxat metamaʼlumoti',
   'Sudlar tomonidan fuqaroni muomala layoqati cheklangan yoki muomalaga layoqatsiz deb topish haqidagi ishlarni ko‘rish amaliyoti to‘g‘risida (2026 yil 3 iyul, 18-son)',
   'metadata', 0,
   'd6c2a4deeadb4fe5b2993999ea1ed28fe270b42cdd763490e5c04c7bb2c67f41');

INSERT INTO legal_ingestion_runs (
  id, source_id, mode, status, discovered_count, imported_count,
  quarantined_count, started_at, completed_at
) VALUES
  ('legal-run-seed-lex-20261128', 'source-lex-uz', 'manual', 'completed', 1, 1, 0,
   '2026-11-28T00:00:00.000Z', '2026-11-28T00:00:01.000Z'),
  ('legal-run-seed-sud-20261128', 'source-sud-uz', 'manual', 'completed', 3, 3, 0,
   '2026-11-28T00:00:00.000Z', '2026-11-28T00:00:01.000Z');

INSERT INTO legal_change_events (
  id, document_id, from_version_id, to_version_id, change_type,
  diff_summary, detected_at, verified_at
) VALUES
  ('legal-change-constitution-seed', 'legal-doc-constitution-uz', NULL,
   'legal-ver-constitution-2026-07-25', 'created',
   'Rasmiy manbadan uchta modda bilan qisman, tekshirilgan import.',
   '2026-11-28T00:00:00.000Z', '2026-11-28T00:00:00.000Z');
