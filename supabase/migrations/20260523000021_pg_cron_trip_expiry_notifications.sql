-- Schedule daily push notifications for trip expiry events.
-- Both jobs call the send-push-notification Edge Function with a scheduled payload.
-- The function handles preference checks and mute status internally.

SELECT cron.schedule(
  'trip-ends-today',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_service_role_key')
    ),
    body := '{"eventType":"trip_ends_today","groupId":null,"actorMemberId":"","scheduled":true}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'trip-expiry-warning',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_service_role_key')
    ),
    body := '{"eventType":"trip_expiry_warning","groupId":null,"actorMemberId":"","scheduled":true}'::jsonb
  );
  $$
);
