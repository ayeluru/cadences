import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useFeedbackDetail, useFeedbackComments, useToggleVote, useUpdateFeedback, useDeleteFeedback, useCreateComment, useDeleteComment, useToggleOfficialResponse } from "@/hooks/use-feedback";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useParams, useLocation } from "wouter";
import { ThumbsUp, ArrowLeft, Bug, Lightbulb, MessageCircle, Loader2, Trash2, Send, EyeOff, Ghost, User, Shield, Pin, PinOff } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const typeConfig: Record<string, { label: string; icon: any; color: string }> = {
  bug: { label: "Bug Report", icon: Bug, color: "text-red-500" },
  feature_request: { label: "Feature Request", icon: Lightbulb, color: "text-blue-500" },
  feedback: { label: "General Feedback", icon: MessageCircle, color: "text-green-500" },
};

const statusConfig: Record<string, { label: string; dotColor: string }> = {
  new: { label: "New", dotColor: "bg-gray-400" },
  under_review: { label: "Under Review", dotColor: "bg-yellow-500" },
  planned: { label: "Planned", dotColor: "bg-blue-500" },
  in_progress: { label: "In Progress", dotColor: "bg-purple-500" },
  done: { label: "Done", dotColor: "bg-green-500" },
  declined: { label: "Declined", dotColor: "bg-red-500" },
};

export default function FeedbackDetailPage() {
  const params = useParams<{ id: string }>();
  const feedbackId = parseInt(params.id, 10);
  const [, navigate] = useLocation();
  const { user, isAdmin } = useAuth();
  const userId = user?.id ?? "";
  const { toast } = useToast();

  const { data: feedback, isLoading } = useFeedbackDetail(feedbackId);
  const { data: comments } = useFeedbackComments(feedbackId);
  const toggleVote = useToggleVote();
  const updateFeedback = useUpdateFeedback();
  const deleteFeedback = useDeleteFeedback();
  const createComment = useCreateComment();
  const deleteComment = useDeleteComment();
  const toggleOfficialResponse = useToggleOfficialResponse();

  const [commentText, setCommentText] = useState("");
  const [commentAnonymous, setCommentAnonymous] = useState(false);
  const [markOfficial, setMarkOfficial] = useState(false);

  if (isLoading || !feedback) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isOwner = feedback.userId === userId;
  const type = typeConfig[feedback.type] ?? typeConfig.feedback;
  const status = statusConfig[feedback.status] ?? statusConfig.new;
  const TypeIcon = type.icon;
  const fb = feedback as any;

  const handleDelete = async () => {
    try {
      await deleteFeedback.mutateAsync(feedbackId);
      toast({ title: "Deleted", description: "Feedback submission deleted" });
      navigate("/feedback");
    } catch {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    }
  };

  const handleComment = async () => {
    if (!commentText.trim()) return;
    try {
      await createComment.mutateAsync({ feedbackId, content: commentText.trim(), isAnonymous: commentAnonymous, isOfficialResponse: markOfficial });
      setCommentText("");
      setMarkOfficial(false);
    } catch {
      toast({ title: "Error", description: "Failed to post comment", variant: "destructive" });
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Back nav */}
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate("/feedback")}>
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <h1 className="text-xl font-bold leading-tight">{feedback.title}</h1>
          <div className="flex items-center gap-3 text-xs flex-wrap">
            <span className={`flex items-center gap-1 font-medium ${type.color}`}>
              <TypeIcon className="w-3.5 h-3.5" />
              {type.label}
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className={`w-1.5 h-1.5 rounded-full ${status.dotColor}`} />
              {status.label}
            </span>
            {fb.displayName && (
              <span className="text-muted-foreground">
                {fb.displayName}
                {feedback.isAnonymous && <EyeOff className="w-3 h-3 inline ml-1 opacity-40" />}
              </span>
            )}
            {feedback.createdAt && (
              <span className="text-muted-foreground/60">
                {formatDistanceToNow(new Date(feedback.createdAt), { addSuffix: true })}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => toggleVote.mutate(feedbackId)}
          className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg border transition-all shrink-0 ${
            fb.hasVoted
              ? "bg-primary/10 border-primary/30 text-primary"
              : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
          }`}
        >
          <ThumbsUp className={`w-4 h-4 ${fb.hasVoted ? "fill-current" : ""}`} />
          <span className="text-xs font-bold tabular-nums">{feedback.voteCount}</span>
        </button>
      </div>

      {/* Description */}
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{feedback.description}</p>
        </CardContent>
      </Card>

      {/* Official response (pinned comment, visible to everyone) */}
      {(() => {
        const official: any = comments?.find((c: any) => c.isOfficialResponse);
        if (!official) return null;
        return (
          <Card className="border-primary/20 bg-primary/[0.04]">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary">Official Response</span>
                <span className="text-xs text-muted-foreground">— {official.displayName}</span>
                {official.createdAt && (
                  <span className="text-[10px] text-muted-foreground/50">
                    {formatDistanceToNow(new Date(official.createdAt), { addSuffix: true })}
                  </span>
                )}
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap">{official.content}</p>
            </CardContent>
          </Card>
        );
      })()}

      {/* Admin controls */}
      {isAdmin && (
        <Card className="border-dashed">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Shield className="w-3.5 h-3.5" />
              Admin
            </div>

            {/* Submitter info */}
            {fb.displayName && (
              <p className="text-xs text-muted-foreground">
                Submitted by <span className="font-medium text-foreground">{fb.displayName}</span>
                {fb.submitterEmail && <span className="opacity-60"> ({fb.submitterEmail})</span>}
                {feedback.isAnonymous && <EyeOff className="w-3 h-3 inline ml-1 opacity-40" />}
              </p>
            )}

            {/* Status + visibility */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select
                  value={feedback.status}
                  onValueChange={(value) => updateFeedback.mutate({ id: feedbackId, status: value })}
                >
                  <SelectTrigger className="h-8 w-40 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusConfig).map(([key, { label }]) => (
                      <SelectItem key={key} value={key} className="text-xs">{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-4">
                <Switch
                  checked={feedback.isPublic}
                  onCheckedChange={(checked) => updateFeedback.mutate({ id: feedbackId, isPublic: checked })}
                  id="public-toggle"
                />
                <Label htmlFor="public-toggle" className="text-xs cursor-pointer">Public</Label>
              </div>
            </div>

            {/* Delete */}
            <div className="pt-2 border-t">
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleDelete}>
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Delete submission
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Non-admin owner delete */}
      {!isAdmin && isOwner && feedback.status === "new" && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleDelete}>
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            Delete
          </Button>
        </div>
      )}

      {/* Comments */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
          <MessageCircle className="w-4 h-4" />
          Comments ({comments?.length ?? 0})
        </h3>

        {comments?.length === 0 && (
          <p className="text-xs text-muted-foreground/60 text-center py-6">No comments yet — be the first</p>
        )}

        <div className="space-y-2">
          {comments?.map((comment: any) => (
            <div
              key={comment.id}
              className={`flex gap-3 group/comment ${
                comment.isOfficialResponse ? "bg-primary/[0.04] border border-primary/20 rounded-lg p-3 -mx-1" : ""
              }`}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${
                comment.isAdminComment
                  ? "bg-primary/15 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}>
                {comment.isAnonymous
                  ? <Ghost className="w-3.5 h-3.5" />
                  : comment.isAdminComment
                    ? <Shield className="w-3.5 h-3.5" />
                    : (comment.displayName?.[0] ?? "?").toUpperCase()
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-medium text-foreground">
                    {comment.displayName ?? "Anonymous"}
                  </span>
                  {comment.isAdminComment && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-primary/30 text-primary font-semibold">
                      Admin
                    </Badge>
                  )}
                  {comment.isOfficialResponse && (
                    <Badge className="text-[9px] px-1.5 py-0 h-4 bg-primary text-primary-foreground font-semibold">
                      Official Response
                    </Badge>
                  )}
                  {comment.createdAt && (
                    <span className="text-[10px] text-muted-foreground/50">
                      {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                    </span>
                  )}
                  <div className="opacity-0 group-hover/comment:opacity-100 transition-opacity ml-auto flex items-center gap-1">
                    {isAdmin && (
                      <button
                        onClick={() => toggleOfficialResponse.mutate({
                          feedbackId,
                          commentId: comment.id,
                          isOfficialResponse: !comment.isOfficialResponse,
                        })}
                        className="text-muted-foreground/40 hover:text-primary"
                        title={comment.isOfficialResponse ? "Unpin official response" : "Pin as official response"}
                      >
                        {comment.isOfficialResponse ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                      </button>
                    )}
                    {(isAdmin || comment.userId === userId) && (
                      <button
                        onClick={() => deleteComment.mutate({ feedbackId, commentId: comment.id })}
                        className="text-muted-foreground/40 hover:text-destructive"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-foreground/90 whitespace-pre-wrap">{comment.content}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Comment input */}
        <div className="pt-2 space-y-2">
          <div className="flex gap-2">
            <Textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write a comment..."
              rows={2}
              className="flex-1 text-sm"
              onKeyDown={(e) => { if (e.key === "Enter" && e.metaKey) handleComment(); }}
            />
            <Button
              size="icon"
              className="self-end h-9 w-9"
              disabled={!commentText.trim() || createComment.isPending}
              onClick={handleComment}
            >
              {createComment.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setCommentAnonymous(!commentAnonymous)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border transition-all ${
                commentAnonymous
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-transparent border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              }`}
            >
              {commentAnonymous
                ? <><Ghost className="w-3.5 h-3.5" /> Anonymous<span className="opacity-60">· visible to admins</span></>
                : <><User className="w-3.5 h-3.5" /> Post anonymously?</>
              }
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setMarkOfficial(!markOfficial)}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border transition-all ${
                  markOfficial
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "bg-transparent border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                }`}
              >
                {markOfficial
                  ? <><Pin className="w-3.5 h-3.5" /> Official response</>
                  : <><Pin className="w-3.5 h-3.5" /> Mark as official</>
                }
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
