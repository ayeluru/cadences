import { useCategories, useDeleteCategory } from "@/hooks/use-categories";
import { useTags, useCreateTag } from "@/hooks/use-tags";
import { useRoutines, useCreateRoutine, useDeleteRoutine } from "@/hooks/use-routines";
import { useProfiles, useCreateProfile, useDeleteProfile, useCreateDemoProfile, useClearProfileData } from "@/hooks/use-profiles";
import { useProfileContext } from "@/contexts/ProfileContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Tag as TagIcon, Folder, Trash2, Database, RefreshCw, AlertTriangle, Repeat, Users, Sparkles, Check, Eraser } from "lucide-react";
import { useState } from "react";
import { CreateCategoryDialog } from "@/components/CreateCategoryDialog";
import { Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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

export default function Settings() {
  const { data: categories, isLoading: catsLoading } = useCategories();
  const { data: tags, isLoading: tagsLoading } = useTags();
  const { data: routines, isLoading: routinesLoading } = useRoutines();
  const { data: profiles, isLoading: profilesLoading } = useProfiles();
  const { currentProfile, setCurrentProfile, isLoading: profileContextLoading } = useProfileContext();
  const createTagMutation = useCreateTag();
  const createRoutineMutation = useCreateRoutine();
  const deleteCategoryMutation = useDeleteCategory();
  const deleteRoutineMutation = useDeleteRoutine();
  const createProfileMutation = useCreateProfile();
  const deleteProfileMutation = useDeleteProfile();
  const createDemoMutation = useCreateDemoProfile();
  const clearProfileDataMutation = useClearProfileData();
  const { toast } = useToast();
  
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newRoutineName, setNewRoutineName] = useState("");
  const [newProfileName, setNewProfileName] = useState("");

  const clearDataMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/clear-data");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      queryClient.invalidateQueries({ queryKey: ["/api/routines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/streaks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/enhanced"] });
      queryClient.invalidateQueries({ queryKey: ["/api/completions"] });
      toast({ title: "Data cleared", description: "All your data has been removed." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;
    createTagMutation.mutate({ name: newTagName }, {
      onSuccess: () => setNewTagName("")
    });
  };

  const handleAddRoutine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoutineName.trim()) return;
    createRoutineMutation.mutate({ name: newRoutineName }, {
      onSuccess: () => setNewRoutineName("")
    });
  };

  const handleAddProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfileName.trim()) return;
    createProfileMutation.mutate({ name: newProfileName }, {
      onSuccess: () => setNewProfileName("")
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
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold font-display tracking-tight">Settings</h2>
        <p className="text-muted-foreground mt-1">Configure your organization preferences.</p>
      </div>

      {/* Profiles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> Profiles
          </CardTitle>
          <CardDescription>
            Organize your tasks into different contexts like Work, Personal, or Exercise.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleAddProfile} className="flex gap-3 max-w-md">
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
            <Button type="submit" disabled={createProfileMutation.isPending || !newProfileName.trim()} data-testid="button-create-profile">
              {createProfileMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span className="ml-2 hidden sm:inline">Create</span>
            </Button>
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
                          This will delete all tasks, completions, categories, tags, and routines in this profile. The profile itself will be kept. This action cannot be undone.
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
                  {!profile.isDemo && profiles.length > 1 && (
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
                            This will permanently delete this profile and all tasks, completions, categories, tags, and routines associated with it. This action cannot be undone.
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
            Click on a profile to switch to it. Each profile has its own tasks, categories, tags, and routines.
          </p>
        </CardContent>
      </Card>

      {/* Categories */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Folder className="w-5 h-5 text-primary" /> Categories
            </CardTitle>
            <CardDescription>Group your tasks into logical areas.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setCatDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Add Category
          </Button>
        </CardHeader>
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
                  <button
                    onClick={() => deleteCategoryMutation.mutate(cat.id)}
                    disabled={deleteCategoryMutation.isPending}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive/80 ml-1"
                    title="Delete category"
                  >
                    {deleteCategoryMutation.isPending && deleteCategoryMutation.variables === cat.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tags */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TagIcon className="w-5 h-5 text-primary" /> Tags
          </CardTitle>
          <CardDescription>Labels for filtering tasks across categories.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleAddTag} className="flex gap-3 max-w-md">
            <div className="flex-1">
              <Label htmlFor="tag-name" className="sr-only">New Tag Name</Label>
              <Input 
                id="tag-name" 
                placeholder="New tag name..." 
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={createTagMutation.isPending || !newTagName.trim()}>
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
      </Card>

      {/* Routines */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Repeat className="w-5 h-5 text-primary" /> Routines
          </CardTitle>
          <CardDescription>Group related tasks that you typically do together.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleAddRoutine} className="flex gap-3 max-w-md">
            <div className="flex-1">
              <Label htmlFor="routine-name" className="sr-only">New Routine Name</Label>
              <Input 
                id="routine-name" 
                placeholder="New routine name (e.g., Morning Routine)..." 
                value={newRoutineName}
                onChange={(e) => setNewRoutineName(e.target.value)}
                data-testid="input-routine-name"
              />
            </div>
            <Button type="submit" disabled={createRoutineMutation.isPending || !newRoutineName.trim()} data-testid="button-create-routine">
              {createRoutineMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span className="ml-2 hidden sm:inline">Create</span>
            </Button>
          </form>

          <div className="flex flex-wrap gap-2">
            {routinesLoading ? (
               <span className="text-muted-foreground text-sm">Loading...</span>
            ) : routines?.length === 0 ? (
              <span className="text-muted-foreground text-sm italic">No routines created yet. Create one to group related tasks.</span>
            ) : (
              routines?.map(routine => (
                <div key={routine.id} className="bg-secondary text-secondary-foreground px-3 py-1.5 rounded-lg text-sm font-medium border border-border/50 flex items-center gap-2 group">
                  <Repeat className="w-3 h-3 text-muted-foreground" />
                  <span>{routine.name}</span>
                  <button
                    onClick={() => deleteRoutineMutation.mutate(routine.id)}
                    disabled={deleteRoutineMutation.isPending}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive/80 ml-1"
                    title="Delete routine"
                    data-testid={`button-delete-routine-${routine.id}`}
                  >
                    {deleteRoutineMutation.isPending && deleteRoutineMutation.variables === routine.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" /> Data Management
          </CardTitle>
          <CardDescription>Manage your account data.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" data-testid="button-clear-data">
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All Data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                  Clear all data?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all your tasks, completions, streaks, categories, tags, and routines across all profiles. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => clearDataMutation.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  data-testid="button-confirm-clear"
                >
                  {clearDataMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  Yes, delete everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      <CreateCategoryDialog open={catDialogOpen} onOpenChange={setCatDialogOpen} />
    </div>
  );
}
