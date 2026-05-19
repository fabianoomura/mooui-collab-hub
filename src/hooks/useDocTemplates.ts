import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DocTemplate {
  id: string;
  organization_id: string | null;
  name: string;
  icon: string | null;
  description: string | null;
  content: string;
  is_global: boolean;
  created_at: string;
}

export function useDocTemplates(orgId?: string) {
  return useQuery({
    queryKey: ['doc-templates', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('doc_templates')
        .select('*')
        .or(`is_global.eq.true${orgId ? `,organization_id.eq.${orgId}` : ''}`)
        .order('is_global', { ascending: false })
        .order('name');
      if (error) throw error;
      return (data || []) as DocTemplate[];
    },
  });
}
