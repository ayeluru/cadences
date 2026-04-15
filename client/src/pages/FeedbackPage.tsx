import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useFeedbackList, useCreateFeedback, useToggleVote, useUpdateFeedback, type FeedbackWithCounts } from "@/hooks/use-feedback";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Plus, ThumbsUp, MessageSquare, Bug, Lightbulb, MessageCircle, Loader2, Eye, EyeOff, Ghost, User, Info, Filter, X } from "lucide-react";

const typeConfig = {
  bug: { label: "Bug", icon: Bug, color: "text-red-500" },
  feature_request: { label: "Feature", icon: Lightbulb, color: "text-blue-500" },
  feedback: { label: "Feedback", icon: MessageCircle, color: "text-green-500" },
};

const statusConfig: Record<string, { label: string; dotColor: string }> = {
  new: { label: "New", dotColor: "bg-gray-400" },
  under_review: { label: "Under Review", dotColor: "bg-yellow-500" },
  planned: { label: "Planned", dotColor: "bg-blue-500" },
  in_progress: { label: "In Progress", dotColor: "bg-purple-500" },
  done: { label: "Done", dotColor: "bg-green-500" },
  declined: { label: "Declined", dotColor: "bg-red-500" },
};

function FeedbackCard({ item, isAdmin, currentUserId }: { item: FeedbackWithCounts; isAdmin: boolean; currentUserId: string }) {
  const toggleVote = useToggleVote();
  const updateFeedback = useUpdateFeedback();
  const isOwner = item.userId === currentUserId;
  const type = typeConfig[item.type as keyof typeof typeConfig];
  const status = statusConfig[item.status];
  const TypeIcon = type?.icon ?? MessageCircle;

  return (
    <Link href={`/feedback/${item.id}`} className="block group">
      <div className="flex items-stretch gap-0 rounded-xl border bg-card hover:border-primary/40 hover:shadow-sm transition-all">
        {/* Vote column */}
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleVote.mutate(item.id); }}
          className={`flex flex-col items-center justify-center gap-0.5 px-4 border-r transition-colors shrink-0 rounded-l-xl ${
            item.hasVoted
              ? "bg-primary/5 text-primary border-primary/20"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <ThumbsUp className={`w-4 h-4 ${item.hasVoted ? "fill-current" : ""}`} />
          <span className="text-xs font-bold tabular-nums">{item.voteCount}</span>
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0 p-3.5 pr-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold text-sm text-foreground leading-snug group-hover:text-primary transition-colors truncate">
                {item.title}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.description}</p>
            </div>
            {isAdmin && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); updateFeedback.mutate({ id: item.id, isPublic: !item.isPublic }); }}
                className="text-muted-foreground/50 hover:text-foreground transition-colors shrink-0 mt-0.5"
                title={item.isPublic ? "Make private" : "Make public"}
              >
                {item.isPublic ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 mt-2.5 text-xs">
            <span className={`flex items-center gap-1 ${type?.color ?? "text-muted-foreground"}`}>
              <TypeIcon className="w-3 h-3" />
              {type?.label}
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className={`w-1.5 h-1.5 rounded-full ${status?.dotColor}`} />
              {status?.label}
            </span>
            {isOwner && <span className="text-primary font-medium">You</span>}
            {item.displayName && item.displayName !== 'You' && (
              <span className="text-muted-foreground/70" title={(item as any).submitterEmail}>
                {item.displayName}
              </span>
            )}
            <span className="flex items-center gap-1 text-muted-foreground/60 ml-auto">
              <MessageSquare className="w-3 h-3" />
              {item.commentCount}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function SubmitFeedbackDialog() {
  const [open, setOpen] = useState(false);
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
      setOpen(false);
      setType("feature_request");
      setTitle("");
      setDescription("");
      setIsAnonymous(false);
    } catch {
      toast({ title: "Error", description: "Failed to submit feedback", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-1.5" />
          New
        </Button>
      </DialogTrigger>
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

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <MessageSquare className="w-10 h-10 mb-3 opacity-20" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

function FilterBar({ statusFilter, setStatusFilter, visibilityFilter, setVisibilityFilter, isAdmin }: {
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  visibilityFilter: string;
  setVisibilityFilter: (v: string) => void;
  isAdmin: boolean;
}) {
  const hasFilters = statusFilter !== "all" || visibilityFilter !== "all";

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Filter className="w-3.5 h-3.5 text-muted-foreground" />
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="h-7 w-auto min-w-[100px] text-xs gap-1">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" className="text-xs">All statuses</SelectItem>
          {Object.entries(statusConfig).map(([key, { label, dotColor }]) => (
            <SelectItem key={key} value={key} className="text-xs">
              <span className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                {label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isAdmin && (
        <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
          <SelectTrigger className="h-7 w-auto min-w-[100px] text-xs gap-1">
            <SelectValue placeholder="Visibility" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All visibility</SelectItem>
            <SelectItem value="public" className="text-xs">
              <span className="flex items-center gap-1.5"><Eye className="w-3 h-3" /> Public</span>
            </SelectItem>
            <SelectItem value="private" className="text-xs">
              <span className="flex items-center gap-1.5"><EyeOff className="w-3 h-3" /> Private</span>
            </SelectItem>
          </SelectContent>
        </Select>
      )}
      {hasFilters && (
        <button
          onClick={() => { setStatusFilter("all"); setVisibilityFilter("all"); }}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-3 h-3" /> Clear
        </button>
      )}
    </div>
  );
}

export default function FeedbackPage() {
  const { user, isAdmin } = useAuth();
  const { data: items, isLoading } = useFeedbackList();
  const userId = user?.id ?? "";
  const [statusFilter, setStatusFilter] = useState("all");
  const [visibilityFilter, setVisibilityFilter] = useState("all");

  const applyFilters = (list: FeedbackWithCounts[]) => {
    let filtered = list;
    if (statusFilter !== "all") {
      filtered = filtered.filter(i => i.status === statusFilter);
    }
    if (visibilityFilter === "public") {
      filtered = filtered.filter(i => i.isPublic);
    } else if (visibilityFilter === "private") {
      filtered = filtered.filter(i => !i.isPublic);
    }
    return filtered;
  };

  const allItems = items ?? [];
  const publicItems = allItems.filter(i => i.isPublic);
  const myItems = allItems.filter(i => i.userId === userId);
  const unreviewedItems = allItems.filter(i => i.status === "new" && !i.isPublic);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Feedback</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Share ideas, report bugs, or vote on what matters</p>
        </div>
        <SubmitFeedbackDialog />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs defaultValue={isAdmin && unreviewedItems.length > 0 ? "unreviewed" : "public"} className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <TabsList>
              <TabsTrigger value="public">Public ({publicItems.length})</TabsTrigger>
              <TabsTrigger value="mine">Mine ({myItems.length})</TabsTrigger>
              {isAdmin && (
                <TabsTrigger value="unreviewed" className="relative">
                  Needs Review
                  {unreviewedItems.length > 0 && (
                    <span className="ml-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                      {unreviewedItems.length}
                    </span>
                  )}
                </TabsTrigger>
              )}
              {isAdmin && <TabsTrigger value="all">All ({allItems.length})</TabsTrigger>}
            </TabsList>
            <FilterBar
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              visibilityFilter={visibilityFilter}
              setVisibilityFilter={setVisibilityFilter}
              isAdmin={isAdmin}
            />
          </div>

          <TabsContent value="public" className="space-y-2">
            {(() => {
              const filtered = applyFilters(publicItems);
              return filtered.length === 0
                ? <EmptyState message="No public submissions match your filters" />
                : filtered.map(item => <FeedbackCard key={item.id} item={item} isAdmin={isAdmin} currentUserId={userId} />);
            })()}
          </TabsContent>

          <TabsContent value="mine" className="space-y-2">
            {(() => {
              const filtered = applyFilters(myItems);
              return filtered.length === 0
                ? <EmptyState message="No submissions match your filters" />
                : filtered.map(item => <FeedbackCard key={item.id} item={item} isAdmin={isAdmin} currentUserId={userId} />);
            })()}
          </TabsContent>

          {isAdmin && (
            <TabsContent value="unreviewed" className="space-y-2">
              {unreviewedItems.length === 0
                ? <EmptyState message="All submissions have been reviewed" />
                : unreviewedItems.map(item => <FeedbackCard key={item.id} item={item} isAdmin={isAdmin} currentUserId={userId} />)
              }
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="all" className="space-y-2">
              {(() => {
                const filtered = applyFilters(allItems);
                return filtered.length === 0
                  ? <EmptyState message="No submissions match your filters" />
                  : filtered.map(item => <FeedbackCard key={item.id} item={item} isAdmin={isAdmin} currentUserId={userId} />);
              })()}
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}
