import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useDocFavorites() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['doc-favorites', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('doc_favorites')
        .select('page_id')
        .eq('user_id', user!.id);
      if (error) throw error;
      return new Set((data || []).map((d) => d.page_id as string));
    },
  });
}

export function useToggleFavorite() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ pageId, on }: { pageId: string; on: boolean }) => {
      if (!user) throw new Error('Não autenticado');
      if (on) {
        const { error } = await supabase
          .from('doc_favorites')
          .insert({ user_id: user.id, page_id: pageId });
        if (error && !`${error.message}`.includes('duplicate')) throw error;
      } else {
        const { error } = await supabase
          .from('doc_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('page_id', pageId);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doc-favorites'] }),
  });
}
