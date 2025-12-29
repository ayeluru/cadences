import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { LayoutDashboard, PieChart, Settings, LogOut, Loader2, Menu, X, Clock, CalendarDays, HelpCircle, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout, isLoggingOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/calendar", label: "Calendar", icon: CalendarDays },
    { type: "divider" },
    { href: "/tasks/daily", label: "Daily", icon: Clock },
    { href: "/tasks/weekly", label: "Weekly", icon: Clock },
    { href: "/tasks/monthly", label: "Monthly", icon: Clock },
    { href: "/tasks/yearly", label: "Long-term", icon: Clock },
    { type: "divider" },
    { href: "/stats", label: "Statistics", icon: PieChart },
    { href: "/metrics", label: "Metrics", icon: Activity },
    { href: "/guide", label: "User Guide", icon: HelpCircle },
    { href: "/settings", label: "Manage", icon: Settings },
  ] as any[];

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-card/50 backdrop-blur-xl sticky top-0 h-screen">
        <div className="p-6 border-b border-border/50">
          <h1 className="text-2xl font-display font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Cadences
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Track your recurring tasks.</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item, idx) => {
            if (item.type === "divider") {
              return <div key={`divider-${idx}`} className="my-2 border-t border-border/30" />;
            }
            const Icon = item.icon;
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href} className={`
                flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group
                ${isActive 
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 font-medium" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"}
              `}>
                <Icon className={`w-5 h-5 ${isActive ? "" : "group-hover:scale-110 transition-transform"}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border/50">
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center text-white text-xs font-bold">
              {user?.firstName?.[0] || user?.email?.[0] || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.firstName || "User"}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={() => logout()}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogOut className="w-4 h-4 mr-2" />}
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b flex items-center justify-between p-4">
        <h1 className="text-xl font-display font-bold text-foreground">Cadences</h1>
        <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </Button>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 top-16 z-30 bg-background/95 backdrop-blur-sm md:hidden p-4 flex flex-col gap-2"
          >
            {navItems.map((item, idx) => {
              if (item.type === "divider") {
                return <div key={`divider-${idx}`} className="my-2 border-t border-border/30" />;
              }
              const Icon = item.icon;
              const isActive = location === item.href;
              return (
                <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)} className={`
                  flex items-center gap-3 px-4 py-4 rounded-xl text-lg font-medium transition-colors
                  ${isActive 
                    ? "bg-primary text-primary-foreground" 
                    : "text-muted-foreground hover:bg-muted"}
                `}>
                  <Icon className="w-6 h-6" />
                  {item.label}
                </Link>
              );
            })}
            <div className="mt-auto border-t pt-4">
               <Button 
                variant="destructive" 
                className="w-full justify-center"
                onClick={() => logout()}
              >
                Sign Out
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-muted/20">
        <div className="container mx-auto max-w-5xl p-4 md:p-8 lg:p-12 pb-24 md:pb-12">
          {children}
        </div>
      </main>
      
      {/* Mobile Bottom Nav (Optional alternative to burger menu, but sticking to sidebar/burger for consistency) */}
    </div>
  );
}
