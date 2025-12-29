import { useCategories, useDeleteCategory } from "@/hooks/use-categories";
import { useTags, useCreateTag } from "@/hooks/use-tags";
import { useRoutines, useCreateRoutine, useDeleteRoutine } from "@/hooks/use-routines";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Tag as TagIcon, Folder, Trash2, Database, RefreshCw, AlertTriangle, Repeat } from "lucide-react";
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
  const createTagMutation = useCreateTag();
  const createRoutineMutation = useCreateRoutine();
  const deleteCategoryMutation = useDeleteCategory();
  const deleteRoutineMutation = useDeleteRoutine();
  const { toast } = useToast();
  
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newRoutineName, setNewRoutineName] = useState("");

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

  const seedDataMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/seed");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      queryClient.invalidateQueries({ queryKey: ["/api/routines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/streaks"] });
      toast({ title: "Sample data loaded", description: data.message });
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

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold font-display tracking-tight">Manage</h2>
        <p className="text-muted-foreground mt-1">Configure your organization preferences.</p>
      </div>

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

      {/* Developer Tools - Seed Data */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" /> Sample Data
          </CardTitle>
          <CardDescription>Load sample tasks with 90+ days of history to test the app features.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button 
              onClick={() => seedDataMutation.mutate()}
              disabled={seedDataMutation.isPending}
              data-testid="button-seed-data"
            >
              {seedDataMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Load Sample Data
            </Button>

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
                    This will permanently delete all your tasks, completions, streaks, categories, tags, and routines. This action cannot be undone.
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
          </div>
          <p className="text-sm text-muted-foreground">
            Sample data includes daily/weekly/monthly/yearly tasks, exercise routines with variations, 
            custom metrics for tracking progress, and varied completion patterns showing different streak lengths.
          </p>
        </CardContent>
      </Card>

      <CreateCategoryDialog open={catDialogOpen} onOpenChange={setCatDialogOpen} />
    </div>
  );
}
