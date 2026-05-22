-- Trip expiry scheduled push notifications via pg_cron + pg_net
-- Runs daily at 08:00 UTC

-- Schedule: trip ends today
SELECT cron.schedule(
  'trip-ends-today',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://mavlkmwwpcogtwbxtmpr.supabase.co/functions/v1/send-push-notification',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hdmxrbXd3cGNvZ3R3Ynh0bXByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNzM0MDksImV4cCI6MjA5NDg0OTQwOX0.jIxFYubuTSV5HN8nW7TXNKu9FyCeud-p4ZzdpvHcB2c"}'::jsonb,
    body    := '{"eventType": "trip_ends_today", "scheduled": true}'::jsonb
  );
  $$
);

-- Schedule: trip expiry warning (3 days out)
SELECT cron.schedule(
  'trip-expiry-warning',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://mavlkmwwpcogtwbxtmpr.supabase.co/functions/v1/send-push-notification',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hdmxrbXd3cGNvZ3R3Ynh0bXByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNzM0MDksImV4cCI6MjA5NDg0OTQwOX0.jIxFYubuTSV5HN8nW7TXNKu9FyCeud-p4ZzdpvHcB2c"}'::jsonb,
    body    := '{"eventType": "trip_expiry_warning", "scheduled": true}'::jsonb
  );
  $$
);
