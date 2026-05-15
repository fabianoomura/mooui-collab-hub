import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Users, Loader2, Shield, User, Wrench } from 'lucide-react';
import { toast } from 'sonner';

export default function TeamPage() {
  const { currentOrg, isAdmin } = useOrganization();
  const qc = useQueryClient();

  const { data: members, isLoading } = useQuery({
    queryKey: ['org-members', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data: orgMembers, error } = await supabase
        .from('organization_members')
        .select('user_id, role')
        .eq('organization_id', currentOrg.id);
      if (error) throw error;

      const userIds = (orgMembers || []).map(m => m.user_id);
      if (userIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, department')
        .in('id', userIds);

      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));
      const itSet = new Set((roles || []).filter(r => r.role === 'it_support').map(r => r.user_id));

      return (orgMembers || []).map(m => ({
        ...m,
        profile: profileMap.get(m.user_id) || null,
        isIT: itSet.has(m.user_id),
      }));
    },
    enabled: !!currentOrg,
  });

  const toggleIT = useMutation({
    mutationFn: async ({ userId, enable }: { userId: string; enable: boolean }) => {
      if (enable) {
        const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: 'it_support' });
        if (error && !error.message.includes('duplicate')) throw error;
      } else {
        const { error } = await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'it_support');
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-members'] });
      qc.invalidateQueries({ queryKey: ['is-it-support'] });
      qc.invalidateQueries({ queryKey: ['it-support-members'] });
      toast.success('Atualizado');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro'),
  });

  const roleLabels: Record<string, string> = {
    admin: 'Administrador',
    member: 'Membro',
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Equipe</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Membros de {currentOrg?.name || 'organização'}
          </p>
        </div>
        {isAdmin && (
          <Badge variant="secondary" className="gap-1">
            <Shield className="h-3 w-3" />
            Administrador
          </Badge>
        )}
      </div>

      {!members?.length ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <Users className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">Nenhum membro encontrado</h3>
          <p className="text-muted-foreground text-sm">
            {currentOrg ? 'Adicione membros à organização' : 'Selecione uma organização'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map((member) => {
            const name = member.profile?.full_name || 'Sem nome';
            const initials = name
              .split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
            const RoleIcon = member.role === 'admin' ? Shield : User;
            return (
              <Card key={member.user_id}>
                <CardContent className="flex flex-col gap-3 p-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{name}</p>
                      <p className="text-xs text-muted-foreground">{member.profile?.department || 'Sem departamento'}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs capitalize gap-1">
                      <RoleIcon className="h-3 w-3" />
                      {roleLabels[member.role] || member.role}
                    </Badge>
                  </div>

                  {member.isIT && !isAdmin && (
                    <Badge variant="outline" className="text-[10px] gap-1 self-start">
                      <Wrench className="h-3 w-3" />
                      Suporte TI
                    </Badge>
                  )}

                  {isAdmin && (
                    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs">Suporte de TI</span>
                      </div>
                      <Switch
                        checked={member.isIT}
                        onCheckedChange={(v) => toggleIT.mutate({ userId: member.user_id, enable: v })}
                        disabled={toggleIT.isPending}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
