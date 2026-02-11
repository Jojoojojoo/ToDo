// LINE Messaging API Webhook：接收加好友／傳訊息，綁定時依驗證碼寫入 profiles.line_user_id 並回覆
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LINE_CHANNEL_SECRET = Deno.env.get("LINE_CHANNEL_SECRET") ?? "";
const LINE_CHANNEL_ACCESS_TOKEN = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") ?? "";
const LINE_REPLY_URL = "https://api.line.me/v2/bot/message/reply";

interface LineWebhookEvent {
  type: string;
  replyToken?: string;
  source?: { type: string; userId?: string; groupId?: string };
  message?: { type: string; text?: string };
}

interface LineWebhookBody {
  destination?: string;
  events?: LineWebhookEvent[];
}

/** 驗證 LINE 的 X-Line-Signature（HMAC-SHA256 + base64） */
async function verifySignature(body: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature || !secret) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body)
  );
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return expected === signature;
}

/** 回覆 LINE 訊息（若有 replyToken 且設定了 ACCESS_TOKEN） */
async function replyLine(replyToken: string, text: string): Promise<void> {
  if (!LINE_CHANNEL_ACCESS_TOKEN) return;
  await fetch(LINE_REPLY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("OK", { status: 200 });
  }
  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature");

  if (!LINE_CHANNEL_SECRET) {
    console.error("LINE_CHANNEL_SECRET 未設定，請在 Edge Function 設定 Secrets");
    return new Response("OK", { status: 200 });
  }

  const valid = await verifySignature(rawBody, signature, LINE_CHANNEL_SECRET);
  if (!valid) {
    console.error("LINE Webhook 簽章驗證失敗");
    return new Response("Forbidden", { status: 403 });
  }

  let body: LineWebhookBody;
  try {
    body = JSON.parse(rawBody) as LineWebhookBody;
  } catch {
    return new Response("OK", { status: 200 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

  const events = body.events ?? [];
  for (const ev of events) {
    const lineUserId = ev.source?.userId;
    if (lineUserId) {
      // 訊息事件：驗證碼綁定流程
      if (ev.type === "message" && ev.message?.type === "text" && typeof ev.message.text === "string") {
        const code = ev.message.text.trim();
        if (supabase && code) {
          const { data: row } = await supabase
            .from("line_binding_requests")
            .select("id, user_id")
            .eq("code", code)
            .gt("expires_at", new Date().toISOString())
            .is("line_user_id", null)
            .limit(1)
            .maybeSingle();

          if (row && (row as { id: string; user_id: string }).user_id) {
            const r = row as { id: string; user_id: string };
            await supabase.from("profiles").update({ line_user_id: lineUserId, updated_at: new Date().toISOString() }).eq("id", r.user_id);
            await supabase.from("line_binding_requests").update({ line_user_id: lineUserId }).eq("id", r.id);
            if (ev.replyToken) await replyLine(ev.replyToken, "綁定成功！您將可收到截止日提醒。");
          } else if (ev.replyToken) {
            await replyLine(ev.replyToken, "驗證碼錯誤或已過期，請重新取得驗證碼再試。");
          }
        } else {
          // 無 DB 或非綁定流程：僅記錄供手動對照
          console.log(
            JSON.stringify({
              line_user_id: lineUserId,
              event_type: ev.type,
              source_type: ev.source?.type,
              hint: "將此 line_user_id 填入 public.profiles.line_user_id",
            })
          );
        }
      } else {
        console.log(
          JSON.stringify({
            line_user_id: lineUserId,
            event_type: ev.type,
            source_type: ev.source?.type,
            hint: "將此 line_user_id 填入 public.profiles.line_user_id",
          })
        );
      }
    }
  }

  return new Response("OK", { status: 200 });
});
