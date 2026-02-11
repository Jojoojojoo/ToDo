// Phase 3: 從文件文字以 Azure OpenAI (GPT-4.1) 擷取專案／里程碑／截止日，回傳建議清單
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

/** AI 回傳的單筆建議 */
export interface SuggestedDeadline {
  title: string;
  due_date: string;
  description?: string | null;
  assignee_name?: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const endpoint = Deno.env.get("AZURE_OPENAI_ENDPOINT")?.replace(/\/$/, "") ?? "";
    const apiKey = Deno.env.get("AZURE_OPENAI_KEY");
    const deployment = Deno.env.get("AZURE_OPENAI_DEPLOYMENT") ?? "gpt-4.1";
    const apiVersion = Deno.env.get("AZURE_OPENAI_API_VERSION") ?? "2025-01-01-preview";

    if (!endpoint || !apiKey) {
      return new Response(
        JSON.stringify({ error: "AZURE_OPENAI_ENDPOINT 或 AZURE_OPENAI_KEY 未設定" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({})) as { text?: string };
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text) {
      return new Response(
        JSON.stringify({ error: "Missing or empty 'text' in body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `你是一個專案截止日擷取助手。請從使用者提供的文件或文字中，找出所有與「專案、里程碑、截止日、繳交期限、到期日」相關的項目。
請「只」回傳一個 JSON 陣列，每個項目必須包含：
- title: string（簡短標題，例如「報告繳交」「合約到期」）
- due_date: string（僅日期，格式一律 YYYY-MM-DD；若原文只有月份或年份，請合理推斷為該月/年之最後一天或第一日）
- description: string 或 null（可選，該項目的補充說明）
- assignee_name: string 或 null（可選，若內文有提到負責人姓名則填入，否則 null）

若完全找不到任何截止日或期限，請回傳空陣列 []。
不要回傳 markdown、程式碼區塊標記或其它前後綴，僅純 JSON 陣列。`;

    const userPrompt = `請從以下文字擷取所有專案／里程碑／截止日，並以 JSON 陣列回傳（每項含 title, due_date, description, assignee_name）：\n\n${text}`;

    const url = `${endpoint}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(
        JSON.stringify({ error: "Azure OpenAI API error", detail: errText.slice(0, 500) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    let rawText = data.choices?.[0]?.message?.content?.trim() ?? "[]";
    // 若被包在 ```json ... ``` 中則取出
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) rawText = jsonMatch[1].trim();
    // 若回傳為 { "items": [...] } 則取 items
    let suggestions: SuggestedDeadline[];
    try {
      const parsed = JSON.parse(rawText) as unknown;
      const arr = Array.isArray(parsed) ? parsed : (parsed as { items?: unknown[] })?.items ?? [];
      suggestions = Array.isArray(arr)
        ? arr.map((item: Record<string, unknown>) => ({
            title: String(item?.title ?? ""),
            due_date: String(item?.due_date ?? ""),
            description: item?.description != null ? String(item.description) : null,
            assignee_name: item?.assignee_name != null ? String(item.assignee_name) : null,
          }))
        : [];
    } catch {
      suggestions = [];
    }

    return new Response(
      JSON.stringify({ suggestions }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
