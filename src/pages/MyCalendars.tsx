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
.mc-list { display:flex; flex-direction:column; gap:10px; }
.mc-item { background:#0d0f18; border:1px solid rgba(255,255,255,0.055); border-radius:12px; padding:18px 20px; transition:border-color .15s; display:flex; justify-content:space-between; align-items:flex-start; gap:14px; }
.mc-item:hover { border-color:rgba(200,240,154,0.2); }
.mc-item-title { font-family:'Playfair Display',serif; font-size:17px; color:#edeae3; margin:0 0 4px; font-weight:400; }
.mc-meta { font-size:11px; color:#7a7a8e; font-weight:300; }
.mc-tag { display:inline-block; padding:2px 8px; border-radius:99px; background:rgba(200,240,154,0.1); color:#c8f09a; font-size:10px; margin-right:6px; letter-spacing:.04em; }
.mc-del { background:transparent; border:1px solid rgba(255,255,255,0.1); color:#7a7a8e; padding:6px 12px; border-radius:6px; font-size:11px; cursor:pointer; font-family:'Sora',sans-serif; transition:all .15s; flex-shrink:0; }
.mc-del:hover { border-color:rgba(240,154,154,0.3); color:#f09a9a; }
`;

export default function MyCalendars() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<SavedCalendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<SavedCalendar | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("saved_calendars")
      .select("id, title, industry_label, platform, core_idea, created_at")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        else setItems(data || []);
        setLoading(false);
      });
  }, [user]);

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
              <button className="mc-del" onClick={async () => { await signOut(); navigate("/auth"); }}>Sign out</button>
            </div>
          </div>

          {loading ? (
            <div className="mc-empty">Loading…</div>
          ) : items.length === 0 ? (
            <div className="mc-empty">
              No saved calendars yet.<br />
              <Link to="/" style={{ color: "#c8f09a", textDecoration: "none", marginTop: 12, display: "inline-block" }}>Generate your first week →</Link>
            </div>
          ) : (
            <div className="mc-list">
              {items.map(it => (
                <div key={it.id} className="mc-item">
                  <Link to={`/calendar/${it.id}`} style={{ textDecoration: "none", color: "inherit", flex: 1 }}>
                    <h3 className="mc-item-title">{it.title}</h3>
                    <div className="mc-meta">
                      {it.industry_label && <span className="mc-tag">{it.industry_label}</span>}
                      {it.platform && <span className="mc-tag">{it.platform}</span>}
                      <span>{new Date(it.created_at).toLocaleDateString()}</span>
                    </div>
                  </Link>
                  <button className="mc-del" onClick={() => setPendingDelete(it)}>Delete</button>
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
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmDelete(); }} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
