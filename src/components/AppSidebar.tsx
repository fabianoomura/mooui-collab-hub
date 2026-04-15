import { LayoutDashboard, Users, LogOut, Table2, ChevronDown, Search, Plus } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useMemo } from 'react';

const mainNav = [
  { title: 'Painel', url: '/', icon: LayoutDashboard },
  { title: 'Equipe', url: '/equipe', icon: Users },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { user, signOut } = useAuth();
  const { data: projects } = useProjects();

  const sortedProjects = useMemo(() => {
    if (!projects) return [];
    return [...projects].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));
  }, [projects]);

  const initials = user?.user_metadata?.full_name
    ?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || '?';

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

        {/* Áreas de Trabalho - Monday.com style */}
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

            {/* Workspace selector like Monday */}
            <div className="px-3 py-1">
              <div className="flex items-center gap-2 rounded-md bg-sidebar-accent/50 px-2 py-1.5">
                <div className="h-6 w-6 rounded bg-primary flex items-center justify-center text-[9px] font-bold text-primary-foreground shrink-0">
                  M
                </div>
                <span className="text-sm font-medium text-sidebar-foreground truncate">MOOUI</span>
                <ChevronDown className="h-3 w-3 text-sidebar-muted ml-auto shrink-0" />
              </div>
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
