import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useCreateFeedback } from "@/hooks/use-feedback";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Ghost, User, Info } from "lucide-react";

interface SubmitFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SubmitFeedbackDialog({ open, onOpenChange }: SubmitFeedbackDialogProps) {
  const [type, setType] = useState("feature_request");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const createFeedback = useCreateFeedback();
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) return;
    try {
      await createFeedback.mutateAsync({ type, title: title.trim(), description: description.trim(), isAnonymous });
      toast({ title: "Feedback submitted", description: "It will appear on the public board once reviewed by an admin." });
      onOpenChange(false);
      setType("feature_request");
      setTitle("");
      setDescription("");
      setIsAnonymous(false);
    } catch {
      toast({ title: "Error", description: "Failed to submit feedback", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Submit Feedback</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="feature_request">Feature Request</SelectItem>
                <SelectItem value="bug">Bug Report</SelectItem>
                <SelectItem value="feedback">General Feedback</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Brief summary..." maxLength={200} />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe in detail..." rows={4} />
          </div>
          <div className="space-y-3 rounded-lg border border-border p-3">
            <button
              type="button"
              onClick={() => setIsAnonymous(!isAnonymous)}
              className={`flex items-center gap-3 w-full rounded-lg border p-3 text-left transition-all ${
                isAnonymous
                  ? "bg-primary/10 border-primary/30"
                  : "bg-muted/30 border-border hover:border-foreground/30"
              }`}
            >
              <div className={`flex items-center justify-center w-9 h-9 rounded-full shrink-0 transition-colors ${
                isAnonymous ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
              }`}>
                {isAnonymous ? <Ghost className="w-5 h-5" /> : <User className="w-5 h-5" />}
              </div>
              <div className="space-y-0.5">
                <p className={`text-sm font-medium ${isAnonymous ? "text-primary" : "text-foreground"}`}>
                  {isAnonymous ? "Submitting anonymously" : "Submit with your name"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isAnonymous
                    ? "If this is made public, others will see a random alias instead of your name. Admins can always see your identity."
                    : "If this is made public, your name will be visible to other users."}
                </p>
              </div>
            </button>
            <div className="flex items-start gap-2 text-xs text-muted-foreground px-1">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>All submissions start as <span className="font-medium text-foreground">private</span> — only you and admins can see them. An admin may choose to make your submission public on the board, where others can then upvote and comment on it.</span>
            </div>
          </div>
          <Button onClick={handleSubmit} disabled={!title.trim() || !description.trim() || createFeedback.isPending} className="w-full">
            {createFeedback.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Submit
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
