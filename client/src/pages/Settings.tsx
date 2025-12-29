import { useCategories, useDeleteCategory } from "@/hooks/use-categories";
import { useTags, useCreateTag } from "@/hooks/use-tags";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Tag as TagIcon, Folder, Trash2 } from "lucide-react";
import { useState } from "react";
import { CreateCategoryDialog } from "@/components/CreateCategoryDialog";
import { Loader2 } from "lucide-react";

export default function Settings() {
  const { data: categories, isLoading: catsLoading } = useCategories();
  const { data: tags, isLoading: tagsLoading } = useTags();
  const createTagMutation = useCreateTag();
  const deleteCategoryMutation = useDeleteCategory();
  
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;
    createTagMutation.mutate({ name: newTagName }, {
      onSuccess: () => setNewTagName("")
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

      <CreateCategoryDialog open={catDialogOpen} onOpenChange={setCatDialogOpen} />
    </div>
  );
}
