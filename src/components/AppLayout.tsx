import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Outlet } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Moon, Search, Sun, SunMoon, Monitor, Check } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { NotificationsBell } from '@/components/NotificationsBell';
import { CommandPalette } from '@/components/CommandPalette';
import { OrgSwitcher } from '@/components/OrgSwitcher';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function AppLayout() {
  const { theme, preference, setTheme } = useTheme();

  const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border bg-background px-4 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <SidebarTrigger />
              <div className="h-5 w-px bg-border mx-1" />
              <OrgSwitcher />
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
                }}
                className="hidden sm:flex items-center gap-2 h-8 px-2.5 rounded-md border border-border text-muted-foreground hover:bg-muted/50 transition-colors text-xs"
                aria-label="Buscar"
              >
                <Search className="h-3.5 w-3.5" />
                <span>Buscar</span>
                <kbd className="ml-2 text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">{isMac ? '⌘' : 'Ctrl'} K</kbd>
              </button>
              <NotificationsBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Alternar tema">
                    {theme === 'dark' ? <Moon className="h-4 w-4" /> : theme === 'dim' ? <SunMoon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  {([
                    { value: 'light', label: 'Claro', icon: Sun },
                    { value: 'dim', label: 'Intermediário', icon: SunMoon },
                    { value: 'dark', label: 'Escuro', icon: Moon },
                    { value: 'auto', label: 'Automático', icon: Monitor },
                  ] as const).map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <DropdownMenuItem key={opt.value} onClick={() => setTheme(opt.value)} className="gap-2">
                        <Icon className="h-4 w-4" />
                        <span className="flex-1">{opt.label}</span>
                        {preference === opt.value && <Check className="h-3.5 w-3.5" />}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>

            </div>
          </header>
          <main className="flex-1 min-w-0 overflow-auto p-3 sm:p-6">
            <Outlet />
          </main>
        </div>
      </div>
      <CommandPalette />
    </SidebarProvider>
  );
}

