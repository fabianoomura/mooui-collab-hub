import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { I18nProvider } from "@/i18n";
import { AppLayout } from "@/components/AppLayout";
import { ConfirmProvider } from "@/components/ConfirmDialog";

// Lazy-loaded pages — each becomes its own chunk
const Dashboard = lazy(() => import("./pages/Dashboard"));
const TableViewPage = lazy(() => import("./pages/TableViewPage"));
const ProjectsPage = lazy(() => import("./pages/ProjectsPage"));
const TeamPage = lazy(() => import("./pages/TeamPage"));
const MessagesPage = lazy(() => import("./pages/MessagesPage"));
const DocsPage = lazy(() => import("./pages/DocsPage"));
const RoomsPage = lazy(() => import("./pages/RoomsPage"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const LaunchesPage = lazy(() => import("./pages/LaunchesPage"));
const TicketsPage = lazy(() => import("./pages/TicketsPage"));
const OrdersPage = lazy(() => import("./pages/OrdersPage"));
const ChecklistPage = lazy(() => import("./pages/ChecklistPage"));
const TimelinePage = lazy(() => import("./pages/TimelinePage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const MelhoriasPage = lazy(() => import("./pages/MelhoriasPage"));
const ConteudoPage = lazy(() => import("./pages/ConteudoPage"));
const ProgramacaoPage = lazy(() => import("./pages/ProgramacaoPage"));
const NewslettersPage = lazy(() => import("./pages/NewslettersPage"));
const DemandasMarketingPage = lazy(() => import("./pages/DemandasMarketingPage"));
const SessoesPage = lazy(() => import("./pages/SessoesPage"));
const ProdutoPage = lazy(() => import("./pages/ProdutoPage"));
const DesignPage = lazy(() => import("./pages/DesignPage"));
const ComercialPage = lazy(() => import("./pages/ComercialPage"));
const FinanceiroPage = lazy(() => import("./pages/FinanceiroPage"));
const InternacionalPage = lazy(() => import("./pages/InternacionalPage"));
const ProducaoBoardsPage = lazy(() => import("./pages/ProducaoBoardsPage"));
const AcoesMensaisPage = lazy(() => import("./pages/AcoesMensaisPage"));
const MarketingPage = lazy(() => import("./pages/MarketingPage"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <div className="h-6 w-6 border-3 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <I18nProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <OrganizationProvider>
          <ConfirmProvider>
          <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/cadastro" element={<PublicRoute><Signup /></PublicRoute>} />
            <Route path="/esqueci-senha" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
            <Route path="/redefinir-senha" element={<ResetPassword />} />

            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/tabela" element={<TableViewPage />} />
              <Route path="/projetos" element={<ProjectsPage />} />
              <Route path="/equipe" element={<TeamPage />} />
              <Route path="/mensagens" element={<MessagesPage />} />
              <Route path="/docs" element={<DocsPage />} />
              <Route path="/salas" element={<RoomsPage />} />
              <Route path="/calendario" element={<CalendarPage />} />
              <Route path="/lancamentos" element={<LaunchesPage />} />
              <Route path="/tickets" element={<TicketsPage />} />
              <Route path="/pedidos" element={<OrdersPage />} />
              <Route path="/checagens" element={<ChecklistPage />} />
              <Route path="/timeline" element={<TimelinePage />} />
              <Route path="/melhorias" element={<MelhoriasPage />} />
              <Route path="/conteudo" element={<ConteudoPage />} />
              <Route path="/programacao" element={<ProgramacaoPage />} />
              <Route path="/newsletters" element={<NewslettersPage />} />
              <Route path="/demandas-marketing" element={<DemandasMarketingPage />} />
              <Route path="/sessoes" element={<SessoesPage />} />
              <Route path="/produtos" element={<ProdutoPage />} />
              <Route path="/design" element={<DesignPage />} />
              <Route path="/comercial" element={<ComercialPage />} />
              <Route path="/financeiro" element={<FinanceiroPage />} />
              <Route path="/internacional" element={<InternacionalPage />} />
              <Route path="/producao-boards" element={<ProducaoBoardsPage />} />
              <Route path="/acoes-mensais" element={<AcoesMensaisPage />} />
              <Route path="/marketing" element={<MarketingPage />} />
              <Route path="/configuracoes" element={<SettingsPage />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
          </ConfirmProvider>
          </OrganizationProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </I18nProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
