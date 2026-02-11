// Phase 2 + Phase 4: 排程檢查 N 天內到期之截止日，依專案通知規則發送 LINE/Email
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LINE_NOTIFY_URL = "https://notify-api.line.me/api/notify";
const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";
const RESEND_API_URL = "https://api.resend.com/emails";
const MAX_DAYS_QUERY = 31;

interface DeadlineRow {
  id: string;
  project_id: string;
  title: string;
  due_date: string;
  description: string | null;
  assignee_id: string;
  project_name: string;
  assignee_email: string | null;
  assignee_line_token: string | null;
  assignee_line_user_id: string | null;
  assignee_display_name: string | null;
}

/** Phase 4: 專案通知規則（無則用預設） */
interface NotificationRuleRow {
  project_id: string;
  days_before: number;
  notify_line: boolean;
  notify_email: boolean;
}

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  DAYS_BEFORE?: string;
  RESEND_API_KEY?: string;
  NOTIFY_FROM_EMAIL?: string;
  CRON_SECRET?: string;
  LINE_CHANNEL_ACCESS_TOKEN?: string;
}

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const env = Deno.env.toObject() as unknown as Env;
    const cronSecret = env.CRON_SECRET;
    if (cronSecret) {
      const auth = req.headers.get("authorization");
      const body = await req.text().catch(() => "{}");
      const parsed = body ? (() => { try { return JSON.parse(body); } catch { return {}; } })() : {};
      // 優先用 body.secret 做 CRON 驗證，這樣可同時帶 Authorization (anon) 與 body.secret
      const provided = (parsed as { secret?: string })?.secret ?? auth?.replace(/^Bearer\s+/i, "");
      if (provided !== cronSecret) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }
    const supabaseUrl = env.SUPABASE_URL;
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const defaultDaysBefore = Math.max(0, parseInt(env.DAYS_BEFORE ?? "3", 10));
    const resendApiKey = env.RESEND_API_KEY ?? "";
    const fromEmail = env.NOTIFY_FROM_EMAIL ?? "notify@resend.dev";
    const lineChannelToken = env.LINE_CHANNEL_ACCESS_TOKEN ?? "";

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const today = new Date().toISOString().slice(0, 10);
    const endQuery = new Date();
    endQuery.setDate(endQuery.getDate() + MAX_DAYS_QUERY);
    const endQueryStr = endQuery.toISOString().slice(0, 10);

    // 查詢近期到期且有待辦負責人的截止日（寬範圍，再依專案規則篩選）
    const { data: deadlines, error: deadlinesError } = await supabase
      .from("deadlines")
      .select(
        "id, project_id, title, due_date, description, assignee_id, projects(name)"
      )
      .not("assignee_id", "is", null)
      .gte("due_date", today)
      .lte("due_date", endQueryStr);

    if (deadlinesError) {
      return new Response(
        JSON.stringify({ error: "deadlines query failed", detail: deadlinesError.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!deadlines?.length) {
      return new Response(
        JSON.stringify({ ok: true, message: "No deadlines to notify", sent: 0, sent_line: 0, sent_email: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Phase 4: 依專案規則篩選到期日範圍
    const projectIds = [...new Set(deadlines.map((d: { project_id: string }) => d.project_id))];
    const { data: rulesData } = await supabase
      .from("notification_rules")
      .select("project_id, days_before, notify_line, notify_email")
      .in("project_id", projectIds);
    const ruleMap = new Map<string, NotificationRuleRow>();
    for (const r of rulesData ?? []) {
      ruleMap.set((r as NotificationRuleRow).project_id, r as NotificationRuleRow);
    }
    function getRule(projectId: string): NotificationRuleRow {
      return ruleMap.get(projectId) ?? {
        project_id: projectId,
        days_before: defaultDaysBefore,
        notify_line: true,
        notify_email: true,
      };
    }
    const todayDate = new Date(today);
    const filteredDeadlines = deadlines.filter((d: { project_id: string; due_date: string }) => {
      const rule = getRule(d.project_id);
      const cutoff = new Date(todayDate);
      cutoff.setDate(cutoff.getDate() + rule.days_before);
      const due = new Date(d.due_date);
      return due <= cutoff;
    });
    if (!filteredDeadlines.length) {
      return new Response(
        JSON.stringify({ ok: true, message: "No deadlines in range (per project rules)", sent: 0, sent_line: 0, sent_email: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const deadlineIds = filteredDeadlines.map((d: { id: string }) => d.id);
    const assigneeIds = [...new Set(filteredDeadlines.map((d: { assignee_id: string }) => d.assignee_id))];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, line_notify_token, line_user_id, display_name")
      .in("id", assigneeIds);

    const profileMap = new Map(
      (profiles ?? []).map((p: { id: string; email: string | null; line_notify_token: string | null; line_user_id: string | null; display_name: string | null }) => [
        p.id,
        { email: p.email ?? null, line_notify_token: p.line_notify_token ?? null, line_user_id: p.line_user_id ?? null, display_name: p.display_name ?? null },
      ])
    );

    const { data: todayLogs } = await supabase
      .from("notification_logs")
      .select("deadline_id, channel")
      .in("deadline_id", deadlineIds)
      .gte("sent_at", today + "T00:00:00Z")
      .lt("sent_at", today + "T23:59:59.999Z");

    const sentToday = new Set<string>();
    for (const log of todayLogs ?? []) {
      sentToday.add(`${(log as { deadline_id: string }).deadline_id}:${(log as { channel: string }).channel}`);
    }

    const rows: DeadlineRow[] = filteredDeadlines.map((d: { id: string; project_id: string; title: string; due_date: string; description: string | null; assignee_id: string; projects: { name: string } | null }) => {
      const proj = d.projects;
      const profile = profileMap.get(d.assignee_id);
      return {
        id: d.id,
        project_id: d.project_id,
        title: d.title,
        due_date: d.due_date,
        description: d.description,
        assignee_id: d.assignee_id,
        project_name: proj?.name ?? "",
        assignee_email: profile?.email ?? null,
        assignee_line_token: profile?.line_notify_token ?? null,
        assignee_line_user_id: profile?.line_user_id ?? null,
        assignee_display_name: profile?.display_name ?? null,
      };
    });

    let sentCount = 0;
    let sentLine = 0;
    let sentEmail = 0;
    const emailErrors: { to: string; status: number; detail?: string }[] = [];

    for (const row of rows) {
      const rule = getRule(row.project_id);
      const lineKey = `${row.id}:line`;
      const emailKey = `${row.id}:email`;

      const message = `【截止日提醒】專案「${row.project_name}」\n標題：${row.title}\n截止日：${row.due_date}${row.description ? "\n說明：" + row.description : ""}`;

      // 僅在規則允許時發送 LINE
      // 優先：LINE Messaging API（需 LINE_CHANNEL_ACCESS_TOKEN + profile.line_user_id）
      if (rule.notify_line && lineChannelToken && row.assignee_line_user_id && !sentToday.has(lineKey)) {
        const lineRes = await fetch(LINE_PUSH_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lineChannelToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: row.assignee_line_user_id,
            messages: [{ type: "text", text: message }],
          }),
        });
        if (lineRes.ok) {
          await supabase.from("notification_logs").insert({
            deadline_id: row.id,
            recipient: row.assignee_line_user_id,
            channel: "line",
          });
          sentToday.add(lineKey);
          sentCount++;
          sentLine++;
        }
      }
      // 備援：LINE Notify（profile.line_notify_token）
      else if (rule.notify_line && row.assignee_line_token && !sentToday.has(lineKey)) {
        const lineRes = await fetch(LINE_NOTIFY_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${row.assignee_line_token}`, "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ message }),
        });
        if (lineRes.ok) {
          await supabase.from("notification_logs").insert({
            deadline_id: row.id,
            recipient: row.assignee_email ?? "line-user",
            channel: "line",
          });
          sentToday.add(lineKey);
          sentCount++;
          sentLine++;
        }
      }

      if (rule.notify_email && row.assignee_email && resendApiKey && !sentToday.has(emailKey)) {
        const emailRes = await fetch(RESEND_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [row.assignee_email],
            subject: `[截止日提醒] ${row.project_name} - ${row.title} (${row.due_date})`,
            html: `<p>${message.replace(/\n/g, "<br/>")}</p>`,
          }),
        });
        if (emailRes.ok) {
          await supabase.from("notification_logs").insert({
            deadline_id: row.id,
            recipient: row.assignee_email,
            channel: "email",
          });
          sentToday.add(emailKey);
          sentCount++;
          sentEmail++;
        } else {
          const errText = await emailRes.text();
          let detail: string | undefined;
          try {
            const errJson = JSON.parse(errText);
            detail = errJson.message ?? errJson.error ?? errText.slice(0, 200);
          } catch {
            detail = errText.slice(0, 200);
          }
          emailErrors.push({ to: row.assignee_email, status: emailRes.status, detail });
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        sent: sentCount,
        sent_line: sentLine,
        sent_email: sentEmail,
        deadlines_checked: rows.length,
        ...(emailErrors.length > 0 && { email_errors: emailErrors }),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
