import { useAuth } from "@/hooks/use-auth";
import { useAdminUsers, useSetUserRole, type AdminUser } from "@/hooks/use-admin";
import { useFeedbackStats } from "@/hooks/use-feedback";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="flex items-center justify-between py-3 px-4 border-b last:border-b-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-muted-foreground/20 to-muted-foreground/10 flex items-center justify-center text-sm font-bold text-muted-foreground shrink-0">
          {(adminUser.firstName?.[0] ?? adminUser.email[0]).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium truncate">{displayName}</p>
            {isSelf && <Badge variant="outline" className="text-[10px] py-0">You</Badge>}
          </div>
          <p className="text-xs text-muted-foreground truncate">{adminUser.email}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <Badge variant={isAdminRole ? "default" : "secondary"} className="text-xs">
          {isAdminRole ? "Admin" : "User"}
        </Badge>
        <Button
          variant={isAdminRole ? "destructive" : "outline"}
          size="sm"
          onClick={handleToggle}
          disabled={isSelf || setRole.isPending}
        >
          {setRole.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isAdminRole ? (
            <>
              <ShieldOff className="w-3.5 h-3.5 mr-1" />
              Revoke
            </>
          ) : (
            <>
              <Shield className="w-3.5 h-3.5 mr-1" />
              Grant Admin
            </>
          )}
        </Button>
      </div>
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
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <p className="text-muted-foreground mt-1">Manage user roles, permissions, and feedback</p>
      </div>

      {/* Feedback overview */}
      {feedbackStats && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquarePlus className="w-5 h-5" />
                Feedback Overview
              </CardTitle>
              <Link href="/feedback">
                <Button variant="ghost" size="sm" className="text-xs">
                  View Board <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold">{feedbackStats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className={`rounded-lg border p-3 text-center ${feedbackStats.unreviewed > 0 ? "border-destructive/40 bg-destructive/5" : ""}`}>
                <p className={`text-2xl font-bold ${feedbackStats.unreviewed > 0 ? "text-destructive" : ""}`}>{feedbackStats.unreviewed}</p>
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  {feedbackStats.unreviewed > 0 && <AlertCircle className="w-3 h-3 text-destructive" />}
                  Needs Review
                </p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="flex items-center justify-center gap-1">
                  <Eye className="w-4 h-4 text-muted-foreground" />
                  <p className="text-2xl font-bold">{feedbackStats.public}</p>
                </div>
                <p className="text-xs text-muted-foreground">Public</p>
              </div>
            </div>

            {Object.keys(feedbackStats.byStatus).length > 0 && (
              <div className="flex items-center gap-3 flex-wrap text-xs">
                <span className="text-muted-foreground font-medium">By status:</span>
                {Object.entries(feedbackStats.byStatus).map(([status, count]) => (
                  <span key={status} className="flex items-center gap-1.5 text-muted-foreground">
                    <span className={`w-1.5 h-1.5 rounded-full ${statusDots[status] ?? "bg-gray-400"}`} />
                    {statusLabels[status] ?? status} ({count})
                  </span>
                ))}
              </div>
            )}

            {feedbackStats.unreviewed > 0 && (
              <Link href="/feedback">
                <Button variant="outline" size="sm" className="w-full text-xs">
                  <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
                  Review {feedbackStats.unreviewed} pending submission{feedbackStats.unreviewed !== 1 ? "s" : ""}
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="w-8 h-8 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{totalCount}</p>
              <p className="text-xs text-muted-foreground">Total Users</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Shield className="w-8 h-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{adminCount}</p>
              <p className="text-xs text-muted-foreground">Admins</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Users</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            users?.map(u => (
              <UserRow key={u.id} adminUser={u} currentUserId={user?.id ?? ""} />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
