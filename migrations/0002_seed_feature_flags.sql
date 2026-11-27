INSERT INTO feature_flags (key, enabled, description) VALUES
  ('ai_provider_execution', 0, 'Allow external AI provider execution'),
  ('research_execution', 0, 'Allow research jobs to execute'),
  ('real_payments', 0, 'Allow real payment provider execution'),
  ('credit_purchases', 0, 'Allow credit purchases'),
  ('pro_subscription_purchases', 0, 'Allow Pro subscription purchases'),
  ('public_lawyer_registration', 0, 'Allow public lawyer registration'),
  ('document_uploads', 0, 'Allow document uploads'),
  ('production_telegram_webhook', 0, 'Allow the production Telegram webhook');

INSERT INTO system_settings (key, value_json, is_public) VALUES
  ('platform_status', '"foundation"', 1),
  ('supported_locales', '["uz","ru","en"]', 1),
  ('default_locale', '"uz"', 1),
  ('timezone', '"Asia/Tashkent"', 1);
