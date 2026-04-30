import { useCategories, useCreateCategory, useDeleteCategory } from "@/hooks/use-categories";
import { useTags, useCreateTag, useDeleteTag } from "@/hooks/use-tags";
import { useTasks } from "@/hooks/use-tasks";
import { useProfiles, useCreateProfile, useDeleteProfile, useCreateDemoProfile, useClearProfileData, useClearAllProfilesData, useRegenerateDemoProfile, useImportFromProfile } from "@/hooks/use-profiles";
import { useUserSettings, useUpdateUserSettings, useVacationMode, useStartVacation, useEndVacation } from "@/hooks/use-user-settings";
import { useProfileContext } from "@/contexts/ProfileContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Tag as TagIcon, Folder, Trash2, AlertTriangle, Users, Sparkles, Check, Eraser, Loader2, RefreshCw, Copy, MoreHorizontal, Globe, ChevronsUpDown, Palmtree, Calendar } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useState, useMemo } from "react";
import { queryClient } from "@/lib/queryClient";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const { data: profiles, isLoading: profilesLoading } = useProfiles();
  const { currentProfile, setCurrentProfile, isLoading: profileContextLoading } = useProfileContext();
  const { data: allTasks } = useTasks();
  const createTagMutation = useCreateTag();
  const deleteTagMutation = useDeleteTag();
  const createCategoryMutation = useCreateCategory();
  const deleteCategoryMutation = useDeleteCategory();
  const createProfileMutation = useCreateProfile();
  const deleteProfileMutation = useDeleteProfile();
  const createDemoMutation = useCreateDemoProfile();
  const clearProfileDataMutation = useClearProfileData();
  const clearAllProfilesDataMutation = useClearAllProfilesData();
  const regenerateDemoMutation = useRegenerateDemoProfile();
  const importFromProfileMutation = useImportFromProfile();
  
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [newProfileName, setNewProfileName] = useState("");
  const [importFromProfileId, setImportFromProfileId] = useState<string>("");
  const [clearProfileTarget, setClearProfileTarget] = useState<{ id: number; name: string } | null>(null);
  const [deleteProfileTarget, setDeleteProfileTarget] = useState<{ id: number; name: string } | null>(null);
  const [deleteTagTarget, setDeleteTagTarget] = useState<{ id: number; name: string } | null>(null);

  const { data: userSettings } = useUserSettings();
  const updateSettingsMutation = useUpdateUserSettings();
  const [tzOpen, setTzOpen] = useState(false);

  const { isActive: vacationActive, until: vacationUntil } = useVacationMode();
  const startVacation = useStartVacation();
  const endVacation = useEndVacation();
  const [vacationEndDate, setVacationEndDate] = useState<Date | undefined>(undefined);
  const [showVacationDatePicker, setShowVacationDatePicker] = useState(false);

  const detectedTz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const timezoneOptions = useMemo(() => {
    const now = new Date();
    const allTz = Intl.supportedValuesOf("timeZone");
    const entries = allTz.map((tz) => {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        timeZoneName: "shortOffset",
      });
      const parts = formatter.formatToParts(now);
      const offsetPart = parts.find((p) => p.type === "timeZoneName");
      const offsetStr = offsetPart?.value || "UTC";
      const normalizedOffset = offsetStr === "GMT" ? "UTC" : offsetStr.replace("GMT", "UTC");

      const offsetMatch = offsetStr.match(/GMT([+-]\d+(?::\d+)?)/);
      let offsetMinutes = 0;
      if (offsetMatch) {
        const [h, m] = offsetMatch[1].split(":").map(Number);
        offsetMinutes = (h || 0) * 60 + (m || 0);
      }

      return {
        value: tz,
        label: tz.replace(/_/g, " "),
        offset: normalizedOffset,
        offsetMinutes,
        isDetected: tz === detectedTz,
      };
    });

    entries.sort((a, b) => {
      if (a.isDetected !== b.isDetected) return a.isDetected ? -1 : 1;
      if (a.offsetMinutes !== b.offsetMinutes) return a.offsetMinutes - b.offsetMinutes;
      return a.label.localeCompare(b.label);
    });

    return entries;
  }, [detectedTz]);

  const getTaskCountForCategory = (catId: number) => allTasks?.filter(t => t.categoryId === catId).length ?? 0;
  const getTaskCountForTag = (tagId: number) => allTasks?.filter(t => t.tags?.some((tt: any) => tt.id === tagId)).length ?? 0;

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    createCategoryMutation.mutate({ name: newCategoryName }, {
      onSuccess: () => setNewCategoryName("")
    });
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;
    createTagMutation.mutate({ name: newTagName }, {
      onSuccess: () => setNewTagName("")
    });
  };

  const handleAddProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfileName.trim()) return;
    try {
      const newProfile = await createProfileMutation.mutateAsync({ name: newProfileName });
      setNewProfileName("");
      if (importFromProfileId && importFromProfileId !== "none") {
        await importFromProfileMutation.mutateAsync({
          targetProfileId: newProfile.id,
          sourceProfileId: Number(importFromProfileId)
        });
        setImportFromProfileId("");
      }
      await queryClient.refetchQueries({ queryKey: ['/api/profiles'] });
      setCurrentProfile(newProfile);
    } catch {
      // Error toasts handled by mutation hooks
    }
  };

  const handleDeleteProfile = (profileId: number) => {
    deleteProfileMutation.mutate(profileId, {
      onSuccess: () => {
        if (currentProfile?.id === profileId) {
          const remaining = profiles?.filter(p => p.id !== profileId);
          if (remaining && remaining.length > 0) {
            setCurrentProfile(remaining[0]);
          }
        }
        setDeleteProfileTarget(null);
      }
    });
  };

  const hasDemoProfile = profiles?.some(p => p.isDemo) ?? false;
  const isLoading = profilesLoading || profileContextLoading;

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-8">
      <div>
        <h2 className="text-3xl font-bold font-display tracking-tight">Settings</h2>
        <p className="text-muted-foreground mt-1">Manage your profiles, categories, tags, and data.</p>
      </div>

      {/* ── General ──────────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Globe className="w-4.5 h-4.5 text-primary" />
            General
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Account-wide preferences.
          </p>
        </div>

        <div className="rounded-lg border px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">Timezone</p>
            <p className="text-xs text-muted-foreground">
              Controls when your daily tasks reset and how completion dates are calculated.
            </p>
          </div>
          <Popover open={tzOpen} onOpenChange={setTzOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={tzOpen}
                className="w-full md:w-[300px] md:shrink-0 justify-between font-normal"
              >
                <span className="truncate">
                  {(userSettings?.timezone || "UTC").replace(/_/g, " ")}
                </span>
                <span className="ml-auto pl-2 text-xs text-muted-foreground shrink-0">
                  {timezoneOptions.find(t => t.value === (userSettings?.timezone || "UTC"))?.offset}
                </span>
                <ChevronsUpDown className="ml-1.5 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[340px] p-0" align="end">
              <Command>
                <CommandInput placeholder="Search city or timezone..." />
                <CommandList>
                  <CommandEmpty>No timezone found.</CommandEmpty>
                  {timezoneOptions[0]?.isDetected && (
                    <CommandGroup heading="Detected">
                      <CommandItem
                        value={timezoneOptions[0].value}
                        onSelect={() => {
                          updateSettingsMutation.mutate({ timezone: timezoneOptions[0].value });
                          setTzOpen(false);
                        }}
                      >
                        <span className="truncate">{timezoneOptions[0].label}</span>
                        <span className="ml-auto text-xs text-muted-foreground">{timezoneOptions[0].offset}</span>
                      </CommandItem>
                    </CommandGroup>
                  )}
                  <CommandGroup heading="All timezones">
                    {timezoneOptions.filter(t => !t.isDetected).map((tz) => (
                      <CommandItem
                        key={tz.value}
                        value={tz.value}
                        onSelect={() => {
                          updateSettingsMutation.mutate({ timezone: tz.value });
                          setTzOpen(false);
                        }}
                      >
                        <span className="truncate">{tz.label}</span>
                        <span className="ml-auto text-xs text-muted-foreground">{tz.offset}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* Vacation Mode */}
        <div className="rounded-lg border px-4 py-3 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium flex items-center gap-2">
                <Palmtree className="w-4 h-4" />
                Vacation Mode
              </p>
              <p className="text-xs text-muted-foreground">
                Pause all tasks at once. Streaks are preserved while vacation mode is active.
              </p>
            </div>
            <Switch
              checked={vacationActive}
              onCheckedChange={(checked) => {
                if (checked) {
                  const until = vacationEndDate?.toISOString();
                  startVacation.mutate(until);
                } else {
                  endVacation.mutate();
                  setVacationEndDate(undefined);
                  setShowVacationDatePicker(false);
                }
              }}
              disabled={startVacation.isPending || endVacation.isPending}
            />
          </div>
          {vacationActive && vacationUntil && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Active until {vacationUntil.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          )}
          {vacationActive && !vacationUntil && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Active indefinitely. Turn off when you're back.
            </p>
          )}
          {!vacationActive && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowVacationDatePicker(!showVacationDatePicker)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
              >
                {showVacationDatePicker ? "Hide end date" : "Set an end date (optional)"}
              </button>
            </div>
          )}
          {!vacationActive && showVacationDatePicker && (
            <div className="space-y-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full justify-start font-normal text-sm">
                    <Calendar className="w-4 h-4 mr-2" />
                    {vacationEndDate
                      ? vacationEndDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                      : "Pick a return date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarPicker
                    mode="single"
                    selected={vacationEndDate}
                    onSelect={setVacationEndDate}
                    disabled={(date) => date <= new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      </section>

      <Separator />

      {/* ── Profiles ─────────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Users className="w-4.5 h-4.5 text-primary" />
            Profiles
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Separate contexts for your tasks — like Work, Personal, or Exercise.
          </p>
        </div>

        {/* Profile list */}
        <div className="rounded-lg border divide-y">
          {isLoading ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">Loading...</div>
          ) : profiles?.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground text-center italic">
              No profiles yet. Create one below.
            </div>
          ) : (
            profiles?.map(profile => {
              const isActive = currentProfile?.id === profile.id;
              const canDelete = profile.isDemo || (profiles?.filter(p => !p.isDemo).length ?? 0) > 1;
              return (
                <div
                  key={profile.id}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors hover:bg-accent/50 ${isActive ? "bg-accent/30" : ""}`}
                  onClick={() => setCurrentProfile(profile)}
                  data-testid={`profile-item-${profile.id}`}
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 ${isActive ? "bg-primary" : "bg-transparent"}`} />
                  <span className="font-medium text-sm flex-1 min-w-0 truncate">
                    {profile.name}
                  </span>
                  {profile.isDemo && (
                    <Badge variant="secondary" className="text-xs shrink-0">Demo</Badge>
                  )}
                  {isActive && (
                    <Badge variant="outline" className="text-xs shrink-0 text-primary border-primary/40">Active</Badge>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
                        data-testid={`profile-menu-${profile.id}`}
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      {!isActive && (
                        <DropdownMenuItem onClick={() => setCurrentProfile(profile)}>
                          <Check className="w-4 h-4 mr-2" />
                          Switch to this profile
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => setClearProfileTarget({ id: profile.id, name: profile.name })}
                      >
                        <Eraser className="w-4 h-4 mr-2" />
                        Clear data
                      </DropdownMenuItem>
                      {canDelete && (
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteProfileTarget({ id: profile.id, name: profile.name })}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete profile
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })
          )}
        </div>

        {/* Create profile */}
        <form onSubmit={handleAddProfile} className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="profile-name" className="sr-only">New Profile Name</Label>
              <Input 
                id="profile-name" 
                placeholder="New profile name..." 
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                data-testid="input-profile-name"
              />
            </div>
            <Button type="submit" size="default" disabled={createProfileMutation.isPending || importFromProfileMutation.isPending || !newProfileName.trim()} data-testid="button-create-profile">
              {(createProfileMutation.isPending || importFromProfileMutation.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span className="ml-1.5">Create</span>
            </Button>
          </div>
          {profiles && profiles.length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <Copy className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground whitespace-nowrap">Copy tasks from:</span>
              <Select value={importFromProfileId} onValueChange={setImportFromProfileId}>
                <SelectTrigger className="w-[200px] h-8 text-sm" data-testid="select-import-profile">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (empty)</SelectItem>
                  {profiles.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.name}{p.isDemo ? " (Demo)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </form>

        {!hasDemoProfile && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={async () => {
              try {
                const data = await createDemoMutation.mutateAsync();
                await queryClient.refetchQueries({ queryKey: ['/api/profiles'] });
                if (data?.profile) {
                  setCurrentProfile(data.profile);
                }
              } catch {
                // Error toasts handled by mutation hook
              }
            }}
            disabled={createDemoMutation.isPending}
            data-testid="button-create-demo-profile"
          >
            {createDemoMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            {createDemoMutation.isPending ? "Creating demo..." : "Try Demo Profile"}
          </Button>
        )}
      </section>

      <Separator />

      {/* ── Categories & Tags ────────────────────────────── */}
      <section className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Folder className="w-4.5 h-4.5 text-primary" />
            Organization
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Categories and tags help you organize and filter tasks.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {/* Categories */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5" />
              Categories
            </Label>
            <p className="text-xs text-muted-foreground -mt-1">
              Each task belongs to one category. Best for broad groupings like "Health", "Work", or "Finance".
            </p>
            <form onSubmit={handleAddCategory} className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="category-name" className="sr-only">New Category Name</Label>
                <Input
                  id="category-name"
                  placeholder="New category..."
                  className="h-8 text-sm"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  data-testid="input-category-name"
                />
              </div>
              <Button type="submit" size="sm" className="h-8" disabled={createCategoryMutation.isPending || !newCategoryName.trim()} data-testid="button-add-category">
                {createCategoryMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              </Button>
            </form>
            <div className="rounded-lg border min-h-[60px] p-2.5">
              {catsLoading ? (
                <span className="text-muted-foreground text-sm">Loading...</span>
              ) : categories?.length === 0 ? (
                <span className="text-muted-foreground text-sm italic">No categories yet.</span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {categories?.map(cat => (
                    <div key={cat.id} className="bg-secondary text-secondary-foreground pl-2.5 pr-1 py-1 rounded-md text-xs font-medium flex items-center gap-1.5">
                      <span>{cat.name}</span>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            className="p-0.5 rounded opacity-40 hover:opacity-100 transition-opacity text-destructive"
                            title="Delete category"
                          >
                            {deleteCategoryMutation.isPending && deleteCategoryMutation.variables === cat.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Trash2 className="w-3 h-3" />
                            )}
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                              <AlertTriangle className="w-5 h-5 text-destructive" />
                              Delete category "{cat.name}"?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {getTaskCountForCategory(cat.id) > 0
                                ? `${getTaskCountForCategory(cat.id)} task${getTaskCountForCategory(cat.id) === 1 ? '' : 's'} will become uncategorized. This action cannot be undone.`
                                : "No tasks use this category. This action cannot be undone."}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteCategoryMutation.mutate(cat.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <TagIcon className="w-3.5 h-3.5" />
              Tags
            </Label>
            <p className="text-xs text-muted-foreground -mt-1">
              A task can have many tags. Best for cross-cutting labels like "Quick", "Urgent", or "Outdoors".
            </p>
            <form onSubmit={handleAddTag} className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="tag-name" className="sr-only">New Tag Name</Label>
                <Input 
                  id="tag-name" 
                  placeholder="New tag..." 
                  className="h-8 text-sm"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  data-testid="input-tag-name"
                />
              </div>
              <Button type="submit" size="sm" className="h-8" disabled={createTagMutation.isPending || !newTagName.trim()} data-testid="button-create-tag">
                {createTagMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              </Button>
            </form>
            <div className="rounded-lg border min-h-[60px] p-2.5">
              {tagsLoading ? (
                <span className="text-muted-foreground text-sm">Loading...</span>
              ) : tags?.length === 0 ? (
                <span className="text-muted-foreground text-sm italic">No tags yet.</span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {tags?.map(tag => (
                    <div key={tag.id} className="bg-secondary text-secondary-foreground pl-2.5 pr-1 py-1 rounded-md text-xs font-medium flex items-center gap-1.5">
                      <span>{tag.name}</span>
                      <button
                        className="p-0.5 rounded opacity-40 hover:opacity-100 transition-opacity text-destructive"
                        title="Delete tag"
                        onClick={() => setDeleteTagTarget({ id: tag.id, name: tag.name })}
                      >
                        {deleteTagMutation.isPending && deleteTagMutation.variables === tag.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <Separator />

      {/* ── Data Management / Danger Zone ───────────────── */}
      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-4.5 h-4.5" />
            Danger Zone
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Destructive actions that cannot be undone.
          </p>
        </div>

        <div className="rounded-lg border border-destructive/30 divide-y divide-destructive/15">
          {/* Demo regeneration — only visible for demo profiles */}
          {currentProfile?.isDemo && (
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">Regenerate demo data</p>
                <p className="text-xs text-muted-foreground">Replace sample data in the demo profile with fresh content.</p>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                className="shrink-0"
                onClick={() => regenerateDemoMutation.mutate(currentProfile.id)}
                disabled={regenerateDemoMutation.isPending}
                data-testid="button-regenerate-demo"
              >
                {regenerateDemoMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Regenerate
              </Button>
            </div>
          )}

          {/* Clear current profile */}
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Clear current profile data</p>
              <p className="text-xs text-muted-foreground">
                Remove all tasks, completions, and streaks from
                {currentProfile ? <> "<strong>{currentProfile.name}</strong>"</> : " the active profile"}.
                The profile itself is kept.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="shrink-0 text-destructive border-destructive/40 hover:bg-destructive/10"
                  disabled={!currentProfile}
                  data-testid="button-clear-profile-data"
                >
                  <Eraser className="w-4 h-4 mr-2" />
                  Clear
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                    Clear profile data?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all tasks, completions, streaks, categories, and tags in <strong>"{currentProfile?.name}"</strong>. The profile itself will remain. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => currentProfile && clearProfileDataMutation.mutate(currentProfile.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    data-testid="button-confirm-clear-profile"
                  >
                    {clearProfileDataMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    Clear Data
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {/* Clear ALL profiles */}
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Clear all profiles data</p>
              <p className="text-xs text-muted-foreground">
                Remove all tasks, completions, and streaks across every profile. Profiles themselves are kept.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="shrink-0" data-testid="button-clear-all-data">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                    Clear ALL profile data?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete <strong>all</strong> tasks, completions, streaks, categories, and tags across <strong>every profile</strong>. Profiles will remain but will be empty. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => clearAllProfilesDataMutation.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    data-testid="button-confirm-clear-all"
                  >
                    {clearAllProfilesDataMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    Yes, delete all data
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </section>

      {/* Clear profile confirmation (from dropdown) */}
      <AlertDialog open={!!clearProfileTarget} onOpenChange={(open) => !open && setClearProfileTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Clear data in "{clearProfileTarget?.name}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all tasks, completions, categories, and tags in this profile. The profile itself will be kept. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (clearProfileTarget) {
                  clearProfileDataMutation.mutate(clearProfileTarget.id);
                  setClearProfileTarget(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-clear-profile"
            >
              {clearProfileDataMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Clear Data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete profile confirmation (from dropdown) */}
      <AlertDialog open={!!deleteProfileTarget} onOpenChange={(open) => !open && setDeleteProfileTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Delete profile "{deleteProfileTarget?.name}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this profile and all tasks, completions, categories, and tags associated with it. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteProfileTarget && handleDeleteProfile(deleteProfileTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-profile"
            >
              {deleteProfileMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Delete Profile
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete tag confirmation */}
      <AlertDialog open={!!deleteTagTarget} onOpenChange={(open) => !open && setDeleteTagTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Delete tag "{deleteTagTarget?.name}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTagTarget && getTaskCountForTag(deleteTagTarget.id) > 0
                ? `This tag is used on ${getTaskCountForTag(deleteTagTarget.id)} task${getTaskCountForTag(deleteTagTarget.id) === 1 ? '' : 's'}. It will be removed from all of them. This action cannot be undone.`
                : "No tasks use this tag. This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTagTarget) {
                  deleteTagMutation.mutate(deleteTagTarget.id);
                  setDeleteTagTarget(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Tag
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
