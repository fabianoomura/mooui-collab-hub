import { LayoutDashboard, Users, LogOut, Table2, ChevronDown, Search, Check } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useProjects } from '@/hooks/useProjectData';
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useMemo } from 'react';

const mainNav = [
  { title: 'Painel', url: '/', icon: LayoutDashboard },
  { title: 'Equipe', url: '/equipe', icon: Users },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { user, signOut } = useAuth();
  const { organizations, currentOrg, setCurrentOrg, isAdmin } = useOrganization();
  const { data: projects } = useProjects();

  const sortedProjects = useMemo(() => {
    if (!projects) return [];
    return [...projects].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));
  }, [projects]);

  const initials = user?.user_metadata?.full_name
    ?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || '?';

  const orgInitial = currentOrg?.name?.charAt(0)?.toUpperCase() || 'M';

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

            <Collapsible defaultOpen>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {sortedProjects.map((project) => (
                      <SidebarMenuItem key={project.id}>
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
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-accent-foreground truncate">
                {user?.user_metadata?.full_name || 'Usuário'}
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
    </Sidebar>
  );
}
