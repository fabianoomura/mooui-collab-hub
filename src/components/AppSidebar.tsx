import { LayoutDashboard, Users, LogOut, Table2, ChevronDown, Search, Check, Plus, Trash2, MessageSquare, BookOpen, Settings, Calendar, CalendarDays, Rocket } from 'lucide-react';
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
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Badge } from '@/components/ui/badge';
import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const baseNav = [
  { title: 'Início', url: '/', icon: LayoutDashboard },
  { title: 'Mensagens', url: '/mensagens', icon: MessageSquare },
  { title: 'Documentação', url: '/docs', icon: BookOpen },
  { title: 'Salas', url: '/salas', icon: Calendar },
  { title: 'Calendário Anual', url: '/calendario', icon: CalendarDays },
  { title: 'Lançamentos', url: '/lancamentos', icon: Rocket },
  { title: 'Equipe', url: '/equipe', icon: Users },
];
const adminNav = { title: 'Configurações', url: '/configuracoes', icon: Settings };

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

  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const sortedProjects = useMemo(() => {
    if (!projects) return [];
    return [...projects].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));
  }, [projects]);

  const mainNav = useMemo(() => (isAdmin ? [...baseNav, adminNav] : baseNav), [isAdmin]);

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
      <SidebarContent>
        {/* Main nav */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-muted text-xs uppercase tracking-wider">
            {!collapsed && 'MOOUI'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/'}
                      className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="h-4 w-4 mr-2" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Áreas de Trabalho */}
        {!collapsed && (
          <SidebarGroup>
            <div className="flex items-center justify-between px-3 py-1">
              <SidebarGroupLabel className="text-sidebar-muted text-xs uppercase tracking-wider p-0">
                Áreas de trabalho
              </SidebarGroupLabel>
              <div className="flex items-center gap-1">
                <button className="text-sidebar-muted hover:text-sidebar-foreground transition-colors p-0.5">
                  <Search className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Organization selector */}
            <div className="px-3 py-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-full flex items-center gap-2 rounded-md bg-sidebar-accent/50 px-2 py-1.5 hover:bg-sidebar-accent transition-colors">
                    <div
                      className="h-6 w-6 rounded flex items-center justify-center text-[9px] font-bold text-primary-foreground shrink-0"
                      style={{ backgroundColor: currentOrg?.color || 'hsl(var(--primary))' }}
                    >
                      {orgInitial}
                    </div>
                    <span className="text-sm font-medium text-sidebar-foreground truncate flex-1 text-left">
                      {currentOrg?.name || 'Selecione'}
                    </span>
                    {isAdmin && (
                      <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 bg-sidebar-accent text-sidebar-muted">
                        Admin
                      </Badge>
                    )}
                    <ChevronDown className="h-3 w-3 text-sidebar-muted shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  {organizations.map((org) => (
                    <DropdownMenuItem
                      key={org.id}
                      onClick={() => setCurrentOrg(org)}
                      className="flex items-center gap-2"
                    >
                      <div
                        className="h-5 w-5 rounded flex items-center justify-center text-[8px] font-bold text-primary-foreground shrink-0"
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
            </div>

            {/* Add project button */}
            <div className="px-3 py-1">
              <button
                onClick={() => setShowNewProject(true)}
                className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors text-sm"
              >
                <Plus className="h-3.5 w-3.5 shrink-0" />
                <span>Novo projeto</span>
              </button>
            </div>

            <Collapsible defaultOpen>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
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
                                <Table2 className="h-3.5 w-3.5 mr-2 text-sidebar-muted shrink-0" />
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

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            {myProfile?.avatar_url && <AvatarImage src={myProfile.avatar_url} alt={myProfile.full_name ?? ''} />}
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-accent-foreground truncate">
                {myProfile?.full_name || user?.user_metadata?.full_name || 'Usuário'}
              </p>
              <p className="text-xs text-sidebar-muted truncate">{user?.email}</p>
            </div>
          )}
          {!collapsed && (
            <button onClick={signOut} className="text-sidebar-muted hover:text-sidebar-foreground transition-colors">
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
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
