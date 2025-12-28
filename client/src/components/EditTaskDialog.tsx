import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useUpdateTask } from "@/hooks/use-tasks";
import { insertTaskSchema, TaskWithDetails } from "@shared/schema";
import { z } from "zod";
import { useCategories } from "@/hooks/use-categories";
import { useTags } from "@/hooks/use-tags";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "./ui/badge";

const formSchema = insertTaskSchema.partial().extend({
  intervalValue: z.coerce.number().min(1, "Interval must be at least 1").optional(),
  categoryId: z.coerce.number().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema> & { tagIds: number[] };

interface EditTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TaskWithDetails;
}

export function EditTaskDialog({ open, onOpenChange, task }: EditTaskDialogProps) {
  const updateMutation = useUpdateTask();
  const { data: categories } = useCategories();
  const { data: tags } = useTags();
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: task.title,
      intervalValue: task.intervalValue,
      intervalUnit: task.intervalUnit as any,
      categoryId: task.categoryId,
    }
  });

  // Sync state when task changes
  useEffect(() => {
    if (task) {
      reset({
        title: task.title,
        intervalValue: task.intervalValue,
        intervalUnit: task.intervalUnit as any,
        categoryId: task.categoryId,
      });
      setSelectedTagIds(task.tags?.map(t => t.id) || []);
    }
  }, [task, reset]);

  const onSubmit = (data: FormValues) => {
    updateMutation.mutate({
      id: task.id,
      ...data,
      tagIds: selectedTagIds
    }, {
      onSuccess: () => onOpenChange(false)
    });
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
          <DialogTitle>Edit Task</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-title">Task Title</Label>
            <Input id="edit-title" {...register("title")} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-intervalValue">Frequency Value</Label>
              <Input type="number" id="edit-intervalValue" min="1" {...register("intervalValue")} />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-intervalUnit">Unit</Label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            <Label htmlFor="edit-category">Category</Label>
            <select 
              id="edit-category"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...register("categoryId")}
            >
              <option value="">Select a category...</option>
              {categories?.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
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
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
