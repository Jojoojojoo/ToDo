import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Deadline } from '@/types/database';

/** 單筆通知紀錄（含關聯截止日與專案名稱） */
export interface NotificationLogWithDeadline {
  id: string;
  deadline_id: string;
  recipient: string;
  channel: 'line' | 'email';
  sent_at: string;
  deadlines: {
    id: string;
    title: string;
    due_date: string;
    project_id: string;
    projects: { name: string } | null;
  } | null;
}

/** 即將到期截止日（含專案名稱） */
export interface UpcomingDeadlineRow extends Pick<Deadline, 'id' | 'project_id' | 'title' | 'due_date' | 'description'> {
  projects: { name: string } | null;
}

/** 查詢近期通知紀錄（依 RLS 僅能見可存取專案） */
export function useNotificationLogs(limit = 50) {
  return useQuery({
    queryKey: ['notificationLogs', limit],
    queryFn: async (): Promise<NotificationLogWithDeadline[]> => {
      const { data, error } = await supabase
        .from('notification_logs')
        .select('id, deadline_id, recipient, channel, sent_at, deadlines(id, title, due_date, project_id, projects(name))')
        .order('sent_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as NotificationLogWithDeadline[];
    },
  });
}

/** 查詢多專案在指定天數內到期的截止日（需傳入可存取的專案 ID 列表） */
export function useUpcomingDeadlines(projectIds: string[], days = 14) {
  const today = new Date().toISOString().slice(0, 10);
  const end = new Date();
  end.setDate(end.getDate() + days);
  const endStr = end.toISOString().slice(0, 10);

  return useQuery({
    queryKey: ['upcomingDeadlines', projectIds, today, endStr],
    queryFn: async (): Promise<UpcomingDeadlineRow[]> => {
      if (projectIds.length === 0) return [];
      const { data, error } = await supabase
        .from('deadlines')
        .select('id, project_id, title, due_date, description, projects(name)')
        .in('project_id', projectIds)
        .gte('due_date', today)
        .lte('due_date', endStr)
        .order('due_date', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as UpcomingDeadlineRow[];
    },
    enabled: projectIds.length > 0,
  });
}
