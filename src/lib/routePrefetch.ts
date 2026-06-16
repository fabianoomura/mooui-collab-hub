// Maps route paths -> dynamic import factories so we can prefetch chunks
// on sidebar hover / idle, eliminating the blank-screen pause on first nav.

type Loader = () => Promise<unknown>;

const loaders: Record<string, Loader> = {
  "/": () => import("@/pages/Dashboard"),
  "/tabela": () => import("@/pages/TableViewPage"),
  "/projetos": () => import("@/pages/ProjectsPage"),
  "/equipe": () => import("@/pages/TeamPage"),
  "/mensagens": () => import("@/pages/MessagesPage"),
  "/docs": () => import("@/pages/DocsPage"),
  "/salas": () => import("@/pages/RoomsPage"),
  "/calendario": () => import("@/pages/CalendarPage"),
  "/lancamentos": () => import("@/pages/LaunchesPage"),
  "/tickets": () => import("@/pages/TicketsPage"),
  "/pedidos": () => import("@/pages/OrdersPage"),
  "/checagens": () => import("@/pages/ChecklistPage"),
  "/timeline": () => import("@/pages/TimelinePage"),
  "/configuracoes": () => import("@/pages/SettingsPage"),
};

const started = new Set<string>();

export function prefetchRoute(path: string) {
  // Strip query/hash; match base path
  const base = path.split("?")[0].split("#")[0];
  const key = loaders[base] ? base : base.startsWith("/tabela") ? "/tabela" : null;
  if (!key || started.has(key)) return;
  started.add(key);
  loaders[key]().catch(() => started.delete(key));
}

// Prefetch the heaviest / most-used modules when the browser is idle
export function prefetchHotRoutes() {
  const hot = ["/pedidos", "/tickets", "/mensagens", "/newsletters", "/tabela"];
  const run = () => hot.forEach(prefetchRoute);
  const ric = (window as any).requestIdleCallback as
    | ((cb: () => void, opts?: { timeout: number }) => number)
    | undefined;
  if (ric) ric(run, { timeout: 3000 });
  else setTimeout(run, 1500);
}
