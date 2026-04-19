import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Post {
  day: number; dow: string; topic: string; format: string;
  title: string; hook: string; body: string; cta: string; hashtags: string; rationale: string;
}

const css = `
.cd-app { min-height:100vh; background:#07080d; color:#edeae3; font-family:'Sora',sans-serif; padding:40px 24px 100px; }
.cd-inner { max-width:760px; margin:0 auto; }
.cd-back { font-size:12px; color:#7a7a8e; text-decoration:none; }
.cd-back:hover { color:#c8f09a; }
.cd-title { font-family:'Playfair Display',serif; font-size:28px; font-weight:400; margin:14px 0 6px; }
.cd-meta { font-size:12px; color:#7a7a8e; margin-bottom:24px; }
.cd-strip { display:grid; grid-template-columns:repeat(7,1fr); gap:5px; margin-bottom:18px; }
.cd-tab { padding:10px 4px; border-radius:8px; border:1px solid rgba(255,255,255,0.055); text-align:center; cursor:pointer; background:#0d0f18; }
.cd-tab.on { background:rgba(200,240,154,0.12); border-color:rgba(200,240,154,0.32); }
.cd-tab-dow { font-size:9px; letter-spacing:.1em; text-transform:uppercase; color:#3a3a50; }
.cd-tab.on .cd-tab-dow { color:rgba(200,240,154,0.55); }
.cd-tab-n { font-family:'Playfair Display',serif; font-size:17px; color:#7a7a8e; margin-top:2px; }
.cd-tab.on .cd-tab-n { color:#c8f09a; }
.cd-card { background:#0d0f18; border:1px solid rgba(255,255,255,0.055); border-radius:16px; padding:26px; }
.cd-ptitle { font-family:'Playfair Display',serif; font-size:21px; font-weight:400; line-height:1.35; margin-bottom:18px; }
.cd-blabel { font-size:9px; letter-spacing:.15em; text-transform:uppercase; color:#3a3a50; margin:16px 0 7px; font-weight:500; display:flex; justify-content:space-between; align-items:center; }
.cd-hook { border-left:2px solid rgba(200,240,154,0.28); padding:10px 15px; background:rgba(200,240,154,0.025); border-radius:0 6px 6px 0; font-family:'Playfair Display',serif; font-size:14px; font-style:italic; color:#7a7a8e; line-height:1.65; white-space:pre-line; }
.cd-body { font-size:13px; color:#686880; line-height:1.85; white-space:pre-line; font-weight:300; }
.cd-cta { background:rgba(200,240,154,0.06); border:1px solid rgba(200,240,154,0.1); border-radius:8px; padding:13px 15px; font-size:13px; color:rgba(200,240,154,0.75); line-height:1.6; font-weight:300; }
.cd-tags { font-size:12px; color:rgba(200,240,154,0.38); line-height:2; font-weight:300; }
.cd-actions { display:flex; gap:8px; margin-top:22px; padding-top:18px; border-top:1px solid rgba(255,255,255,0.05); }
.cd-btn { padding:9px 16px; border-radius:8px; font-size:12px; font-weight:500; cursor:pointer; border:1px solid rgba(255,255,255,0.1); background:transparent; color:#edeae3; font-family:'Sora',sans-serif; }
.cd-btn:hover { border-color:rgba(200,240,154,0.32); }
.cd-btn-p { background:#c8f09a; color:#07080d; border-color:#c8f09a; }
.cd-btn-p:disabled { opacity:.5; cursor:not-allowed; }
.cd-edit-input { width:100%; background:#07080d; border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:11px 13px; font-size:14px; color:#edeae3; font-family:'Playfair Display',serif; outline:none; box-sizing:border-box; margin-bottom:10px; }
.cd-edit-input:focus { border-color:rgba(200,240,154,0.28); }
.cd-edit-area { width:100%; background:#07080d; border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:11px 13px; font-size:13px; color:#edeae3; font-family:'Sora',sans-serif; font-weight:300; outline:none; box-sizing:border-box; resize:vertical; line-height:1.65; }
.cd-edit-area:focus { border-color:rgba(200,240,154,0.28); }
.cd-mini { font-size:10px; color:#c8f09a; cursor:pointer; background:none; border:none; font-family:'Sora',sans-serif; padding:0; letter-spacing:.1em; text-transform:uppercase; font-weight:500; }
.cd-mini:hover { text-decoration:underline; }
`;

export default function CalendarDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [title, setTitle] = useState("");
  const [meta, setMeta] = useState("");
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Post | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase.from("saved_calendars").select("*").eq("id", id).maybeSingle().then(({ data, error }) => {
      if (error || !data) { toast.error("Calendar not found"); navigate("/my-calendars"); return; }
      setPosts((data.posts as unknown as Post[]) || []);
      setTitle(data.title);
      setMeta(`${data.industry_label || ""} · ${data.platform || ""} · ${new Date(data.created_at).toLocaleDateString()}`);
      setLoading(false);
    });
  }, [id, navigate]);

  function startEdit() {
    setDraft({ ...posts[active] });
    setEditing(true);
  }

  function cancelEdit() {
    setDraft(null);
    setEditing(false);
  }

  async function saveEdit() {
    if (!draft || !id) return;
    setSaving(true);
    const updated = posts.map((p, i) => i === active ? draft : p);
    const { error } = await supabase.from("saved_calendars")
      .update({ posts: updated as unknown as never })
      .eq("id", id);
    setSaving(false);
    if (error) return toast.error(error.message);
    setPosts(updated);
    setEditing(false);
    setDraft(null);
    toast.success("Post updated");
  }

  if (loading) return <div className="cd-app"><div className="cd-inner">Loading…</div></div>;
  const p = posts[active];

  return (
    <>
      <style>{css}</style>
      <div className="cd-app">
        <div className="cd-inner">
          <Link to="/my-calendars" className="cd-back">← Back to my calendars</Link>
          <h1 className="cd-title">{title}</h1>
          <div className="cd-meta">{meta}</div>

          <div className="cd-strip">
            {posts.map((post, i) => (
              <div key={i} className={`cd-tab ${i === active ? "on" : ""}`} onClick={() => { if (!editing) setActive(i); }}>
                <div className="cd-tab-dow">{post.dow}</div>
                <div className="cd-tab-n">{i + 1}</div>
              </div>
            ))}
          </div>

          {p && !editing && (
            <div className="cd-card">
              <div className="cd-ptitle">{p.title}</div>
              <div className="cd-blabel"><span>Hook</span></div>
              <div className="cd-hook">{p.hook}</div>
              <div className="cd-blabel"><span>Post body</span></div>
              <div className="cd-body">{p.body}</div>
              <div className="cd-blabel"><span>CTA</span></div>
              <div className="cd-cta">{p.cta}</div>
              <div className="cd-blabel"><span>Hashtags</span></div>
              <div className="cd-tags">{p.hashtags}</div>
              <div className="cd-actions">
                <button className="cd-btn cd-btn-p" onClick={startEdit}>Edit this post</button>
              </div>
            </div>
          )}

          {p && editing && draft && (
            <div className="cd-card">
              <div className="cd-blabel"><span>Title</span></div>
              <input className="cd-edit-input" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} />
              <div className="cd-blabel"><span>Hook</span></div>
              <textarea className="cd-edit-area" rows={3} value={draft.hook} onChange={e => setDraft({ ...draft, hook: e.target.value })} />
              <div className="cd-blabel"><span>Post body</span></div>
              <textarea className="cd-edit-area" rows={10} value={draft.body} onChange={e => setDraft({ ...draft, body: e.target.value })} />
              <div className="cd-blabel"><span>CTA</span></div>
              <textarea className="cd-edit-area" rows={2} value={draft.cta} onChange={e => setDraft({ ...draft, cta: e.target.value })} />
              <div className="cd-blabel"><span>Hashtags</span></div>
              <textarea className="cd-edit-area" rows={2} value={draft.hashtags} onChange={e => setDraft({ ...draft, hashtags: e.target.value })} />
              <div className="cd-actions">
                <button className="cd-btn cd-btn-p" onClick={saveEdit} disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
                <button className="cd-btn" onClick={cancelEdit} disabled={saving}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
