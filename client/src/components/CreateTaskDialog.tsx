import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateTask } from "@/hooks/use-tasks";
import { insertTaskSchema, InsertTask } from "@shared/schema";
import { z } from "zod";
import { useCategories, useCreateCategory } from "@/hooks/use-categories";
import { useTags } from "@/hooks/use-tags";
import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Badge } from "./ui/badge";

// Extend schema for form
const formSchema = insertTaskSchema.extend({
  intervalValue: z.coerce.number().min(1, "Interval must be at least 1"),
  categoryId: z.coerce.number().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema> & { tagIds: number[]; newCategoryName?: string };

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTaskDialog({ open, onOpenChange }: CreateTaskDialogProps) {
  const createMutation = useCreateTask();
  const createCategoryMutation = useCreateCategory();
  const { data: categories } = useCategories();
  const { data: tags } = useTags();
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const { register, handleSubmit, formState: { errors }, reset, watch } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      intervalValue: 1,
      intervalUnit: 'days',
      categoryId: null,
      tagIds: []
    }
  });

  const onSubmit = (data: FormValues) => {
    createMutation.mutate({
      title: data.title,
      intervalValue: data.intervalValue,
      intervalUnit: data.intervalUnit,
      categoryId: data.categoryId || undefined,
      tagIds: selectedTagIds
    }, {
      onSuccess: () => {
        onOpenChange(false);
        reset({
          intervalValue: 1,
          intervalUnit: 'days',
          categoryId: null,
          tagIds: []
        });
        setSelectedTagIds([]);
        setShowNewCategoryInput(false);
        setNewCategoryName("");
      }
    });
  };

  const handleCreateNewCategory = () => {
    if (!newCategoryName.trim()) return;
    createCategoryMutation.mutate(
      { name: newCategoryName },
      {
        onSuccess: () => {
          setNewCategoryName("");
          setShowNewCategoryInput(false);
        }
      }
    );
  };

  const toggleTag = (id: number) => {
    setSelectedTagIds(prev => 
      prev.includes(id) ? prev.filter(tid => tid !== id) : [...prev, id]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>
            Add a new maintenance task to track.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Task Title</Label>
            <Input id="title" placeholder="e.g., Replace Air Filter" {...register("title")} />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="intervalValue">Frequency Value</Label>
              <Input type="number" id="intervalValue" min="1" {...register("intervalValue")} />
              {errors.intervalValue && <p className="text-sm text-destructive">{errors.intervalValue.message}</p>}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="intervalUnit">Unit</Label>
              <select 
                id="intervalUnit"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                {...register("intervalUnit")}
              >
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
                <option value="months">Months</option>
                <option value="years">Years</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="category">Category</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={() => setShowNewCategoryInput(!showNewCategoryInput)}
              >
                <Plus className="w-3 h-3 mr-1" /> New
              </Button>
            </div>
            {showNewCategoryInput ? (
              <div className="flex gap-2">
                <Input
                  placeholder="Category name..."
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateNewCategory();
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCreateNewCategory}
                  disabled={createCategoryMutation.isPending || !newCategoryName.trim()}
                >
                  {createCategoryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                </Button>
              </div>
            ) : (
              <select 
                id="category"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register("categoryId")}
              >
                <option value="">Select a category...</option>
                {categories?.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2 pt-2">
              {tags?.map(tag => (
                <Badge
                  key={tag.id}
                  variant={selectedTagIds.includes(tag.id) ? "default" : "outline"}
                  className="cursor-pointer select-none hover:bg-primary/20"
                  onClick={() => toggleTag(tag.id)}
                >
                  {tag.name}
                </Badge>
              ))}
              {tags?.length === 0 && <span className="text-sm text-muted-foreground">No tags available. Create some in Settings.</span>}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
