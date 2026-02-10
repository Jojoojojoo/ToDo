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
        .select('*')
        .eq('project_id', projectId)
        .order('due_date', { ascending: true });
      if (error) throw error;
      return data as Deadline[];
    },
    enabled: !!projectId,
  });
}

/** 新增截止日 */
export function useCreateDeadline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      project_id: string;
      title: string;
      due_date: string;
      description?: string;
      assignee_id?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('deadlines')
        .insert({
          project_id: input.project_id,
          title: input.title,
          due_date: input.due_date,
          description: input.description ?? null,
          source: 'manual',
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
