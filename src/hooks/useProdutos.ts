import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { notifyUser } from '@/hooks/useNotifications';

export type ProdutoCollectionGroup = 'novas_ideias' | 'em_desenvolvimento' | 'em_validacao' | 'aprovado' | 'arquivado';
export type ProdutoStageStatus = 'nao_iniciado' | 'em_andamento' | 'bloqueado' | 'finalizado';
export type ProdutoDesignStatus = 'pendente' | 'em_desenvolvimento' | 'aprovado' | 'cancelado';

export type ProdutoStageKey =
  | 'definicao_produto'
  | 'prospeccao_fornecedores'
  | 'validacao_pre_custo'
  | 'design_estampa'
  | 'peca_piloto'
  | 'aprovacao'
  | 'embalagem'
  | 'fornecedor_aprovado'
  | 'ficha_tecnica'
  | 'rapport'
  | 'mostruario_foto'
  | 'producao'
  | 'fotos'
  | 'entrega_pd'
  | 'apresentacao';

export interface Produto {
  id: string;
  organization_id: string;
  code: string | null;
  name: string;
  collection_group: ProdutoCollectionGroup;
  responsible: string | null;
  launch_target: string | null;
  cronograma_start: string | null;
  cronograma_end: string | null;
  observations: string | null;
  progress: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ProdutoStage {
  id: string;
  produto_id: string;
  stage_key: ProdutoStageKey;
  status: ProdutoStageStatus;
  assignee_id: string | null;
  completed_at: string | null;
  notes: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface ProdutoDesignItem {
  id: string;
  produto_id: string;
  name: string;
  qt_variacoes: number | null;
  status: ProdutoDesignStatus;
  target_date: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface ProdutoActivity {
  id: string;
  produto_id: string;
  user_id: string | null;
  action: string;
  from_value: string | null;
  to_value: string | null;
  created_at: string;
}

export const produtoStageOrder: ProdutoStageKey[] = [
  'definicao_produto',
  'prospeccao_fornecedores',
  'validacao_pre_custo',
  'design_estampa',
  'peca_piloto',
  'aprovacao',
  'embalagem',
  'fornecedor_aprovado',
  'ficha_tecnica',
  'rapport',
  'mostruario_foto',
  'producao',
  'fotos',
  'entrega_pd',
  'apresentacao',
];

export const produtoStageLabels: Record<ProdutoStageKey, string> = {
  definicao_produto: 'Definicao do produto',
  prospeccao_fornecedores: 'Prospeccao fornecedores',
  validacao_pre_custo: 'Validacao pre-custo',
  design_estampa: 'Design / estampa',
  peca_piloto: 'Peca piloto',
  aprovacao: 'Aprovacao',
  embalagem: 'Embalagem',
  fornecedor_aprovado: 'Fornecedor aprovado',
  ficha_tecnica: 'Ficha tecnica',
  rapport: 'Rapport',
  mostruario_foto: 'Mostruario/foto',
  producao: 'Producao',
  fotos: 'Fotos',
  entrega_pd: 'Entrega PD',
  apresentacao: 'Apresentacao',
};

export interface ProdutoComment {
  id: string;
  produto_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export function useProdutoComments(produtoId: string | null) {
  return useQuery({
    queryKey: ['produto-comments', produtoId],
    queryFn: async () => {
      if (!produtoId) return [];
      const { data, error } = await supabase
        .from('produto_comments' as any)
        .select('*')
        .eq('produto_id', produtoId)
        .order('created_at');
      if (error) throw error;
      return (data || []) as unknown as ProdutoComment[];
    },
    enabled: !!produtoId,
  });
}

export function useAddProdutoComment() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ produtoId, content }: { produtoId: string; content: string }) => {
      if (!user) throw new Error('Sem usuario');
      const { error } = await supabase.from('produto_comments' as any).insert({
        produto_id: produtoId,
        user_id: user.id,
        content,
      });
      if (error) throw error;
      try {
        const { data: p } = await supabase.from('produtos' as any)
          .select('name, created_by, responsible').eq('id', produtoId).single();
        if (p) {
          const targets = new Set<string>();
          if ((p as any).created_by !== user.id) targets.add((p as any).created_by);
          if ((p as any).responsible && (p as any).responsible !== user.id) targets.add((p as any).responsible);
          await Promise.all([...targets].map(id => notifyUser({
            userId: id,
            type: 'produto_comment',
            title: `Novo comentario em "${(p as any).name}"`,
            message: content.slice(0, 80),
            link: '/produtos',
          })));
        }
      } catch (e) { console.warn('produto comment notify failed', e); }
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['produto-comments', vars.produtoId] }),
  });
}

export function useProdutos() {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ['produtos', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data, error } = await supabase
        .from('produtos' as any)
        .select('*')
        .eq('organization_id', currentOrg.id)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Produto[];
    },
    enabled: !!currentOrg,
  });
}

export function useProdutoStages(produtoId: string | null) {
  return useQuery({
    queryKey: ['produto-stages', produtoId],
    queryFn: async () => {
      if (!produtoId) return [];
      const { data, error } = await supabase
        .from('produto_stages' as any)
        .select('*')
        .eq('produto_id', produtoId)
        .order('position', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ProdutoStage[];
    },
    enabled: !!produtoId,
  });
}

export function useProdutoDesignItems(produtoId: string | null) {
  return useQuery({
    queryKey: ['produto-design-items', produtoId],
    queryFn: async () => {
      if (!produtoId) return [];
      const { data, error } = await supabase
        .from('produto_design_items' as any)
        .select('*')
        .eq('produto_id', produtoId)
        .order('position', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ProdutoDesignItem[];
    },
    enabled: !!produtoId,
  });
}

export function useProdutoActivity(produtoId: string | null) {
  return useQuery({
    queryKey: ['produto-activity', produtoId],
    queryFn: async () => {
      if (!produtoId) return [];
      const { data, error } = await supabase
        .from('produto_activity' as any)
        .select('*')
        .eq('produto_id', produtoId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ProdutoActivity[];
    },
    enabled: !!produtoId,
  });
}

export function useCreateProduto() {
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      collection_group?: ProdutoCollectionGroup;
      responsible?: string;
      launch_target?: string;
      cronograma_start?: string;
      cronograma_end?: string;
      observations?: string;
    }) => {
      if (!currentOrg || !user) throw new Error('Sem organizacao');
      const { data, error } = await supabase.from('produtos' as any).insert({
        organization_id: currentOrg.id,
        created_by: user.id,
        name: input.name,
        collection_group: input.collection_group || 'novas_ideias',
        responsible: input.responsible || null,
        launch_target: input.launch_target || null,
        cronograma_start: input.cronograma_start || null,
        cronograma_end: input.cronograma_end || null,
        observations: input.observations || null,
      }).select().single();
      if (error) throw error;

      try {
        if (input.responsible && input.responsible !== user.id) {
          await notifyUser({
            userId: input.responsible,
            type: 'produto_assigned',
            title: `Novo produto atribuido: ${input.name}`,
            link: '/produtos',
          });
        }
      } catch (e) { console.warn('produto notify failed', e); }

      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['produtos'] }),
  });
}

export function useUpdateProduto() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Produto> & { id: string }) => {
      const { data: before } = await supabase.from('produtos' as any)
        .select('name, responsible')
        .eq('id', id)
        .single();
      const { error } = await supabase.from('produtos' as any).update(patch).eq('id', id);
      if (error) throw error;

      try {
        if (patch.responsible && before && patch.responsible !== (before as any).responsible && patch.responsible !== user?.id) {
          await notifyUser({
            userId: patch.responsible,
            type: 'produto_assigned',
            title: `Produto atribuido a voce: ${(before as any).name}`,
            link: '/produtos',
          });
        }
      } catch (e) { console.warn('produto update notify failed', e); }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['produtos'] });
      qc.invalidateQueries({ queryKey: ['produto-activity', vars.id] });
    },
  });
}

export function useDeleteProduto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('produtos' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['produtos'] }),
  });
}

export function useUpdateProdutoStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, produto_id, ...patch }: Partial<ProdutoStage> & { id: string; produto_id: string }) => {
      const nextPatch = { ...patch };
      if (patch.status === 'finalizado' && !patch.completed_at) {
        nextPatch.completed_at = new Date().toISOString().slice(0, 10);
      }
      if (patch.status && patch.status !== 'finalizado') {
        nextPatch.completed_at = null;
      }
      const { error } = await supabase.from('produto_stages' as any).update(nextPatch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['produto-stages', vars.produto_id] });
      qc.invalidateQueries({ queryKey: ['produtos'] });
      qc.invalidateQueries({ queryKey: ['produto-activity', vars.produto_id] });
    },
  });
}

export function useCreateProdutoDesignItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      produto_id: string;
      name: string;
      qt_variacoes?: number;
      target_date?: string;
      position?: number;
    }) => {
      const { data, error } = await supabase.from('produto_design_items' as any).insert({
        produto_id: input.produto_id,
        name: input.name,
        qt_variacoes: input.qt_variacoes || 1,
        status: 'pendente',
        target_date: input.target_date || null,
        position: input.position ?? 0,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['produto-design-items', vars.produto_id] }),
  });
}

export function useUpdateProdutoDesignItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, produto_id, ...patch }: Partial<ProdutoDesignItem> & { id: string; produto_id: string }) => {
      const { error } = await supabase.from('produto_design_items' as any).update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['produto-design-items', vars.produto_id] }),
  });
}

export function useDeleteProdutoDesignItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, produto_id }: { id: string; produto_id: string }) => {
      const { error } = await supabase.from('produto_design_items' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['produto-design-items', vars.produto_id] }),
  });
}
