import { Link, useLocation } from "wouter";
import { useAuth, getDisplayName, getInitials } from "@/hooks/use-auth";
import { LayoutDashboard, PieChart, Settings, Menu, X, Clock, CalendarDays, HelpCircle, Activity, ChevronDown, ChevronRight, Timer, Plus, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ProfileSwitcher } from "@/components/ProfileSwitcher";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cadencesOpen, setCadencesOpen] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const cadenceItems = [
    { href: "/tasks/daily", label: "Daily", icon: Clock },
    { href: "/tasks/weekly", label: "Weekly", icon: Clock },
    { href: "/tasks/monthly", label: "Monthly", icon: Clock },
    { href: "/tasks/yearly", label: "Long-term", icon: Clock },
  ];

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/calendar", label: "Calendar", icon: CalendarDays },
    { type: "divider" },
    { type: "cadences-section" },
    { type: "divider" },
    { href: "/stats", label: "Statistics", icon: PieChart },
    { href: "/metrics", label: "Metrics", icon: Activity },
    { href: "/guide", label: "User Guide", icon: HelpCircle },
    { href: "/settings", label: "Settings", icon: Settings },
  ] as any[];

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-card/50 backdrop-blur-xl sticky top-0 h-screen">
        <div className="p-6 border-b border-border/50">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-display font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Cadences
            </h1>
            {import.meta.env.DEV && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-amber-500/15 text-amber-500 border border-amber-500/30">
                Dev
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">Track your recurring tasks.</p>
          <div className="mt-3">
            <ProfileSwitcher />
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item, idx) => {
            if (item.type === "divider") {
              return <div key={`divider-${idx}`} className="my-2 border-t border-border/30" />;
            }
            if (item.type === "cadences-section") {
              return (
                <Collapsible key="cadences" open={cadencesOpen} onOpenChange={setCadencesOpen}>
                  <CollapsibleTrigger className="flex items-center gap-3 px-4 py-2 w-full text-left text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-muted">
                    <Timer className="w-5 h-5" />
                    <span className="flex-1 font-medium">Cadences</span>
                    {cadencesOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pl-4 space-y-1 mt-1">
                    {cadenceItems.map((cadence) => {
                      const CadenceIcon = cadence.icon;
                      const isActive = location === cadence.href;
                      return (
                        <Link key={cadence.href} href={cadence.href} className={`
                          flex items-center gap-3 px-4 py-2 rounded-xl transition-all duration-200 group
                          ${isActive 
                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 font-medium" 
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"}
                        `}>
                          <CadenceIcon className={`w-4 h-4 ${isActive ? "" : "group-hover:scale-110 transition-transform"}`} />
                          {cadence.label}
                        </Link>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
              );
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
          <Link href="/account" className="flex items-center gap-3 px-4 py-3 mb-2 rounded-xl transition-colors hover:bg-muted group cursor-pointer">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white text-xs font-bold">
              {getInitials(user)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate group-hover:text-foreground">{getDisplayName(user)}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </Link>
          <p className="text-[10px] text-muted-foreground/50 text-center mt-2">v{__APP_VERSION__}</p>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b flex items-center justify-between gap-2 p-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-display font-bold text-foreground">Cadences</h1>
          {import.meta.env.DEV && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-amber-500/15 text-amber-500 border border-amber-500/30">
              Dev
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ProfileSwitcher />
          <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} data-testid="button-mobile-menu">
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </Button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 top-16 bottom-14 z-30 bg-background/95 backdrop-blur-sm md:hidden p-4 flex flex-col gap-2 overflow-y-auto"
          >
            {navItems.map((item, idx) => {
              if (item.type === "divider") {
                return <div key={`divider-${idx}`} className="my-2 border-t border-border/30" />;
              }
              if (item.type === "cadences-section") {
                return (
                  <Collapsible key="cadences-mobile" open={cadencesOpen} onOpenChange={setCadencesOpen}>
                    <CollapsibleTrigger className="flex items-center gap-3 px-4 py-4 w-full text-left text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-muted text-lg font-medium">
                      <Timer className="w-6 h-6" />
                      <span className="flex-1">Cadences</span>
                      {cadencesOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pl-6 space-y-1 mt-1">
                      {cadenceItems.map((cadence) => {
                        const CadenceIcon = cadence.icon;
                        const isActive = location === cadence.href;
                        return (
                          <Link key={cadence.href} href={cadence.href} onClick={() => setMobileMenuOpen(false)} className={`
                            flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-colors
                            ${isActive 
                              ? "bg-primary text-primary-foreground" 
                              : "text-muted-foreground hover:bg-muted"}
                          `}>
                            <CadenceIcon className="w-5 h-5" />
                            {cadence.label}
                          </Link>
                        );
                      })}
                    </CollapsibleContent>
                  </Collapsible>
                );
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
              <Link href="/account" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground hover:bg-muted">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white text-xs font-bold">
                  {getInitials(user)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{getDisplayName(user)}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
              </Link>
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
      
      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-center justify-around h-14">
          <Link href="/" className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${location === '/' ? 'text-primary' : 'text-muted-foreground'}`}>
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-[10px] font-medium">Home</span>
          </Link>
          <Link href="/calendar" className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${location === '/calendar' ? 'text-primary' : 'text-muted-foreground'}`}>
            <CalendarDays className="w-5 h-5" />
            <span className="text-[10px] font-medium">Calendar</span>
          </Link>
          <button
            onClick={() => setCreateDialogOpen(true)}
            className="flex items-center justify-center w-12 h-12 -mt-4 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 active:scale-95 transition-transform"
          >
            <Plus className="w-6 h-6" />
          </button>
          <Link href="/stats" className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${location === '/stats' ? 'text-primary' : 'text-muted-foreground'}`}>
            <PieChart className="w-5 h-5" />
            <span className="text-[10px] font-medium">Stats</span>
          </Link>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${mobileMenuOpen ? 'text-primary' : 'text-muted-foreground'}`}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>

      {createDialogOpen && <CreateTaskDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />}
    </div>
  );
}
