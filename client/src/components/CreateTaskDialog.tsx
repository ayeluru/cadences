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
import { useCategories } from "@/hooks/use-categories";
import { useTags } from "@/hooks/use-tags";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "./ui/badge";

// Extend schema for form
const formSchema = insertTaskSchema.extend({
  intervalValue: z.coerce.number().min(1, "Interval must be at least 1"),
  categoryId: z.coerce.number().optional(),
});

type FormValues = z.infer<typeof formSchema> & { tagIds: number[] };

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTaskDialog({ open, onOpenChange }: CreateTaskDialogProps) {
  const createMutation = useCreateTask();
  const { data: categories } = useCategories();
  const { data: tags } = useTags();
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      intervalValue: 1,
      intervalUnit: 'months',
      tagIds: []
    }
  });

  const onSubmit = (data: FormValues) => {
    createMutation.mutate({
      ...data,
      tagIds: selectedTagIds
    }, {
      onSuccess: () => {
        onOpenChange(false);
        reset();
        setSelectedTagIds([]);
      }
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
              <Select defaultValue="months" onValueChange={(val) => {
                 const elem = document.getElementById("intervalUnit") as HTMLInputElement; // Virtual input handling
                 // React Hook Form integration with Radix Select requires using Controller or manual setValue usually, 
                 // but for simplicity in this generated code we'll rely on the default values or basic prop drilling if needed.
                 // A proper way is using the `Controller` from `react-hook-form`.
                 // Let's register a hidden input to make it work simply without Controller bloat
                 const hiddenInput = document.createElement("input");
                 hiddenInput.type = "hidden";
                 hiddenInput.name = "intervalUnit";
                 hiddenInput.value = val;
                 // Ideally use setValue from useForm, but we need to pass control.
                 // Let's assume user accepts default "months" or we wire it up properly:
              }}>
                {/* Simplified for generated code: Using native select for robustness if needed, or proper Radix integration */}
                {/* Switching to native select for reliability in generated code without extra Controller boilerplate */}
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  {...register("intervalUnit")}
                >
                  <option value="days">Days</option>
                  <option value="weeks">Weeks</option>
                  <option value="months">Months</option>
                  <option value="years">Years</option>
                </select>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
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
