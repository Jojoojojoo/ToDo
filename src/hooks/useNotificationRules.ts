import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { NotificationRule } from '@/types/database';

const DEFAULT_DAYS = 3;

/** 取得專案通知規則（無則回傳預設值，不寫入 DB） */
export function useNotificationRule(projectId: string | undefined) {
  return useQuery({
    queryKey: ['notificationRule', projectId],
    queryFn: async (): Promise<NotificationRule | null> => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from('notification_rules')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle();
      if (error) throw error;
      return data as NotificationRule | null;
    },
    enabled: !!projectId,
  });
}

/** 預設規則（供 UI 顯示未儲存時的預設） */
export function getDefaultRule(): Pick<NotificationRule, 'days_before' | 'notify_line' | 'notify_email'> {
  return { days_before: DEFAULT_DAYS, notify_line: true, notify_email: true };
}

/** 新增或更新專案通知規則 */
export function useUpsertNotificationRule(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      days_before: number;
      notify_line: boolean;
      notify_email: boolean;
    }) => {
      if (!projectId) throw new Error('缺少專案 ID');
      const { data, error } = await supabase
        .from('notification_rules')
        .upsert(
          {
            project_id: projectId,
            days_before: Math.max(0, Math.min(365, input.days_before)),
            notify_line: input.notify_line,
            notify_email: input.notify_email,
          },
          { onConflict: 'project_id' }
        )
        .select()
        .single();
      if (error) throw error;
      return data as NotificationRule;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notificationRule', projectId] });
    },
  });
}
