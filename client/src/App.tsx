import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import AuthPage from "@/pages/AuthPage";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { Loader2 } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

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

function PrivateRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

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

  return (
    <ProfileProvider>
      <AppLayout>
        <Suspense fallback={
          <div className="flex h-64 w-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        }>
          <PageTransition>
            <Component />
          </PageTransition>
        </Suspense>
      </AppLayout>
    </ProfileProvider>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <PrivateRoute component={Dashboard} />} />
      <Route path="/tasks/daily" component={() => <PrivateRoute component={DailyTasks} />} />
      <Route path="/tasks/weekly" component={() => <PrivateRoute component={WeeklyTasks} />} />
      <Route path="/tasks/monthly" component={() => <PrivateRoute component={MonthlyTasks} />} />
      <Route path="/tasks/yearly" component={() => <PrivateRoute component={YearlyTasks} />} />
      <Route path="/stats" component={() => <PrivateRoute component={Stats} />} />
      <Route path="/calendar" component={() => <PrivateRoute component={CalendarView} />} />
      <Route path="/metrics" component={() => <PrivateRoute component={MetricsPage} />} />
      <Route path="/guide" component={() => <PrivateRoute component={UserGuide} />} />
      <Route path="/account" component={() => <PrivateRoute component={Account} />} />
      <Route path="/settings" component={() => <PrivateRoute component={Settings} />} />
      <Route path="/login" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
