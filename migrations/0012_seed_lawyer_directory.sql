PRAGMA foreign_keys = ON;

INSERT INTO lawyer_specializations (code, name_uz, name_ru, name_en, sort_order) VALUES
('civil', 'Fuqarolik huquqi', 'Гражданское право', 'Civil law', 1),
('criminal', 'Jinoyat huquqi', 'Уголовное право', 'Criminal law', 2),
('family', 'Oila huquqi', 'Семейное право', 'Family law', 3),
('labor', 'Mehnat huquqi', 'Трудовое право', 'Labor law', 4),
('economic', 'Iqtisodiy huquq', 'Экономическое право', 'Economic law', 5),
('administrative', 'Ma’muriy huquq', 'Административное право', 'Administrative law', 6),
('tax', 'Soliq huquqi', 'Налоговое право', 'Tax law', 7),
('land', 'Yer huquqi', 'Земельное право', 'Land law', 8),
('housing', 'Uy-joy huquqi', 'Жилищное право', 'Housing law', 9),
('inheritance', 'Meros huquqi', 'Наследственное право', 'Inheritance law', 10),
('banking_finance', 'Bank-moliya huquqi', 'Банковское и финансовое право', 'Banking and finance law', 11),
('corporate', 'Korporativ huquq', 'Корпоративное право', 'Corporate law', 12),
('intellectual_property', 'Intellektual mulk huquqi', 'Интеллектуальная собственность', 'Intellectual property', 13),
('international', 'Xalqaro huquq', 'Международное право', 'International law', 14),
('migration', 'Migratsiya huquqi', 'Миграционное право', 'Migration law', 15),
('customs', 'Bojxona huquqi', 'Таможенное право', 'Customs law', 16),
('social_security', 'Ijtimoiy ta’minot huquqi', 'Право социального обеспечения', 'Social security law', 17),
('enforcement', 'Ijro ishi', 'Исполнительное производство', 'Enforcement proceedings', 18),
('consumer', 'Iste’molchilar huquqi', 'Защита прав потребителей', 'Consumer protection', 19),
('other', 'Boshqa', 'Другое', 'Other', 20);

INSERT INTO feature_flags (key, enabled, description)
VALUES
  ('lawyer_directory', 1, 'Verified lawyer directory and deterministic recommendation'),
  ('lawyer_recommendations', 1, 'Registry-bound lawyer recommendation')
ON CONFLICT(key) DO UPDATE SET
  enabled = excluded.enabled,
  description = excluded.description,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

UPDATE feature_flags
SET enabled = 1,
    description = 'Public professional registration is available to authenticated active accounts',
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE key = 'public_lawyer_registration';
