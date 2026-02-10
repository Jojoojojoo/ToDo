// LINE Messaging API Webhook：接收「加好友／傳訊息」等事件，取得使用者 userId 供填入 profiles.line_user_id
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const LINE_CHANNEL_SECRET = Deno.env.get("LINE_CHANNEL_SECRET") ?? "";

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

  const events = body.events ?? [];
  for (const ev of events) {
    const userId = ev.source?.userId;
    if (userId) {
      // 供從 Supabase Dashboard → Edge Functions → line-webhook → Logs 查看
      console.log(
        JSON.stringify({
          line_user_id: userId,
          event_type: ev.type,
          source_type: ev.source?.type,
          hint: "將此 line_user_id 填入 public.profiles.line_user_id",
        })
      );
    }
  }

  return new Response("OK", { status: 200 });
});
