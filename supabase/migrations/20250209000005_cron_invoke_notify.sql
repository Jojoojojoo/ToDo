-- Phase 2: 每日 08:00 呼叫 Edge Function 檢查截止日並發送通知
-- 前置條件：已啟用 pg_cron、pg_net，且於 Vault 建立 project_url、publishable_key（見 docs/phase2-notifications.md）

-- 若專案尚未啟用 pg_cron / pg_net，請至 Dashboard → Integrations 啟用，或執行：
-- create extension if not exists pg_cron with schema pg_catalog;
-- create extension if not exists pg_net;
-- grant usage on schema cron to postgres;

-- 先移除同名 job（若存在）
do $$
begin
  perform cron.unschedule('check-deadlines-notify-daily');
exception when others then
  null;
end $$;

-- 每日 08:00 (UTC) 觸發；若需台灣時間 08:00 可改為 '0 0 * * *' 並依主機時區調整
select cron.schedule(
  'check-deadlines-notify-daily',
  '0 8 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/check-deadlines-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key')
    ),
    body := coalesce(
      (select jsonb_build_object('secret', decrypted_secret) from vault.decrypted_secrets where name = 'cron_secret' limit 1),
      '{}'::jsonb
    )
  ) as request_id;
  $$
);
