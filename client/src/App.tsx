import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import DailyTasks from "@/pages/DailyTasks";
import WeeklyTasks from "@/pages/WeeklyTasks";
import MonthlyTasks from "@/pages/MonthlyTasks";
import YearlyTasks from "@/pages/YearlyTasks";
import Stats from "@/pages/Stats";
import Settings from "@/pages/Settings";
import AuthPage from "@/pages/AuthPage";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

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
    <AppLayout>
      <Component />
    </AppLayout>
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
