import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, Loader2, Building2, Wrench } from 'lucide-react';
import { useDepartments, useDepartmentMembers, useOrgMembersFull } from '@/hooks/useOrgSettings';

export default function TeamPage() {
  const { currentOrg } = useOrganization();

  const { data: departments = [], isLoading: l1 } = useDepartments(currentOrg?.id);
  const { data: deptMembers = [], isLoading: l2 } = useDepartmentMembers(currentOrg?.id);
  const { data: members = [], isLoading: l3 } = useOrgMembersFull(currentOrg?.id);

  const memberIds = members.map((m) => m.user_id);
  const { data: itSet } = useQuery({
    queryKey: ['it-support-flags', memberIds.sort().join(',')],
    enabled: memberIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles').select('user_id').eq('role', 'it_support').in('user_id', memberIds);
      if (error) throw error;
      return new Set((data ?? []).map((r: any) => r.user_id));
    },
  });

  const memberMap = useMemo(() => new Map(members.map((m) => [m.user_id, m])), [members]);
  const grouped = useMemo(() => {
    return departments.map((d) => {
      const ids = deptMembers.filter((dm) => dm.department_id === d.id).map((dm) => dm.user_id);
      const people = ids
        .map((id) => memberMap.get(id))
        .filter((m): m is NonNullable<typeof m> => !!m);
      return { dept: d, people };
    });
  }, [departments, deptMembers, memberMap]);

  const noDept = useMemo(() => {
    const assignedIds = new Set(deptMembers.map((dm) => dm.user_id));
    return members.filter((m) => !assignedIds.has(m.user_id));
  }, [members, deptMembers]);

  const isLoading = l1 || l2 || l3;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Equipe</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Setores e membros de {currentOrg?.name || 'organização'}
        </p>
      </div>

      {grouped.length === 0 && noDept.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <Users className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">Nenhum setor ou membro</h3>
          <p className="text-muted-foreground text-sm">
            Adicione setores e usuários em Configurações.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ dept, people }) => (
            <section key={dept.id}>
              <div className="flex items-center gap-2 mb-3">
                <span className="h-3 w-3 rounded-full" style={{ background: dept.color }} />
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold text-foreground">{dept.name}</h2>
                <Badge variant="secondary" className="text-[10px]">{people.length}</Badge>
              </div>
              {people.length === 0 ? (
                <p className="text-xs text-muted-foreground pl-5">Nenhum membro neste setor.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {people.map((p) => (
                    <MemberCard key={p.user_id} m={p} isIT={itSet?.has(p.user_id) ?? false} />
                  ))}
                </div>
              )}
            </section>
          ))}

          {noDept.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold text-foreground">Sem setor</h2>
                <Badge variant="secondary" className="text-[10px]">{noDept.length}</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {noDept.map((p) => (
                  <MemberCard key={p.user_id} m={p} isIT={itSet?.has(p.user_id) ?? false} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function MemberCard({ m, isIT }: { m: { user_id: string; full_name: string | null; avatar_url: string | null; org_role: string }; isIT: boolean }) {
  const name = m.full_name || 'Sem nome';
  const initials = name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-3">
        <Avatar className="h-10 w-10">
          {m.avatar_url && <AvatarImage src={m.avatar_url} alt={name} />}
          <AvatarFallback className="bg-primary/10 text-primary">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-foreground truncate">{name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {m.org_role === 'admin' && <Badge variant="secondary" className="text-[10px]">Admin</Badge>}
            {isIT && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <Wrench className="h-3 w-3" /> Suporte TI
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
