import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Project } from '@/types/database';

/** 取得單一專案 */
export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!projectId) throw new Error('缺少專案 ID');
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
      if (error) throw error;
      return data as Project;
    },
    enabled: !!projectId,
  });
}
