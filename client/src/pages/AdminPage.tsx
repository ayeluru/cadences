import { useAuth } from "@/hooks/use-auth";
import { useAdminUsers, useSetUserRole, type AdminUser } from "@/hooks/use-admin";
import { useFeedbackStats } from "@/hooks/use-feedback";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Loader2, Shield, ShieldOff, Users, MessageSquarePlus, AlertCircle, Eye, ChevronRight } from "lucide-react";

function UserRow({ adminUser, currentUserId }: { adminUser: AdminUser; currentUserId: string }) {
  const setRole = useSetUserRole();
  const { toast } = useToast();
  const isSelf = adminUser.id === currentUserId;
  const isAdminRole = adminUser.role === "admin";

  const displayName = [adminUser.firstName, adminUser.lastName].filter(Boolean).join(" ") || adminUser.email;

  const handleToggle = async () => {
    if (isSelf) {
      toast({ title: "Cannot change your own role", variant: "destructive" });
      return;
    }
    const newRole = isAdminRole ? "user" : "admin";
    try {
      await setRole.mutateAsync({ userId: adminUser.id, role: newRole });
      toast({ title: "Role updated", description: `${displayName} is now ${newRole}` });
    } catch {
      toast({ title: "Error", description: "Failed to update role", variant: "destructive" });
    }
  };

  return (
    <div className="flex items-center justify-between py-3 group">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0">
          {(adminUser.firstName?.[0] ?? adminUser.email[0]).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">{displayName}</p>
            {isSelf && <Badge variant="outline" className="text-[10px] py-0 h-4">You</Badge>}
            <Badge variant={isAdminRole ? "default" : "secondary"} className="text-[10px] h-4 px-1.5">
              {isAdminRole ? "Admin" : "User"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate">{adminUser.email}</p>
        </div>
      </div>
      <Button
        variant={isAdminRole ? "destructive" : "outline"}
        size="sm"
        onClick={handleToggle}
        disabled={isSelf || setRole.isPending}
        className="shrink-0 text-xs h-7"
      >
        {setRole.isPending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : isAdminRole ? (
          <>
            <ShieldOff className="w-3 h-3 mr-1" />
            Revoke
          </>
        ) : (
          <>
            <Shield className="w-3 h-3 mr-1" />
            Grant Admin
          </>
        )}
      </Button>
    </div>
  );
}

export default function AdminPage() {
  const { user, isAdmin } = useAuth();
  const { data: users, isLoading } = useAdminUsers();

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Shield className="w-12 h-12 mb-4 opacity-30" />
        <p className="text-lg font-medium">Access Denied</p>
        <p className="text-sm mt-1">You need admin privileges to view this page.</p>
      </div>
    );
  }

  const { data: feedbackStats } = useFeedbackStats(true);
  const adminCount = users?.filter(u => u.role === "admin").length ?? 0;
  const totalCount = users?.length ?? 0;

  const statusLabels: Record<string, string> = {
    new: "New",
    under_review: "Under Review",
    planned: "Planned",
    in_progress: "In Progress",
    done: "Done",
    declined: "Declined",
  };

  const statusDots: Record<string, string> = {
    new: "bg-gray-400",
    under_review: "bg-yellow-500",
    planned: "bg-blue-500",
    in_progress: "bg-purple-500",
    done: "bg-green-500",
    declined: "bg-red-500",
  };

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground mb-1">Admin</h1>
        <p className="text-muted-foreground text-sm">Manage users, roles, and feedback.</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Users className="w-3.5 h-3.5" />
            Users
          </div>
          <div className="text-2xl font-bold tracking-tight">{totalCount}</div>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Shield className="w-3.5 h-3.5 text-primary" />
            Admins
          </div>
          <div className="text-2xl font-bold tracking-tight">{adminCount}</div>
        </div>
        {feedbackStats && (
          <>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <MessageSquarePlus className="w-3.5 h-3.5" />
                Feedback
              </div>
              <div className="text-2xl font-bold tracking-tight">{feedbackStats.total}</div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                {feedbackStats.unreviewed > 0 && <AlertCircle className="w-3.5 h-3.5 text-destructive" />}
                {feedbackStats.unreviewed === 0 && <Eye className="w-3.5 h-3.5" />}
                Needs Review
              </div>
              <div className={`text-2xl font-bold tracking-tight ${feedbackStats.unreviewed > 0 ? "text-destructive" : ""}`}>
                {feedbackStats.unreviewed}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Feedback status breakdown */}
      {feedbackStats && Object.keys(feedbackStats.byStatus).length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              <MessageSquarePlus className="w-4 h-4" />
              Feedback
            </h2>
            <Link href="/feedback">
              <Button variant="ghost" size="sm" className="text-xs h-7">
                View Board <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          </div>
          <div className="flex items-center gap-3 flex-wrap text-xs">
            {Object.entries(feedbackStats.byStatus).map(([status, count]) => (
              <span key={status} className="flex items-center gap-1.5 text-muted-foreground">
                <span className={`w-1.5 h-1.5 rounded-full ${statusDots[status] ?? "bg-gray-400"}`} />
                {statusLabels[status] ?? status} <span className="font-medium text-foreground">{count}</span>
              </span>
            ))}
          </div>
          {feedbackStats.unreviewed > 0 && (
            <Link href="/feedback">
              <Button variant="outline" size="sm" className="mt-3 text-xs h-7">
                <AlertCircle className="w-3 h-3 mr-1.5" />
                Review {feedbackStats.unreviewed} pending
              </Button>
            </Link>
          )}
        </section>
      )}

      {/* User list */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-wider text-foreground mb-3">
          Users
        </h2>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {users?.map(u => (
              <UserRow key={u.id} adminUser={u} currentUserId={user?.id ?? ""} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
