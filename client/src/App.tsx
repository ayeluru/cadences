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
import { lazy, Suspense } from "react";

const DailyTasks = lazy(() => import("@/pages/DailyTasks"));
const WeeklyTasks = lazy(() => import("@/pages/WeeklyTasks"));
const MonthlyTasks = lazy(() => import("@/pages/MonthlyTasks"));
const YearlyTasks = lazy(() => import("@/pages/YearlyTasks"));
const Stats = lazy(() => import("@/pages/Stats"));
const Settings = lazy(() => import("@/pages/Settings"));
const UserGuide = lazy(() => import("@/pages/UserGuide"));
const CalendarView = lazy(() => import("@/pages/CalendarView"));
const MetricsPage = lazy(() => import("@/pages/Metrics"));

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
          <Component />
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
