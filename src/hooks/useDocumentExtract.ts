import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { SuggestedDeadline } from '@/types/database';

const getFunctionsUrl = () => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (!url) throw new Error('缺少 VITE_SUPABASE_URL');
  return `${url.replace(/\/$/, '')}/functions/v1/extract-deadlines`;
};

/** 呼叫 Edge Function 從文字擷取建議截止日（用 fetch 以讀取非 2xx 時的錯誤內容） */
export function useExtractDeadlinesFromText() {
  return useMutation({
    mutationFn: async (text: string): Promise<SuggestedDeadline[]> => {
      const fnUrl = getFunctionsUrl();
      const { data: session } = await supabase.auth.getSession();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
      };
      if (session?.session?.access_token)
        headers.Authorization = `Bearer ${session.session.access_token}`;

      const res = await fetch(fnUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ text: text.trim() }),
      });
      const body = await res.json().catch(() => ({})) as { suggestions?: SuggestedDeadline[]; error?: string; detail?: string };
      if (!res.ok) {
        const rawMsg = (body?.error ?? body?.detail ?? res.statusText) || '擷取失敗';
        const detail = body?.detail ? `（${String(body.detail).slice(0, 200)}）` : '';
        if (res.status === 429) {
          throw new Error('Azure OpenAI 配額或速率已達上限。請至 Azure 入口檢查用量與計費，或稍後再試。' + detail);
        }
        throw new Error(`${rawMsg}${detail}`);
      }
      if (body?.error) throw new Error(typeof body.error === 'string' ? body.error : '擷取失敗');
      return body?.suggestions ?? [];
    },
  });
}

/** 將建議截止日寫入：先建 document_extract，再批次新增 deadlines */
export function useConfirmSuggestedDeadlines() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      project_id: string;
      file_name?: string | null;
      suggestions: SuggestedDeadline[];
      created_by: string;
    }) => {
      const { project_id, file_name, suggestions, created_by } = input;
      if (suggestions.length === 0) return { project_id, count: 0 };

      const { data: extractRow, error: extractError } = await supabase
        .from('document_extracts')
        .insert({
          project_id,
          file_name: file_name ?? null,
          extract_result: suggestions,
          created_by,
        })
        .select('id')
        .single();

      if (extractError) throw extractError;
      if (!extractRow?.id) throw new Error('建立擷取紀錄失敗');

      const rows = suggestions.map((s) => ({
        project_id,
        title: s.title,
        due_date: s.due_date,
        description: s.description ?? null,
        source: 'document_extract' as const,
        document_extract_id: extractRow.id,
        assignee_id: null,
      }));

      const { error: deadlinesError } = await supabase.from('deadlines').insert(rows);
      if (deadlinesError) throw deadlinesError;

      return { project_id, count: rows.length };
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['deadlines', v.project_id] });
    },
  });
}
