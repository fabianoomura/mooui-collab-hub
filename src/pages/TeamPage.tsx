import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Users, Loader2, Shield, User } from 'lucide-react';

export default function TeamPage() {
  const { currentOrg, isAdmin } = useOrganization();

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

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      return (orgMembers || []).map(m => ({
        ...m,
        profile: profileMap.get(m.user_id) || null,
      }));
    },
    enabled: !!currentOrg,
  });

  const roleLabels: Record<string, string> = {
    admin: 'Administrador',
    member: 'Membro',
  };

  const roleIcons: Record<string, typeof Shield> = {
    admin: Shield,
    member: User,
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
            const RoleIcon = roleIcons[member.role] || User;
            return (
              <Card key={member.user_id}>
                <CardContent className="flex items-center gap-4 p-4">
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
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
