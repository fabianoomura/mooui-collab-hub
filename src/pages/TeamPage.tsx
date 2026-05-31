import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { useOpenDm } from '@/hooks/useChannels';
import { usePermissions } from '@/hooks/usePermissions';
import { useTeamWorkload } from '@/hooks/useTeamWorkload';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Users, Loader2, Building2, Wrench, MessageSquare, Mail, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { useDepartments, useDepartmentMembers, useOrgMembersFull, type MemberRow } from '@/hooks/useOrgSettings';

export default function TeamPage() {
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  const navigate = useNavigate();
  const openDm = useOpenDm();
  const { canDo } = usePermissions();

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

  const showWorkload = canDo('view_reports');
  const { data: workloadData } = useTeamWorkload(showWorkload ? memberIds : []);

  const handleDm = async (otherUserId: string) => {
    if (!currentOrg) return;
    if (otherUserId === user?.id) {
      toast.error('Não é possível enviar mensagem para si mesmo');
      return;
    }
    try {
      const channelId = await openDm.mutateAsync({ otherUserId, orgId: currentOrg.id });
      navigate(`/mensagens?channel=${channelId}`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao abrir conversa');
    }
  };

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

      <Tabs defaultValue="organograma">
        <TabsList>
          <TabsTrigger value="organograma" className="gap-1.5">
            <Building2 className="h-4 w-4" />
            Organograma
          </TabsTrigger>
          {canDo('view_reports') && (
            <TabsTrigger value="carga" className="gap-1.5">
              <BarChart3 className="h-4 w-4" />
              Carga de Trabalho
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="organograma" className="mt-4">
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
                        <MemberCard
                          key={p.user_id}
                          m={p}
                          isIT={itSet?.has(p.user_id) ?? false}
                          isSelf={p.user_id === user?.id}
                          onDm={() => handleDm(p.user_id)}
                        />
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
                      <MemberCard
                        key={p.user_id}
                        m={p}
                        isIT={itSet?.has(p.user_id) ?? false}
                        isSelf={p.user_id === user?.id}
                        onDm={() => handleDm(p.user_id)}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </TabsContent>

        {canDo('view_reports') && (
          <TabsContent value="carga" className="mt-4">
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-4 w-4 text-primary" />
                <h2 className="font-semibold text-foreground">Carga de Trabalho</h2>
              </div>
              {workloadData && workloadData.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
                        <th className="text-left py-2 px-2">Membro</th>
                        <th className="text-center py-2 px-2">Tarefas</th>
                        <th className="text-center py-2 px-2">Em atraso</th>
                        <th className="text-center py-2 px-2">Etapas</th>
                        <th className="text-center py-2 px-2">Checklist</th>
                        <th className="text-center py-2 px-2 w-40">Carga</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workloadData.map((w) => {
                        const member = memberMap.get(w.userId);
                        const name = member?.full_name || 'Sem nome';
                        const initials = name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
                        const barColor = w.total > 10 ? 'bg-destructive' : w.total >= 5 ? 'bg-amber-500' : 'bg-emerald-500';
                        const barPct = Math.min(w.total * 5, 100); // scale: 20 items = 100%
                        return (
                          <tr key={w.userId} className="border-b border-border last:border-0 hover:bg-muted/30">
                            <td className="py-2 px-2">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-7 w-7">
                                  {member?.avatar_url && <AvatarImage src={member.avatar_url} alt={name} />}
                                  <AvatarFallback className="text-[9px] bg-primary/10 text-primary">{initials}</AvatarFallback>
                                </Avatar>
                                <span className="font-medium text-foreground truncate">{name}</span>
                              </div>
                            </td>
                            <td className="text-center py-2 px-2 font-medium">{w.openTasks}</td>
                            <td className="text-center py-2 px-2">
                              {w.overdueTasks > 0
                                ? <span className="text-destructive font-semibold">{w.overdueTasks}</span>
                                : <span className="text-muted-foreground">0</span>
                              }
                            </td>
                            <td className="text-center py-2 px-2 font-medium">{w.openStages}</td>
                            <td className="text-center py-2 px-2 font-medium">{w.openChecklistItems}</td>
                            <td className="py-2 px-2">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${barPct}%` }} />
                                </div>
                                <span className="text-xs font-semibold text-muted-foreground w-6 text-right">{w.total}</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum dado de carga de trabalho disponível.</p>
              )}
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function MemberCard({
  m, isIT, isSelf, onDm,
}: {
  m: MemberRow;
  isIT: boolean;
  isSelf: boolean;
  onDm: () => void;
}) {
  const name = m.full_name || 'Sem nome';
  const initials = name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-3">
        <Avatar className="h-11 w-11">
          {m.avatar_url && <AvatarImage src={m.avatar_url} alt={name} />}
          <AvatarFallback className="bg-primary/10 text-primary">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-foreground truncate">{name}</p>
          {m.email && (
            <a
              href={`mailto:${m.email}`}
              className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground truncate hover:text-foreground"
              title={m.email}
            >
              <Mail className="h-3 w-3 shrink-0" />
              <span className="truncate">{m.email}</span>
            </a>
          )}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {m.org_role === 'admin' && <Badge variant="secondary" className="text-[10px]">Admin</Badge>}
            {isIT && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <Wrench className="h-3 w-3" /> Suporte TI
              </Badge>
            )}
          </div>
        </div>
        {!isSelf && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2 shrink-0"
            onClick={onDm}
            title="Enviar mensagem direta"
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
