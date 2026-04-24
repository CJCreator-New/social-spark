import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SavedCalendar {
  id: string;
  title: string;
  industry_label: string | null;
  platform: string | null;
  core_idea: string | null;
  created_at: string;
  is_favorite?: boolean;
}

const css = `
.mc-app { min-height:100vh; background:#07080d; color:#edeae3; font-family:'Sora',sans-serif; padding:52px 24px 100px; }
.mc-inner { max-width:760px; margin:0 auto; }
.mc-head { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:32px; gap:16px; flex-wrap:wrap; }
.mc-title { font-family:'Playfair Display',serif; font-size:32px; font-weight:400; margin:0; }
.mc-title em { font-style:italic; color:#c8f09a; }
.mc-back { font-size:12px; color:#7a7a8e; text-decoration:none; transition:color .15s; }
.mc-back:hover { color:#c8f09a; }
.mc-empty { text-align:center; padding:60px 20px; color:#7a7a8e; font-size:14px; font-weight:300; border:1px dashed rgba(255,255,255,0.08); border-radius:16px; }
.mc-empty-illus { width:84px; height:84px; margin:0 auto 22px; border-radius:50%; background:radial-gradient(circle at 30% 30%, rgba(200,240,154,0.18), rgba(200,240,154,0.04) 65%, transparent 80%); border:1px solid rgba(200,240,154,0.18); display:flex; align-items:center; justify-content:center; font-size:34px; color:#c8f09a; }
.mc-empty-title { font-family:'Playfair Display',serif; font-size:22px; color:#edeae3; margin:0 0 8px; font-weight:400; }
.mc-empty-title em { font-style:italic; color:#c8f09a; }
.mc-empty-sub { font-size:13px; color:#7a7a8e; max-width:380px; margin:0 auto 22px; line-height:1.65; font-weight:300; }
.mc-empty-cta { display:inline-block; background:#c8f09a; color:#07080d; padding:11px 22px; border-radius:8px; font-size:13px; font-weight:500; text-decoration:none; font-family:'Sora',sans-serif; transition:transform .15s; }
.mc-empty-cta:hover { transform:translateY(-1px); }
.mc-list { display:flex; flex-direction:column; gap:10px; }
.mc-item { background:#0d0f18; border:1px solid rgba(255,255,255,0.055); border-radius:12px; padding:18px 20px; transition:border-color .15s; display:flex; justify-content:space-between; align-items:flex-start; gap:14px; }
.mc-item:hover { border-color:rgba(200,240,154,0.2); }
.mc-item-title { font-family:'Playfair Display',serif; font-size:17px; color:#edeae3; margin:0 0 4px; font-weight:400; }
.mc-meta { font-size:11px; color:#7a7a8e; font-weight:300; }
.mc-tag { display:inline-block; padding:2px 8px; border-radius:99px; background:rgba(200,240,154,0.1); color:#c8f09a; font-size:10px; margin-right:6px; letter-spacing:.04em; }
.mc-actions { display:flex; gap:6px; flex-shrink:0; flex-wrap:wrap; justify-content:flex-end; }
.mc-act { background:transparent; border:1px solid rgba(255,255,255,0.1); color:#7a7a8e; padding:6px 12px; border-radius:6px; font-size:11px; cursor:pointer; font-family:'Sora',sans-serif; transition:all .15s; flex-shrink:0; }
.mc-act:hover { border-color:rgba(200,240,154,0.32); color:#c8f09a; }
.mc-del { background:transparent; border:1px solid rgba(255,255,255,0.1); color:#7a7a8e; padding:6px 12px; border-radius:6px; font-size:11px; cursor:pointer; font-family:'Sora',sans-serif; transition:all .15s; flex-shrink:0; }
.mc-del:hover { border-color:rgba(240,154,154,0.3); color:#f09a9a; }
.mc-rename-input { width:100%; background:#07080d; border:1px solid rgba(200,240,154,0.32); border-radius:6px; padding:8px 10px; font-size:14px; color:#edeae3; font-family:'Playfair Display',serif; outline:none; box-sizing:border-box; }
.mc-dialog-action { background:#c8f09a !important; color:#07080d !important; border:1px solid #c8f09a !important; }
.mc-dialog-action:hover { background:#b9e289 !important; }
.mc-dialog-danger { background:#f09a9a !important; color:#07080d !important; border:1px solid #f09a9a !important; }
.mc-dialog-danger:hover { background:#e88a8a !important; }
.mc-filter-row { display:flex; gap:8px; align-items:center; margin-bottom:18px; flex-wrap:wrap; }
.mc-search { flex:1; min-width:200px; background:#0d0f18; border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:9px 13px; font-size:13px; color:#edeae3; font-family:'Sora',sans-serif; outline:none; }
.mc-search:focus { border-color:rgba(200,240,154,0.32); }
.mc-chip { background:transparent; border:1px solid rgba(255,255,255,0.1); color:#7a7a8e; padding:8px 14px; border-radius:99px; font-size:12px; cursor:pointer; font-family:'Sora',sans-serif; transition:all .15s; }
.mc-chip.on { background:rgba(200,240,154,0.1); border-color:rgba(200,240,154,0.32); color:#c8f09a; }
.mc-sort { background:#0d0f18; border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:8px 28px 8px 12px; font-size:12px; color:#edeae3; font-family:'Sora',sans-serif; outline:none; appearance:none; cursor:pointer; background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 11 11' fill='none' stroke='%237a7a8e' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><path d='M2.5 4l3 3 3-3'/></svg>"); background-repeat:no-repeat; background-position:right 9px center; }
.mc-sort:focus { border-color:rgba(200,240,154,0.32); }
.mc-star { background:transparent; border:none; cursor:pointer; font-size:18px; color:#3a3a50; padding:4px 6px; transition:color .15s; line-height:1; }
.mc-star.on { color:#c8f09a; }
.mc-star:hover { color:#c8f09a; }
`;

export default function MyCalendars() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<SavedCalendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<SavedCalendar | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [favOnly, setFavOnly] = useState(false);
  type SortKey = "newest" | "oldest" | "title" | "favorites";
  const [sortBy, setSortBy] = useState<SortKey>("newest");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("saved_calendars")
      .select("id, title, industry_label, platform, core_idea, created_at, is_favorite")
      .order("is_favorite", { ascending: false })
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        else setItems((data as SavedCalendar[]) || []);
        setLoading(false);
      });
  }, [user]);

  async function toggleFavorite(it: SavedCalendar) {
    const next = !it.is_favorite;
    setItems(p => p.map(i => i.id === it.id ? { ...i, is_favorite: next } : i));
    const { error } = await supabase.from("saved_calendars").update({ is_favorite: next }).eq("id", it.id);
    if (error) {
      setItems(p => p.map(i => i.id === it.id ? { ...i, is_favorite: !next } : i));
      toast.error(error.message);
    }
  }

  const filteredItems = items
    .filter(it => {
      if (favOnly && !it.is_favorite) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
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

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    const { error } = await supabase.from("saved_calendars").delete().eq("id", pendingDelete.id);
    setDeleting(false);
    if (error) {
      toast.error(error.message);
    } else {
      setItems(p => p.filter(i => i.id !== pendingDelete.id));
      toast.success("Deleted");
    }
    setPendingDelete(null);
  }

  function startRename(it: SavedCalendar) {
    setRenamingId(it.id);
    setRenameValue(it.title);
  }

  async function saveRename() {
    if (!renamingId) return;
    const value = renameValue.trim();
    if (!value) { toast.error("Title cannot be empty"); return; }
    setRenameSaving(true);
    const { error } = await supabase.from("saved_calendars")
      .update({ title: value })
      .eq("id", renamingId);
    setRenameSaving(false);
    if (error) { toast.error(error.message); return; }
    setItems(p => p.map(i => i.id === renamingId ? { ...i, title: value } : i));
    setRenamingId(null);
    toast.success("Renamed");
  }

  async function duplicate(it: SavedCalendar) {
    if (!user || duplicatingId) return;
    setDuplicatingId(it.id);
    // Fetch full row including posts + form_payload
    const { data: full, error: fetchErr } = await supabase
      .from("saved_calendars")
      .select("*")
      .eq("id", it.id)
      .maybeSingle();
    if (fetchErr || !full) {
      setDuplicatingId(null);
      toast.error(fetchErr?.message || "Failed to load source");
      return;
    }
    const newTitle = `${full.title} (copy)`.slice(0, 80);
    const { data: inserted, error: insErr } = await supabase
      .from("saved_calendars")
      .insert([{
        user_id: user.id,
        title: newTitle,
        industry: full.industry,
        industry_label: full.industry_label,
        platform: full.platform,
        core_idea: full.core_idea,
        form_payload: full.form_payload as never,
        posts: full.posts as never,
        is_favorite: false,
      }])
      .select("id, title, industry_label, platform, core_idea, created_at, is_favorite")
      .single();
    setDuplicatingId(null);
    if (insErr || !inserted) { toast.error(insErr?.message || "Duplicate failed"); return; }
    setItems(p => [inserted as SavedCalendar, ...p]);
    toast.success("Duplicated");
  }

  return (
    <>
      <style>{css}</style>
      <div className="mc-app">
        <div className="mc-inner">
          <div className="mc-head">
            <div>
              <h1 className="mc-title">My <em>calendars</em></h1>
              <div className="mc-meta" style={{ marginTop: 6 }}>{user?.email}</div>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <Link to="/" className="mc-back">← New calendar</Link>
              <button className="mc-act" onClick={async () => { await signOut(); navigate("/auth"); }}>Sign out</button>
            </div>
          </div>

          {!loading && items.length > 0 && (
            <div className="mc-filter-row">
              <input
                type="search"
                className="mc-search"
                placeholder="Search by title, industry, or platform…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <button
                type="button"
                className={`mc-chip ${favOnly ? "on" : ""}`}
                onClick={() => setFavOnly(f => !f)}
                aria-pressed={favOnly}
              >
                {favOnly ? "★ Starred only" : "☆ Starred only"}
              </button>
            </div>
          )}

          {loading ? (
            <div className="mc-empty">Loading…</div>
          ) : items.length === 0 ? (
            <div className="mc-empty" style={{ padding: "72px 24px" }}>
              <div className="mc-empty-illus" aria-hidden="true">✦</div>
              <h2 className="mc-empty-title">No <em>calendars</em> yet</h2>
              <p className="mc-empty-sub">
                Generate a full week of platform-native posts tailored to your niche, voice, and audience — saved here for quick access.
              </p>
              <Link to="/" className="mc-empty-cta">Generate your first calendar →</Link>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="mc-empty">No calendars match your filters.</div>
          ) : (
            <div className="mc-list">
              {filteredItems.map(it => (
                <div key={it.id} className="mc-item">
                  <button
                    type="button"
                    className={`mc-star ${it.is_favorite ? "on" : ""}`}
                    onClick={() => toggleFavorite(it)}
                    aria-pressed={!!it.is_favorite}
                    aria-label={it.is_favorite ? "Unstar" : "Star"}
                    title={it.is_favorite ? "Unstar" : "Star"}
                  >
                    {it.is_favorite ? "★" : "☆"}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {renamingId === it.id ? (
                      <input
                        className="mc-rename-input"
                        autoFocus
                        value={renameValue}
                        disabled={renameSaving}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") { e.preventDefault(); saveRename(); }
                          if (e.key === "Escape") { e.preventDefault(); setRenamingId(null); }
                        }}
                        onBlur={saveRename}
                      />
                    ) : (
                      <Link to={`/calendar/${it.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                        <h3 className="mc-item-title">{it.title}</h3>
                      </Link>
                    )}
                    <div className="mc-meta" style={{ marginTop: 4 }}>
                      {it.industry_label && <span className="mc-tag">{it.industry_label}</span>}
                      {it.platform && <span className="mc-tag">{it.platform}</span>}
                      <span>{new Date(it.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="mc-actions">
                    {renamingId === it.id ? (
                      <button className="mc-act" onClick={() => setRenamingId(null)} disabled={renameSaving}>
                        {renameSaving ? "Saving…" : "Cancel"}
                      </button>
                    ) : (
                      <>
                        <button className="mc-act" onClick={() => startRename(it)}>Rename</button>
                        <button className="mc-act" onClick={() => duplicate(it)} disabled={duplicatingId === it.id}>
                          {duplicatingId === it.id ? "Copying…" : "Duplicate"}
                        </button>
                        <button className="mc-del" onClick={() => setPendingDelete(it)}>Delete</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => { if (!open && !deleting) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this calendar?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete ? `“${pendingDelete.title}” will be permanently removed. This cannot be undone.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="mc-dialog-danger"
              onClick={(e) => { e.preventDefault(); confirmDelete(); }}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
