import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AppLayout } from "@/components/AppLayout";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import Dashboard from "./pages/Dashboard";
import TableViewPage from "./pages/TableViewPage";
import ProjectsPage from "./pages/ProjectsPage";
import TeamPage from "./pages/TeamPage";
import MessagesPage from "./pages/MessagesPage";
import DocsPage from "./pages/DocsPage";
import RoomsPage from "./pages/RoomsPage";
import CalendarPage from "./pages/CalendarPage";
import LaunchesPage from "./pages/LaunchesPage";
import TicketsPage from "./pages/TicketsPage";
import OrdersPage from "./pages/OrdersPage";
import ChecklistPage from "./pages/ChecklistPage";
import TimelinePage from "./pages/TimelinePage";
import SettingsPage from "./pages/SettingsPage";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

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
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <OrganizationProvider>
          <ConfirmProvider>
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
              <Route path="/configuracoes" element={<SettingsPage />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
          </ConfirmProvider>
          </OrganizationProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
