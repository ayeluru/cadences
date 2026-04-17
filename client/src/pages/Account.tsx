import { useAuth, getDisplayName, getInitials } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, AlertTriangle, Loader2, User, LogOut, Pencil, KeyRound, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/lib/supabase";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function useUpdateUser(onSettled?: () => void) {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: { firstName?: string; lastName?: string }) => {
      const res = await apiRequest('PATCH', '/api/auth/user', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      toast({ title: "Profile updated", description: "Your name has been updated." });
      onSettled?.();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });
}

function useDeleteAccount() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async () => {
      await apiRequest('DELETE', '/api/auth/user');
    },
    onSuccess: () => {
      toast({ title: "Account deleted", description: "Your account has been deleted." });
      window.location.href = "/";
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });
}

export default function Account() {
  const { user, logout, isLoggingOut, refreshUser } = useAuth();
  const updateUserMutation = useUpdateUser(() => refreshUser());
  const deleteAccountMutation = useDeleteAccount();
  const { toast } = useToast();

  const [editingName, setEditingName] = useState(false);
  const [firstName, setFirstName] = useState(user?.user_metadata?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.user_metadata?.lastName ?? "");

  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const displayName = getDisplayName(user);
  const initials = getInitials(user);

  const handleSaveName = () => {
    updateUserMutation.mutate(
      { firstName: firstName.trim(), lastName: lastName.trim() },
      { onSuccess: () => setEditingName(false) }
    );
  };

  const handleCancelEdit = () => {
    setFirstName(user?.user_metadata?.firstName ?? "");
    setLastName(user?.user_metadata?.lastName ?? "");
    setEditingName(false);
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: "Password too short", description: "Must be at least 6 characters.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }

    setPasswordLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email ?? "",
        password: currentPassword,
      });
      if (signInError) {
        toast({ title: "Current password is incorrect", variant: "destructive" });
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }

      toast({ title: "Password updated" });
      setChangingPassword(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleCancelPassword = () => {
    setChangingPassword(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrentPw(false);
    setShowNewPw(false);
  };

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold font-display tracking-tight">Account</h2>
        <p className="text-muted-foreground text-sm mt-1">Manage your profile and security.</p>
      </div>

      {/* Profile */}
      <section>
        <h3 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2 mb-4">
          <User className="w-4 h-4 text-primary" />
          Profile
        </h3>
        <div className="flex items-start gap-4">
          <Avatar className="w-14 h-14">
            <AvatarFallback className="text-base bg-gradient-to-br from-primary to-primary/70 text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-lg font-semibold">{displayName}</p>
              {!editingName && (
                <button
                  onClick={() => setEditingName(true)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="Edit name"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{user?.email || "No email"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "Unknown"}
            </p>
          </div>
        </div>

        {editingName && (
          <div className="mt-4 p-4 rounded-lg border bg-muted/30 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="first-name" className="text-xs">First name</Label>
                <Input
                  id="first-name"
                  placeholder="First name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <Label htmlFor="last-name" className="text-xs">Last name</Label>
                <Input
                  id="last-name"
                  placeholder="Last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveName} disabled={updateUserMutation.isPending}>
                {updateUserMutation.isPending && <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />}
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancelEdit} disabled={updateUserMutation.isPending}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Password */}
      <section>
        <h3 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2 mb-4">
          <KeyRound className="w-4 h-4 text-primary" />
          Password
        </h3>
        {!changingPassword ? (
          <Button variant="outline" size="sm" onClick={() => setChangingPassword(true)}>
            <KeyRound className="w-3.5 h-3.5 mr-1.5" />
            Change Password
          </Button>
        ) : (
          <div className="p-4 rounded-lg border bg-muted/30 space-y-3 max-w-sm">
            <div>
              <Label htmlFor="current-password" className="text-xs">Current password</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrentPw ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPw(!showCurrentPw)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrentPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="new-password" className="text-xs">New password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPw ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="confirm-password" className="text-xs">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                onClick={handleChangePassword}
                disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
              >
                {passwordLoading && <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />}
                Update Password
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancelPassword} disabled={passwordLoading}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Session */}
      <section>
        <h3 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2 mb-4">
          <LogOut className="w-4 h-4 text-primary" />
          Session
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => logout()}
          disabled={isLoggingOut}
          data-testid="button-logout"
        >
          {isLoggingOut ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5 mr-1.5" />}
          Sign Out
        </Button>
      </section>

      {/* Danger Zone */}
      <section>
        <h3 className="text-sm font-bold uppercase tracking-wider text-destructive flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4" />
          Danger Zone
        </h3>
        <p className="text-xs text-muted-foreground mb-3">Irreversible actions on your account.</p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" data-testid="button-delete-account">
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Delete Account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                Delete your account?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete your account and all associated data including all profiles, tasks, completions, categories, and tags. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteAccountMutation.mutate()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete-account"
              >
                {deleteAccountMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Delete Account
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </div>
  );
}
