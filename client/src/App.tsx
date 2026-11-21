import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AppModeProvider } from "./contexts/AppModeContext";
import Home from "./pages/Home";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import LinkPagesPage, { PublicLinkPage } from "./pages/LinkPagesPage";
import OnboardingPage from "./pages/OnboardingPage";
import AdminPage from "./pages/AdminPage";
function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={() => <AuthPage initialMode="login" />} />
      <Route path="/connexion" component={() => <AuthPage initialMode="login" />} />
      <Route path="/signup" component={() => <AuthPage initialMode="signup" />} />
      <Route path="/inscription" component={() => <AuthPage initialMode="signup" />} />
      <Route path="/forgot-password" component={() => <AuthPage initialMode="forgot" />} />
      <Route path="/reset-password" component={() => <AuthPage initialMode="reset" />} />
      <Route path="/auth/callback" component={() => <AuthPage initialMode="login" />} />
      <Route path="/onboarding" component={OnboardingPage} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/p/:slug">{params => <PublicLinkPage slug={params.slug} />}</Route>
      <Route path="/link-pages" component={LinkPagesPage} />
      <Route path="/link-pages/:id" component={LinkPagesPage} />
      <Route path="/dashboard" component={Home} />
      <Route path="/comptes" component={Home} />
      <Route path="/contenus" component={Home} />
      <Route path="/calendrier" component={Home} />
      <Route path="/publications" component={Home} />
      <Route path="/interactions" component={Home} />
      <Route path="/assistants" component={Home} />
      <Route path="/analytics" component={Home} />
      <Route path="/equipe" component={Home} />
      <Route path="/abonnement" component={Home} />
      <Route path="/automatisations" component={Home} />
      <Route path="/notifications" component={Home} />
      <Route path="/parametres" component={Home} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <AppModeProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AppModeProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
