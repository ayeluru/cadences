import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateRoutine } from "@/hooks/use-routines";
import { useProfileContext } from "@/contexts/ProfileContext";
import { Loader2 } from "lucide-react";

interface CreateRoutineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateRoutineDialog({ open, onOpenChange }: CreateRoutineDialogProps) {
  const { currentProfile } = useProfileContext();
  const createRoutine = useCreateRoutine();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [intervalValue, setIntervalValue] = useState("1");
  const [intervalUnit, setIntervalUnit] = useState("days");

  const resetForm = () => {
    setName("");
    setDescription("");
    setIntervalValue("1");
    setIntervalUnit("days");
  };

  const handleSubmit = async () => {
    if (!name.trim() || !currentProfile) return;

    try {
      await createRoutine.mutateAsync({
        name: name.trim(),
        description: description.trim() || null,
        profileId: currentProfile.id,
        intervalValue: parseInt(intervalValue) || 1,
        intervalUnit,
      });

      resetForm();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create routine:", error);
    }
  };

  const isSubmitting = createRoutine.isPending;
  const canSubmit = name.trim() && currentProfile && !isSubmitting;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Routine</DialogTitle>
          <DialogDescription>
            Create a routine to group tasks together. You can add tasks after creating it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="routine-name">Name</Label>
            <Input
              id="routine-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Morning Routine"
              data-testid="input-routine-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="routine-description">Description (optional)</Label>
            <Textarea
              id="routine-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this routine for?"
              className="resize-none"
              rows={2}
              data-testid="input-routine-description"
            />
          </div>

          <div className="space-y-2">
            <Label>How often do you do this routine?</Label>
            <div className="flex gap-2">
              <span className="text-sm text-muted-foreground self-center">Every</span>
              <Input
                type="number"
                min="1"
                value={intervalValue}
                onChange={(e) => setIntervalValue(e.target.value)}
                className="w-16"
                data-testid="input-routine-interval-value"
              />
              <Select value={intervalUnit} onValueChange={setIntervalUnit}>
                <SelectTrigger className="flex-1" data-testid="select-routine-interval-unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="days">day(s)</SelectItem>
                  <SelectItem value="weeks">week(s)</SelectItem>
                  <SelectItem value="months">month(s)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} data-testid="button-create-routine">
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create Routine
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
