import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';

export interface ProjectMemberWithProfile {
  project_id: string;
  user_id: string;
  created_at: string;
  profile: Profile | null;
}

/** 取得專案成員（含 profile：先查成員再查 profiles） */
export function useProjectMembers(projectId: string | undefined) {
  return useQuery({
    queryKey: ['projectMembers', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data: members, error: e1 } = await supabase
        .from('project_members')
        .select('project_id, user_id, created_at')
        .eq('project_id', projectId);
      if (e1) throw e1;
      if (!members?.length) return [] as ProjectMemberWithProfile[];
      const userIds = [...new Set(members.map((m) => m.user_id))];
      const { data: profiles, error: e2 } = await supabase
        .from('profiles')
        .select('id, display_name, email, line_user_id')
        .in('id', userIds);
      if (e2) throw e2;
      const profileMap = new Map<string, Profile>();
      (profiles ?? []).forEach((p) => profileMap.set(p.id, p as Profile));
      return members.map((m) => ({
        ...m,
        profile: profileMap.get(m.user_id) ?? null,
      })) as ProjectMemberWithProfile[];
    },
    enabled: !!projectId,
  });
}

/** 新增專案成員（以 email 查詢使用者 id，僅限專案 owner 使用） */
export function useAddProjectMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      userId,
    }: {
      projectId: string;
      userId: string;
    }) => {
      const { error } = await supabase.from('project_members').insert({
        project_id: projectId,
        user_id: userId,
      });
      if (error) throw error;
      return { projectId, userId };
    },
    onSuccess: (v) => {
      qc.invalidateQueries({ queryKey: ['projectMembers', v.projectId] });
    },
  });
}

/** 移除專案成員 */
export function useRemoveProjectMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      userId,
    }: {
      projectId: string;
      userId: string;
    }) => {
      const { error } = await supabase
        .from('project_members')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', userId);
      if (error) throw error;
      return { projectId, userId };
    },
    onSuccess: (v) => {
      qc.invalidateQueries({ queryKey: ['projectMembers', v.projectId] });
    },
  });
}
