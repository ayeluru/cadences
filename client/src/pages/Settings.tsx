import { useCategories, useDeleteCategory } from "@/hooks/use-categories";
import { useTags, useCreateTag } from "@/hooks/use-tags";
import { useProfiles, useCreateProfile, useDeleteProfile, useCreateDemoProfile, useClearProfileData, useClearAllProfilesData, useRegenerateDemoProfile, useImportFromProfile } from "@/hooks/use-profiles";
import { useProfileContext } from "@/contexts/ProfileContext";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Tag as TagIcon, Folder, Trash2, Database, AlertTriangle, Users, Sparkles, Check, Eraser, Loader2, RefreshCw, Copy, ChevronDown, User, LogOut } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { CreateCategoryDialog } from "@/components/CreateCategoryDialog";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
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

function useUpdateUser() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: { firstName?: string; lastName?: string }) => {
      const res = await apiRequest('PATCH', '/api/auth/user', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      toast({ title: "Profile updated", description: "Your profile has been updated." });
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

export default function Settings() {
  const { data: categories, isLoading: catsLoading } = useCategories();
  const { data: tags, isLoading: tagsLoading } = useTags();
  const { data: profiles, isLoading: profilesLoading } = useProfiles();
  const { currentProfile, setCurrentProfile, isLoading: profileContextLoading } = useProfileContext();
  const { user, logout, isLoggingOut } = useAuth();
  const createTagMutation = useCreateTag();
  const deleteCategoryMutation = useDeleteCategory();
  const createProfileMutation = useCreateProfile();
  const deleteProfileMutation = useDeleteProfile();
  const createDemoMutation = useCreateDemoProfile();
  const clearProfileDataMutation = useClearProfileData();
  const clearAllProfilesDataMutation = useClearAllProfilesData();
  const regenerateDemoMutation = useRegenerateDemoProfile();
  const importFromProfileMutation = useImportFromProfile();
  const updateUserMutation = useUpdateUser();
  const deleteAccountMutation = useDeleteAccount();
  
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newProfileName, setNewProfileName] = useState("");
  const [importFromProfileId, setImportFromProfileId] = useState<string>("");
  
  const [accountOpen, setAccountOpen] = useState(true);
  const [profilesOpen, setProfilesOpen] = useState(true);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  
  // User profile is managed by Supabase Auth

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;
    createTagMutation.mutate({ name: newTagName }, {
      onSuccess: () => setNewTagName("")
    });
  };

  const handleAddProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfileName.trim()) return;
    createProfileMutation.mutate({ name: newProfileName }, {
      onSuccess: (newProfile) => {
        setNewProfileName("");
        if (importFromProfileId && importFromProfileId !== "none") {
          importFromProfileMutation.mutate({
            targetProfileId: newProfile.id,
            sourceProfileId: Number(importFromProfileId)
          });
          setImportFromProfileId("");
        }
      }
    });
  };

  const handleDeleteProfile = (profileId: number) => {
    const profile = profiles?.find(p => p.id === profileId);
    if (!profile) return;
    
    deleteProfileMutation.mutate(profileId, {
      onSuccess: () => {
        if (currentProfile?.id === profileId) {
          const remainingProfiles = profiles?.filter(p => p.id !== profileId);
          if (remainingProfiles && remainingProfiles.length > 0) {
            setCurrentProfile(remainingProfiles[0]);
          }
        }
      }
    });
  };

  
  const hasDemoProfile = profiles?.some(p => p.isDemo) ?? false;

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold font-display tracking-tight">Settings</h2>
        <p className="text-muted-foreground mt-1">Configure your account and organization preferences.</p>
      </div>

      {/* Account Management */}
      <Collapsible open={accountOpen} onOpenChange={setAccountOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover-elevate">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5 text-primary" /> Account
                  </CardTitle>
                  <CardDescription>Manage your account settings and profile information.</CardDescription>
                </div>
                <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${accountOpen ? 'rotate-180' : ''}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-6">
              <div className="flex items-start gap-4">
                <Avatar className="w-16 h-16">
                  <AvatarFallback className="text-lg">
                    {user?.email?.[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium">{user?.email?.split("@")[0] || "User"}</p>
                  <p className="text-sm text-muted-foreground">{user?.email || "No email"}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "Unknown"}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t space-y-4">
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => logout()}
                    disabled={isLoggingOut}
                    data-testid="button-logout"
                  >
                    {isLoggingOut ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogOut className="w-4 h-4 mr-2" />}
                    Sign Out
                  </Button>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="text-sm font-medium text-destructive mb-2">Danger Zone</h4>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" data-testid="button-delete-account">
                        <Trash2 className="w-4 h-4 mr-2" />
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
                          {deleteAccountMutation.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : null}
                          Delete Account
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Profiles */}
      <Collapsible open={profilesOpen} onOpenChange={setProfilesOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover-elevate">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" /> Profiles
                  </CardTitle>
                  <CardDescription>
                    Organize your tasks into different contexts like Work, Personal, or Exercise.
                  </CardDescription>
                </div>
                <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${profilesOpen ? 'rotate-180' : ''}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-6">
              <form onSubmit={handleAddProfile} className="space-y-3 max-w-lg">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Label htmlFor="profile-name" className="sr-only">New Profile Name</Label>
                    <Input 
                      id="profile-name" 
                      placeholder="New profile name (e.g., Work, Exercise)..." 
                      value={newProfileName}
                      onChange={(e) => setNewProfileName(e.target.value)}
                      data-testid="input-profile-name"
                    />
                  </div>
                  <Button type="submit" disabled={createProfileMutation.isPending || importFromProfileMutation.isPending || !newProfileName.trim()} data-testid="button-create-profile">
                    {(createProfileMutation.isPending || importFromProfileMutation.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    <span className="ml-2 hidden sm:inline">Create</span>
                  </Button>
                </div>
                {profiles && profiles.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Copy className="w-4 h-4 text-muted-foreground" />
                    <Label htmlFor="import-from" className="text-sm text-muted-foreground whitespace-nowrap">Copy tasks from:</Label>
                    <Select value={importFromProfileId} onValueChange={setImportFromProfileId}>
                      <SelectTrigger className="w-[200px]" data-testid="select-import-profile">
                        <SelectValue placeholder="None (empty profile)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None (empty profile)</SelectItem>
                        {profiles.map(p => (
                          <SelectItem key={p.id} value={p.id.toString()}>
                            {p.name}{p.isDemo ? " (Demo)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </form>

              {!hasDemoProfile && (
                <Button 
                  variant="outline" 
                  onClick={() => createDemoMutation.mutate()}
                  disabled={createDemoMutation.isPending}
                  data-testid="button-create-demo-profile"
                >
                  {createDemoMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-2" />
                  )}
                  Try Demo Profile
                </Button>
              )}

              <div className="flex flex-wrap gap-2">
                {profilesLoading || profileContextLoading ? (
                  <span className="text-muted-foreground text-sm">Loading...</span>
                ) : profiles?.length === 0 ? (
                  <span className="text-muted-foreground text-sm italic">No profiles created yet.</span>
                ) : (
                  profiles?.map(profile => (
                    <div 
                      key={profile.id} 
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border flex items-center gap-2 group cursor-pointer transition-colors ${
                        currentProfile?.id === profile.id
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-secondary text-secondary-foreground border-border/50"
                      }`}
                      onClick={() => setCurrentProfile(profile)}
                      data-testid={`profile-item-${profile.id}`}
                    >
                      {currentProfile?.id === profile.id && (
                        <Check className="w-3 h-3" />
                      )}
                      <Users className="w-3 h-3" />
                      <span>{profile.name}</span>
                      {profile.isDemo && (
                        <Badge variant="secondary" className="text-xs">Demo</Badge>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground ml-1"
                            title="Clear profile data"
                            data-testid={`button-clear-profile-${profile.id}`}
                          >
                            <Eraser className="w-3 h-3" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                              <AlertTriangle className="w-5 h-5 text-destructive" />
                              Clear data in "{profile.name}"?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              This will delete all tasks, completions, categories, and tags in this profile. The profile itself will be kept. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => clearProfileDataMutation.mutate(profile.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              data-testid="button-confirm-clear-profile"
                            >
                              {clearProfileDataMutation.isPending && clearProfileDataMutation.variables === profile.id ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : null}
                              Clear Data
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      {(profile.isDemo || profiles.filter(p => !p.isDemo).length > 1) && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button
                              onClick={(e) => e.stopPropagation()}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive/80 ml-1"
                              title="Delete profile"
                              data-testid={`button-delete-profile-${profile.id}`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                            <AlertDialogHeader>
                              <AlertDialogTitle className="flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-destructive" />
                                Delete profile "{profile.name}"?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete this profile and all tasks, completions, categories, and tags associated with it. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteProfile(profile.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                data-testid="button-confirm-delete-profile"
                              >
                                {deleteProfileMutation.isPending && deleteProfileMutation.variables === profile.id ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : null}
                                Delete Profile
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  ))
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Click on a profile to switch to it. Each profile has its own tasks, categories, and tags.
              </p>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Categories */}
      <Collapsible open={categoriesOpen} onOpenChange={setCategoriesOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover-elevate">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Folder className="w-5 h-5 text-primary" /> Categories
                  </CardTitle>
                  <CardDescription>Group your tasks into logical areas.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={(e) => { e.stopPropagation(); setCatDialogOpen(true); }}
                    data-testid="button-add-category"
                  >
                    <Plus className="w-4 h-4 mr-2" /> Add
                  </Button>
                  <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${categoriesOpen ? 'rotate-180' : ''}`} />
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {catsLoading ? (
                  <span className="text-muted-foreground text-sm">Loading...</span>
                ) : categories?.length === 0 ? (
                  <span className="text-muted-foreground text-sm italic">No categories created yet.</span>
                ) : (
                  categories?.map(cat => (
                    <div key={cat.id} className="bg-secondary text-secondary-foreground px-3 py-1.5 rounded-lg text-sm font-medium border border-border/50 flex items-center gap-2 group">
                      <span>{cat.name}</span>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive/80 ml-1"
                            title="Delete category"
                          >
                            {deleteCategoryMutation.isPending && deleteCategoryMutation.variables === cat.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Trash2 className="w-3 h-3" />
                            )}
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                              <AlertTriangle className="w-5 h-5 text-destructive" />
                              Delete category "{cat.name}"?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Tasks using this category will become uncategorized. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteCategoryMutation.mutate(cat.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {deleteCategoryMutation.isPending && deleteCategoryMutation.variables === cat.id ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : null}
                              Delete Category
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Tags */}
      <Collapsible open={tagsOpen} onOpenChange={setTagsOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover-elevate">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TagIcon className="w-5 h-5 text-primary" /> Tags
                  </CardTitle>
                  <CardDescription>Labels for filtering tasks across categories.</CardDescription>
                </div>
                <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${tagsOpen ? 'rotate-180' : ''}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-6">
              <form onSubmit={handleAddTag} className="flex gap-3 max-w-md">
                <div className="flex-1">
                  <Label htmlFor="tag-name" className="sr-only">New Tag Name</Label>
                  <Input 
                    id="tag-name" 
                    placeholder="New tag name..." 
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    data-testid="input-tag-name"
                  />
                </div>
                <Button type="submit" disabled={createTagMutation.isPending || !newTagName.trim()} data-testid="button-create-tag">
                  {createTagMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </Button>
              </form>

              <div className="flex flex-wrap gap-2">
                {tagsLoading ? (
                   <span className="text-muted-foreground text-sm">Loading...</span>
                ) : tags?.length === 0 ? (
                  <span className="text-muted-foreground text-sm italic">No tags created yet.</span>
                ) : (
                  tags?.map(tag => (
                    <Badge key={tag.id} variant="secondary" className="px-3 py-1 text-sm font-normal">
                      {tag.name}
                    </Badge>
                  ))
                )}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Data Management */}
      <Collapsible open={dataOpen} onOpenChange={setDataOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover-elevate">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-primary" /> Data Management
                  </CardTitle>
                  <CardDescription>Manage your data. Choose to clear data for just the current profile or all profiles.</CardDescription>
                </div>
                <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${dataOpen ? 'rotate-180' : ''}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-6">
              {currentProfile?.isDemo && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Demo Profile</h4>
                  <p className="text-xs text-muted-foreground">
                    Regenerate fresh sample data in the demo profile.
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={() => regenerateDemoMutation.mutate(currentProfile.id)}
                    disabled={regenerateDemoMutation.isPending}
                    data-testid="button-regenerate-demo"
                  >
                    {regenerateDemoMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Regenerate Demo Data
                  </Button>
                </div>
              )}

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Current Profile</h4>
                <p className="text-xs text-muted-foreground">
                  Clear all data from the currently selected profile ({currentProfile?.name || "none"}).
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="text-destructive border-destructive/50 hover:bg-destructive/10"
                      disabled={!currentProfile}
                      data-testid="button-clear-profile-data"
                    >
                      <Eraser className="w-4 h-4 mr-2" />
                      Clear "{currentProfile?.name}" Data
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-destructive" />
                        Clear profile data?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete all tasks, completions, streaks, categories, and tags in the <strong>"{currentProfile?.name}"</strong> profile only. The profile itself will remain. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => currentProfile && clearProfileDataMutation.mutate(currentProfile.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        data-testid="button-confirm-clear-profile"
                      >
                        {clearProfileDataMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : null}
                        Clear Profile Data
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              <div className="space-y-2 pt-4 border-t">
                <h4 className="text-sm font-medium text-destructive">All Profiles</h4>
                <p className="text-xs text-muted-foreground">
                  Clear all data from all profiles. This is a destructive action.
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" data-testid="button-clear-all-data">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Clear All Profiles Data
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-destructive" />
                        Clear ALL profiles data?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete <strong>ALL</strong> your tasks, completions, streaks, categories, and tags across <strong>every profile</strong>. Your profiles will remain but will be empty. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => clearAllProfilesDataMutation.mutate()}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        data-testid="button-confirm-clear-all"
                      >
                        {clearAllProfilesDataMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : null}
                        Yes, delete all data
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <CreateCategoryDialog open={catDialogOpen} onOpenChange={setCatDialogOpen} />
    </div>
  );
}
