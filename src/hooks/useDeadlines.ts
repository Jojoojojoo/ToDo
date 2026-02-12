import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Deadline } from '@/types/database';

/** 取得專案下的截止日列表 */
export function useDeadlines(projectId: string | undefined) {
  return useQuery({
    queryKey: ['deadlines', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('deadlines')
        .select('id, project_id, title, due_date, description, source, document_extract_id, assignee_id, created_at, updated_at')
        .eq('project_id', projectId)
        .order('due_date', { ascending: true });
      if (error) throw error;
      return data as Deadline[];
    },
    enabled: !!projectId,
    staleTime: 10 * 1000, // 10 秒內不重新請求
  });
}

/** 新增截止日（可選 source / document_extract_id，供 Phase 3 從文件擷取寫入） */
export function useCreateDeadline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      project_id: string;
      title: string;
      due_date: string;
      description?: string;
      assignee_id?: string | null;
      source?: 'manual' | 'document_extract';
      document_extract_id?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('deadlines')
        .insert({
          project_id: input.project_id,
          title: input.title,
          due_date: input.due_date,
          description: input.description ?? null,
          source: input.source ?? 'manual',
          document_extract_id: input.document_extract_id ?? null,
          assignee_id: input.assignee_id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Deadline;
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['deadlines', v.project_id] });
    },
  });
}

/** 更新截止日 */
export function useUpdateDeadline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      project_id: string;
      title: string;
      due_date: string;
      description?: string | null;
      assignee_id?: string | null;
    }) => {
      const { id, project_id, ...rest } = input;
      const { data, error } = await supabase
        .from('deadlines')
        .update(rest)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Deadline;
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['deadlines', v.project_id] });
    },
  });
}

/** 刪除截止日 */
export function useDeleteDeadline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, project_id }: { id: string; project_id: string }) => {
      const { error } = await supabase.from('deadlines').delete().eq('id', id);
      if (error) throw error;
      return { project_id };
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['deadlines', v.project_id] });
    },
  });
}
