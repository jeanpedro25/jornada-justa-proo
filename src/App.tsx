import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import AceiteTermosPage from "./pages/AceiteTermosPage";
import OnboardingPage from "./pages/OnboardingPage";
import AppPage from "./pages/AppPage";
import HistoricoPage from "./pages/HistoricoPage";
import RelatorioPage from "./pages/RelatorioPage";
import ConfigPage from "./pages/ConfigPage";
import PrivacidadePage from "./pages/PrivacidadePage";
import PrivacidadePublicaPage from "./pages/PrivacidadePublicaPage";
import TermosUsoPage from "./pages/TermosUsoPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const FullScreenLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <p className="text-muted-foreground">Carregando...</p>
  </div>
);

const HomeRoute: React.FC = () => {
  const { session, profile, loading } = useAuth();

  if (loading) return <FullScreenLoader />;
  if (!session) return <LandingPage />;
  if (profile && !(profile as any).aceite_termos) return <Navigate to="/aceite-termos" replace />;
  if (profile?.onboarding_completo) return <Navigate to="/app" replace />;
  return <Navigate to="/onboarding" replace />;
};

const ProtectedRoute: React.FC<{ children: React.ReactNode; skipOnboardingCheck?: boolean }> = ({ children, skipOnboardingCheck }) => {
  const { session, profile, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!session) return <Navigate to="/auth" replace />;
  if (profile && !(profile as any).aceite_termos) return <Navigate to="/aceite-termos" replace />;
  if (!skipOnboardingCheck && profile && !profile.onboarding_completo) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
};

const AuthRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, profile, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (session && profile && !(profile as any).aceite_termos) return <Navigate to="/aceite-termos" replace />;
  if (session && profile?.onboarding_completo) return <Navigate to="/app" replace />;
  if (session && !profile?.onboarding_completo) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
};

const TermsRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, profile, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!session) return <Navigate to="/auth" replace />;
  if (profile && (profile as any).aceite_termos && profile.onboarding_completo) return <Navigate to="/app" replace />;
  if (profile && (profile as any).aceite_termos && !profile.onboarding_completo) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<HomeRoute />} />
            <Route path="/auth" element={<AuthRoute><AuthPage /></AuthRoute>} />
            <Route path="/aceite-termos" element={<TermsRoute><AceiteTermosPage /></TermsRoute>} />
            <Route path="/termos" element={<TermosUsoPage />} />
            <Route path="/privacidade-publica" element={<PrivacidadePublicaPage />} />
            <Route path="/onboarding" element={<ProtectedRoute skipOnboardingCheck><OnboardingPage /></ProtectedRoute>} />
            <Route path="/app" element={<ProtectedRoute><AppPage /></ProtectedRoute>} />
            <Route path="/historico" element={<ProtectedRoute><HistoricoPage /></ProtectedRoute>} />
            <Route path="/relatorio" element={<ProtectedRoute><RelatorioPage /></ProtectedRoute>} />
            <Route path="/configuracoes" element={<ProtectedRoute><ConfigPage /></ProtectedRoute>} />
            <Route path="/privacidade" element={<ProtectedRoute><PrivacidadePage /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
