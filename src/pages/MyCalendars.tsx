import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { createScopedLogger } from "@/lib/logger";
import { SkeletonList } from "@/components/SkeletonList";
import { VirtualizedList } from "@/components/VirtualizedList";
import { WorkspacePage } from "@/components/layout/WorkspacePage";
import {
  useDeleteCalendarMutation,
  useDuplicateCalendarMutation,
  useRenameCalendarMutation,
  useRestoreCalendarMutation,
  useSavedCalendarsInfiniteQuery,
  useToggleCalendarFavoriteMutation,
} from "@/hooks/useAppQueries";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { CalendarItem } from "@/components/calendar/CalendarItem";
import type { Json } from "@/integrations/supabase/types";
import "@/styles/pages.css";

export interface SavedCalendar {
  id: string;
  title: string;
  industry_label: string | null;
  platform: string | null;
  core_idea: string | null;
  created_at: string;
  is_favorite?: boolean;
  posts?: Json;
  industry?: string | null;
  form_payload?: Json;
}

type SortKey = "newest" | "oldest" | "title" | "favorites";
const PAGE_SIZE = 20;

export default function MyCalendars() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const log = createScopedLogger("MyCalendars");
  const [pendingDelete, setPendingDelete] = useState<SavedCalendar | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [lastDeleted, setLastDeleted] = useState<SavedCalendar | null>(null);
  const lastDeletedTimer = useRef<number | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [favOnly, setFavOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("newest");

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 200);
    return () => clearTimeout(handler);
  }, [search]);
  const toggleFavoriteMutation = useToggleCalendarFavoriteMutation(user?.id);
  const deleteCalendarMutation = useDeleteCalendarMutation(user?.id);
  const restoreCalendarMutation = useRestoreCalendarMutation(user?.id);
  const renameCalendarMutation = useRenameCalendarMutation(user?.id);
  const duplicateCalendarMutation = useDuplicateCalendarMutation(user?.id);

  const { data, isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useSavedCalendarsInfiniteQuery(user?.id, PAGE_SIZE);

  useEffect(() => {
    if (error instanceof Error) toast.error(error.message);
  }, [error]);

  const items = useMemo(() => data?.pages.flatMap((page) => page.items) || [], [data]);

  const filteredItems = useMemo(() => {
    return items
      .filter((it) => {
        if (favOnly && !it.is_favorite) return false;
        if (debouncedSearch.trim()) {
          const q = debouncedSearch.toLowerCase();
          return (
            it.title.toLowerCase().includes(q) ||
            (it.industry_label || "").toLowerCase().includes(q) ||
            (it.platform || "").toLowerCase().includes(q) ||
            (it.core_idea || "").toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "favorites") {
          if (!!b.is_favorite !== !!a.is_favorite) return b.is_favorite ? 1 : -1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        if (sortBy === "title") return a.title.localeCompare(b.title);
        if (sortBy === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [items, favOnly, debouncedSearch, sortBy]);
  const favoriteCount = useMemo(() => items.filter((item) => item.is_favorite).length, [items]);
  const totalPosts = useMemo(() => items.reduce((count, item) => count + (Array.isArray(item.posts) ? item.posts.length : 0), 0), [items]);
  const visibleCount = filteredItems.length;

  const toggleFavorite = useCallback(async (it: SavedCalendar) => {
    const next = !it.is_favorite;
    try {
      await toggleFavoriteMutation.mutateAsync({ id: it.id, isFavorite: next });
      log.info("Calendar favorite updated", { calendarId: it.id, isFavorite: next });
      await refetch();
    } catch (error) {
      log.error("Failed to toggle favorite", error, { calendarId: it.id });
      toast.error(error instanceof Error ? error.message : "Toggle favorite failed");
    }
  }, [toggleFavoriteMutation, refetch, log]);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    // Try to fetch full record so we can offer an undo (re-insert) if deletion succeeds
    const { data: full, error: fetchErr } = await supabase.from("saved_calendars").select("*").eq("id", pendingDelete.id).maybeSingle();
    try {
      await deleteCalendarMutation.mutateAsync(pendingDelete.id);
    } catch (error) {
      setDeleting(false);
      log.error("Failed to delete calendar", error, { calendarId: pendingDelete.id });
      toast.error(error instanceof Error ? error.message : "Delete failed");
      setPendingDelete(null);
      return;
    }
    setDeleting(false);

    log.info("Calendar deleted", { calendarId: pendingDelete.id });
    await refetch();

    if (fetchErr || !full) {
      // No undo available
      toast.success("Deleted");
      setPendingDelete(null);
      return;
    }

    // Offer undo by keeping the deleted row in memory for a short window
    setLastDeleted(full as SavedCalendar);
    toast.success("Deleted — undo available for 10s");
    // Clear any existing timer
    if (lastDeletedTimer.current) window.clearTimeout(lastDeletedTimer.current);
    lastDeletedTimer.current = window.setTimeout(() => {
      setLastDeleted(null);
      lastDeletedTimer.current = null;
    }, 10000) as unknown as number;

    setPendingDelete(null);
  }

  async function undoDelete() {
    if (!lastDeleted || !user) return;
    // Re-insert the deleted calendar for the current user
    const payload = {
      user_id: user.id,
      title: lastDeleted.title,
      industry: lastDeleted.industry || null,
      industry_label: lastDeleted.industry_label || null,
      platform: lastDeleted.platform || null,
      core_idea: lastDeleted.core_idea || null,
      form_payload: lastDeleted.form_payload || {},
      posts: lastDeleted.posts || [],
      is_favorite: lastDeleted.is_favorite || false,
    };

    try {
      await restoreCalendarMutation.mutateAsync(payload);
    } catch (error) {
      log.error("Failed to restore deleted calendar", error);
      toast.error("Restore failed");
      return;
    }

    // Clear undo state and refresh list
    if (lastDeletedTimer.current) window.clearTimeout(lastDeletedTimer.current);
    lastDeletedTimer.current = null;
    setLastDeleted(null);
    await refetch();
    toast.success("Restored");
  }

  const startRename = useCallback((it: SavedCalendar) => {
    setRenamingId(it.id);
    setRenameValue(it.title);
  }, []);

  const saveRename = useCallback(async () => {
    if (!renamingId) return;
    const value = renameValue.trim();
    if (!value) {
      toast.error("Title cannot be empty");
      return;
    }

    setRenameSaving(true);
    try {
      await renameCalendarMutation.mutateAsync({ id: renamingId, title: value });
    } catch (error) {
      setRenameSaving(false);
      log.error("Failed to rename calendar", error, { calendarId: renamingId });
      toast.error(error instanceof Error ? error.message : "Rename failed");
      return;
    }
    setRenameSaving(false);

    log.info("Calendar renamed", { calendarId: renamingId, newTitle: value });
    setRenamingId(null);
    await refetch();
    toast.success("Renamed");
  }, [renamingId, renameValue, renameCalendarMutation, refetch, log]);

  const duplicate = useCallback(async (it: SavedCalendar) => {
    if (!user || duplicatingId) return;
    setDuplicatingId(it.id);

    const { data: full, error: fetchErr } = await supabase.from("saved_calendars").select("*").eq("id", it.id).maybeSingle();
    if (fetchErr || !full) {
      setDuplicatingId(null);
      toast.error(fetchErr?.message || "Failed to load source");
      return;
    }

    const newTitle = `${full.title} (copy)`.slice(0, 80);
    try {
      await duplicateCalendarMutation.mutateAsync({
        user_id: user.id,
        title: newTitle,
        industry: full.industry,
        industry_label: full.industry_label,
        platform: full.platform,
        core_idea: full.core_idea,
        form_payload: full.form_payload as never,
        posts: full.posts as never,
        is_favorite: false,
      });
    } catch (error) {
      setDuplicatingId(null);
      toast.error(error instanceof Error ? error.message : "Duplicate failed");
      return;
    }
    setDuplicatingId(null);

    log.info("Calendar duplicated", { sourceCalendarId: it.id });
    await refetch();
    toast.success("Duplicated");
  }, [user, duplicatingId, duplicateCalendarMutation, refetch, log]);

  const renderCalendarItem = useCallback((it: SavedCalendar, index: number) => {
    return (
      <CalendarItem
        it={it}
        renamingId={renamingId}
        renameValue={renameValue}
        renameSaving={renameSaving}
        setRenameValue={setRenameValue}
        saveRename={saveRename}
        setRenamingId={setRenamingId}
        startRename={startRename}
        duplicate={duplicate}
        duplicatingId={duplicatingId}
        setPendingDelete={setPendingDelete}
        toggleFavorite={toggleFavorite}
      />
    );
  }, [renamingId, renameValue, renameSaving, saveRename, startRename, duplicate, duplicatingId, toggleFavorite]);

  return (
    <>
      <Helmet>
        <title>My content calendars — ContentForge</title>
        <meta name="description" content="View and manage your saved AI content calendars. Search, star, rename, duplicate, or delete your content archives." />
      </Helmet>
      {lastDeleted && (
        <div style={{ maxWidth: 760, margin: '0 auto 12px', padding: 12, background: '#121218', border: '1px solid rgba(200,240,154,0.06)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ color: '#c8f09a' }}>
            Deleted “{lastDeleted.title}” — <button onClick={undoDelete} style={{ color: '#fff', marginLeft: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', padding: '6px 10px', borderRadius: 6 }}>Undo</button>
          </div>
        </div>
      )}
      <WorkspacePage size="medium">
        <div className="mc-head">
          <div>
            <h1 className="mc-title">My <em>calendars</em></h1>
            <div className="mc-meta" style={{ marginTop: 6 }}>
              {user?.email}
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Link to="/schedule" className="mc-back">
              📅 Schedule
            </Link>
            <Link to="/app" className="mc-back">
              ← New calendar
            </Link>
            <button className="mc-act" onClick={async () => { await signOut(); navigate("/auth"); }}>
              Sign out
            </button>
          </div>
        </div>

        <div className="mc-summary" aria-label="Calendar summary">
          <div className="mc-summary-card">
            <div className="mc-summary-label">Visible calendars</div>
            <div className="mc-summary-value">{visibleCount || items.length}</div>
            <div className="mc-summary-sub">{favOnly ? "Starred items only" : "All saved calendars"}</div>
          </div>
          <div className="mc-summary-card">
            <div className="mc-summary-label">Starred</div>
            <div className="mc-summary-value">{favoriteCount}</div>
            <div className="mc-summary-sub">Quick access to the calendars you reuse most.</div>
          </div>
          <div className="mc-summary-card">
            <div className="mc-summary-label">Posts stored</div>
            <div className="mc-summary-value">{totalPosts}</div>
            <div className="mc-summary-sub">Across all saved calendars in this account.</div>
          </div>
        </div>

        {!isLoading && items.length > 0 && (
          <div className="mc-filter-row">
            <input
              type="search"
              className="mc-search"
              placeholder="Search by title, industry, or platform…"
              aria-label="Search calendars"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              type="button"
              className={`mc-chip ${favOnly ? "on" : ""}`}
              onClick={() => setFavOnly((f) => !f)}
              aria-pressed={favOnly}
            >
              {favOnly ? "★ Starred only" : "☆ Starred only"}
            </button>
            <select
              className="mc-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              aria-label="Sort calendars"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="title">Title A–Z</option>
              <option value="favorites">Favorites first</option>
            </select>
          </div>
        )}

        {isLoading ? (
          <SkeletonList rows={4} />
        ) : items.length === 0 ? (
          <div className="mc-empty" style={{ padding: "72px 24px" }}>
            <div className="mc-empty-illus" aria-hidden="true">
              ✦
            </div>
            <h2 className="mc-empty-title">
              No <em>calendars</em> yet
            </h2>
            <p className="mc-empty-sub">
              Generate a full week of platform-native posts tailored to your niche, voice, and audience — saved here for quick access.
            </p>
            <Link to="/app" className="mc-empty-cta">
              Generate your first calendar →
            </Link>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="mc-empty">
            <div className="mc-empty-illus" aria-hidden="true">⌕</div>
            <div className="mc-empty-title">No <em>matches</em></div>
            <p className="mc-empty-sub">Try a different search term or switch off the starred-only filter to see more calendars.</p>
          </div>
        ) : (
          <>
          <div className="mc-list">
            <VirtualizedList
              items={filteredItems}
              renderItem={renderCalendarItem}
              height={600}
              estimatedItemHeight={90}
              ariaLabel="Saved calendars list"
            />
          </div>
          {hasNextPage && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
              <button
                className="mc-act"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? "Loading more…" : "Load more"}
              </button>
            </div>
          )}
          </>
        )}
      </WorkspacePage>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete this calendar?"
          message={`“${pendingDelete.title}” will be permanently removed. This cannot be undone.`}
          onCancel={() => { if (!deleting) setPendingDelete(null); }}
          onConfirm={async () => { await confirmDelete(); }}
        />
      )}
    </>
  );
}
