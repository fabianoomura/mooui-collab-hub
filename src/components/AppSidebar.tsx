import {
  LayoutDashboard, Users, LogOut, Table2, ChevronDown, Search, Check, Plus, Trash2,
  MessageSquare, BookOpen, Settings, Calendar, CalendarDays, Rocket, Briefcase,
  ClipboardCheck, ChevronsUpDown, User as UserIcon,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useProjectsByOrg, useCreateProject, useDeleteProject } from '@/hooks/useProjectData';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useMyProfile } from '@/hooks/useProfile';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Badge } from '@/components/ui/badge';
import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

type NavItem = { title: string; url: string; icon: any };

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: 'Principal',
    items: [{ title: 'Início', url: '/', icon: LayoutDashboard }],
  },
  {
    label: 'Colaboração',
    items: [
      { title: 'Mensagens', url: '/mensagens', icon: MessageSquare },
      { title: 'Documentação', url: '/docs', icon: BookOpen },
      { title: 'Salas', url: '/salas', icon: Calendar },
      { title: 'Equipe', url: '/equipe', icon: Users },
    ],
  },
  {
    label: 'Operações',
    items: [
      { title: 'Calendário Anual', url: '/calendario', icon: CalendarDays },
      { title: 'Lançamentos', url: '/lancamentos', icon: Rocket },
      { title: 'Checagem Site', url: '/checagens', icon: ClipboardCheck },
      { title: 'CRM', url: '/crm', icon: Briefcase },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { user, signOut } = useAuth();
  const { organizations, currentOrg, setCurrentOrg, isAdmin } = useOrganization();
  const { data: projects } = useProjectsByOrg(currentOrg?.id);
  const { data: myProfile } = useMyProfile();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();
  const navigate = useNavigate();
  const location = useLocation();
  const showProjects = location.pathname.startsWith('/tabela') || location.pathname.startsWith('/projetos');

  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [projectFilter, setProjectFilter] = useState('');
  const [showProjectSearch, setShowProjectSearch] = useState(false);

  const sortedProjects = useMemo(() => {
    if (!projects) return [];
    const sorted = [...projects].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));
    if (!projectFilter.trim()) return sorted;
    return sorted.filter(p => p.name.toLowerCase().includes(projectFilter.toLowerCase()));
  }, [projects, projectFilter]);

  const initials = (myProfile?.full_name || user?.user_metadata?.full_name || '?')
    .split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  const orgInitial = currentOrg?.name?.charAt(0)?.toUpperCase() || 'M';

  const handleCreateProject = () => {
    if (!newProjectName.trim()) return;
    createProject.mutate(
      { name: newProjectName.trim(), organizationId: currentOrg?.id },
      {
        onSuccess: (project) => {
          toast.success('Projeto criado!');
          setShowNewProject(false);
          setNewProjectName('');
          navigate(`/tabela?projeto=${project.id}`);
        },
        onError: () => toast.error('Erro ao criar projeto'),
      }
    );
  };

  const handleDeleteProject = (projectId: string, projectName: string) => {
    if (!confirm(`Tem certeza que deseja arquivar "${projectName}"?`)) return;
    deleteProject.mutate(projectId, {
      onSuccess: () => {
        toast.success('Projeto arquivado!');
        navigate('/');
      },
      onError: () => toast.error('Erro ao arquivar projeto'),
    });
  };

  return (
    <Sidebar collapsible="icon" className="sidebar-gradient border-r-0">
      {/* Brand header */}
      <div className={cn(
        'flex items-center gap-2 px-3 h-12 border-b border-sidebar-border/50',
        collapsed && 'justify-center px-0'
      )}>
        <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0">
          M
        </div>
        {!collapsed && (
          <span className="text-sidebar-foreground font-semibold text-sm tracking-tight">MOOUI</span>
        )}
      </div>

      <SidebarContent className="gap-0">
        {/* Navigation groups */}
        {navGroups.map((group) => (
          <SidebarGroup key={group.label} className="py-2">
            {!collapsed && (
              <SidebarGroupLabel className="text-sidebar-muted text-[10px] uppercase tracking-wider font-semibold px-3">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <NavLink
                        to={item.url}
                        end={item.url === '/'}
                        className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {/* Admin */}
        {isAdmin && (
          <SidebarGroup className="py-2">
            {!collapsed && (
              <SidebarGroupLabel className="text-sidebar-muted text-[10px] uppercase tracking-wider font-semibold px-3">
                Administração
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Configurações">
                    <NavLink
                      to="/configuracoes"
                      className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <Settings className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>Configurações</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Áreas de Trabalho — projetos */}
        {!collapsed && showProjects && (
          <SidebarGroup className="py-2">
            <Collapsible open={projectsOpen} onOpenChange={setProjectsOpen}>
              <div className="flex items-center justify-between pr-2">
                <CollapsibleTrigger asChild>
                  <button className="flex items-center gap-1 px-3 py-1 text-sidebar-muted hover:text-sidebar-foreground transition-colors group">
                    <ChevronDown className={cn(
                      'h-3 w-3 transition-transform',
                      !projectsOpen && '-rotate-90'
                    )} />
                    <span className="text-[10px] uppercase tracking-wider font-semibold">
                      Projetos
                    </span>
                  </button>
                </CollapsibleTrigger>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => setShowProjectSearch(s => !s)}
                    className={cn(
                      'p-1 rounded text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors',
                      showProjectSearch && 'bg-sidebar-accent text-sidebar-foreground'
                    )}
                    title="Buscar"
                  >
                    <Search className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => setShowNewProject(true)}
                    className="p-1 rounded text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                    title="Novo projeto"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <CollapsibleContent>
                {showProjectSearch && (
                  <div className="px-3 pt-1 pb-2">
                    <Input
                      autoFocus
                      placeholder="Filtrar projetos…"
                      value={projectFilter}
                      onChange={(e) => setProjectFilter(e.target.value)}
                      className="h-7 text-xs bg-sidebar-accent/30 border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-muted"
                    />
                  </div>
                )}
                <SidebarGroupContent>
                  <SidebarMenu>
                    {sortedProjects.length === 0 && (
                      <div className="px-3 py-2 text-xs text-sidebar-muted italic">
                        {projectFilter ? 'Nenhum encontrado' : 'Nenhum projeto ainda'}
                      </div>
                    )}
                    {sortedProjects.map((project) => (
                      <SidebarMenuItem key={project.id}>
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <SidebarMenuButton asChild>
                              <NavLink
                                to={`/tabela?projeto=${project.id}`}
                                className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground py-1.5"
                                activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                              >
                                <Table2 className="h-3.5 w-3.5 text-sidebar-muted shrink-0" />
                                <span className="truncate text-sm">{project.name}</span>
                              </NavLink>
                            </SidebarMenuButton>
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            <ContextMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDeleteProject(project.id, project.name)}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" />
                              Arquivar projeto
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* Footer: workspace switcher + user (Monday-style) */}
      <SidebarFooter className="border-t border-sidebar-border/50 p-2 gap-1.5">
        {/* Org switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                'w-full flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-sidebar-accent transition-colors text-left',
                collapsed && 'justify-center px-0'
              )}
              title={currentOrg?.name}
            >
              <div
                className="h-7 w-7 rounded-md flex items-center justify-center text-[11px] font-bold text-primary-foreground shrink-0"
                style={{ backgroundColor: currentOrg?.color || 'hsl(var(--primary))' }}
              >
                {orgInitial}
              </div>
              {!collapsed && (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-sidebar-muted leading-tight">Workspace</p>
                    <p className="text-sm font-medium text-sidebar-foreground truncate leading-tight">
                      {currentOrg?.name || 'Selecione'}
                    </p>
                  </div>
                  <ChevronsUpDown className="h-3.5 w-3.5 text-sidebar-muted shrink-0" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-60">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Trocar workspace
            </DropdownMenuLabel>
            {organizations.map((org) => (
              <DropdownMenuItem
                key={org.id}
                onClick={() => setCurrentOrg(org)}
                className="flex items-center gap-2"
              >
                <div
                  className="h-6 w-6 rounded flex items-center justify-center text-[9px] font-bold text-primary-foreground shrink-0"
                  style={{ backgroundColor: org.color }}
                >
                  {org.name.charAt(0).toUpperCase()}
                </div>
                <span className="flex-1 truncate">{org.name}</span>
                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 capitalize">
                  {org.role === 'admin' ? 'Admin' : 'Membro'}
                </Badge>
                {currentOrg?.id === org.id && (
                  <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                'w-full flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-sidebar-accent transition-colors text-left',
                collapsed && 'justify-center px-0'
              )}
              title={myProfile?.full_name || user?.email || ''}
            >
              <Avatar className="h-7 w-7 shrink-0">
                {myProfile?.avatar_url && <AvatarImage src={myProfile.avatar_url} alt={myProfile.full_name ?? ''} />}
                <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-[10px]">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-sidebar-foreground truncate leading-tight">
                      {myProfile?.full_name || user?.user_metadata?.full_name || 'Usuário'}
                    </p>
                    <p className="text-[11px] text-sidebar-muted truncate leading-tight">{user?.email}</p>
                  </div>
                  <ChevronsUpDown className="h-3.5 w-3.5 text-sidebar-muted shrink-0" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col">
                <span className="text-sm font-medium truncate">
                  {myProfile?.full_name || 'Usuário'}
                </span>
                <span className="text-xs text-muted-foreground truncate">{user?.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/equipe')}>
              <UserIcon className="h-4 w-4 mr-2" />
              Meu perfil
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem onClick={() => navigate('/configuracoes')}>
                <Settings className="h-4 w-4 mr-2" />
                Configurações
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>

      {/* New Project Dialog */}
      <Dialog open={showNewProject} onOpenChange={setShowNewProject}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Projeto</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Nome do projeto"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewProject(false)}>Cancelar</Button>
            <Button onClick={handleCreateProject} disabled={!newProjectName.trim() || createProject.isPending}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}
