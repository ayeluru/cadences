import { Switch, Route } from "wouter";
import { queryClient, queryPersister, PERSISTED_CACHE_MAX_AGE } from "./lib/queryClient";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";

declare const __APP_VERSION__: string;
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import AuthPage from "@/pages/AuthPage";
import { AppLayout } from "@/components/layout/AppLayout";
import { TopProgressBar } from "@/components/TopProgressBar";
import { useAuth, AuthProvider } from "@/hooks/use-auth";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { NameRequiredModal } from "@/components/NameRequiredModal";
import { Loader2 } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useTimezoneAutoDetect } from "@/hooks/use-user-settings";

const DailyTasks = lazy(() => import("@/pages/DailyTasks"));
const WeeklyTasks = lazy(() => import("@/pages/WeeklyTasks"));
const MonthlyTasks = lazy(() => import("@/pages/MonthlyTasks"));
const YearlyTasks = lazy(() => import("@/pages/YearlyTasks"));
const Stats = lazy(() => import("@/pages/Stats"));
const Settings = lazy(() => import("@/pages/Settings"));
const UserGuide = lazy(() => import("@/pages/UserGuide"));
const CalendarView = lazy(() => import("@/pages/CalendarView"));
const MetricsPage = lazy(() => import("@/pages/Metrics"));
const Account = lazy(() => import("@/pages/Account"));
const FeedbackPage = lazy(() => import("@/pages/FeedbackPage"));
const FeedbackDetailPage = lazy(() => import("@/pages/FeedbackDetailPage"));
const AdminPage = lazy(() => import("@/pages/AdminPage"));

function PageTransition({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [key, setKey] = useState(0);
  const prevLocation = useRef(location);

  useEffect(() => {
    if (location !== prevLocation.current) {
      prevLocation.current = location;
      setKey((k) => k + 1);
    }
  }, [location]);

  return (
    <div key={key} className="page-enter">
      {children}
    </div>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  useTimezoneAutoDetect();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  const hasName = !!user.user_metadata?.firstName?.trim();

  return (
    <ProfileProvider>
      {!hasName && <NameRequiredModal />}
      <AppLayout>
        <Suspense fallback={
          <div className="flex h-64 w-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        }>
          <PageTransition>
            {children}
          </PageTransition>
        </Suspense>
      </AppLayout>
    </ProfileProvider>
  );
}

function Router() {
  const [location] = useLocation();

  if (location === "/login") {
    return <AuthPage />;
  }

  return (
    <AuthGate>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/tasks/daily" component={DailyTasks} />
        <Route path="/tasks/weekly" component={WeeklyTasks} />
        <Route path="/tasks/monthly" component={MonthlyTasks} />
        <Route path="/tasks/yearly" component={YearlyTasks} />
        <Route path="/stats" component={Stats} />
        <Route path="/calendar" component={CalendarView} />
        <Route path="/metrics" component={MetricsPage} />
        <Route path="/guide" component={UserGuide} />
        <Route path="/account" component={Account} />
        <Route path="/settings" component={Settings} />
        <Route path="/feedback/:id" component={FeedbackDetailPage} />
        <Route path="/feedback" component={FeedbackPage} />
        <Route path="/admin" component={AdminPage} />
        <Route component={NotFound} />
      </Switch>
    </AuthGate>
  );
}

function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        maxAge: PERSISTED_CACHE_MAX_AGE,
        // Bust the persisted cache when the app version changes so a deploy
        // doesn't hand a user data shaped for the old client.
        buster: __APP_VERSION__,
      }}
    >
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <TopProgressBar />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}

export default App;
