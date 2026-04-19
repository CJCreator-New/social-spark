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
.cd-blabel { font-size:9px; letter-spacing:.15em; text-transform:uppercase; color:#3a3a50; margin:16px 0 7px; font-weight:500; }
.cd-hook { border-left:2px solid rgba(200,240,154,0.28); padding:10px 15px; background:rgba(200,240,154,0.025); border-radius:0 6px 6px 0; font-family:'Playfair Display',serif; font-size:14px; font-style:italic; color:#7a7a8e; line-height:1.65; white-space:pre-line; }
.cd-body { font-size:13px; color:#686880; line-height:1.85; white-space:pre-line; font-weight:300; }
.cd-cta { background:rgba(200,240,154,0.06); border:1px solid rgba(200,240,154,0.1); border-radius:8px; padding:13px 15px; font-size:13px; color:rgba(200,240,154,0.75); line-height:1.6; font-weight:300; }
.cd-tags { font-size:12px; color:rgba(200,240,154,0.38); line-height:2; font-weight:300; }
`;

export default function CalendarDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [title, setTitle] = useState("");
  const [meta, setMeta] = useState("");
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(true);

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
              <div key={i} className={`cd-tab ${i === active ? "on" : ""}`} onClick={() => setActive(i)}>
                <div className="cd-tab-dow">{post.dow}</div>
                <div className="cd-tab-n">{i + 1}</div>
              </div>
            ))}
          </div>

          {p && (
            <div className="cd-card">
              <div className="cd-ptitle">{p.title}</div>
              <div className="cd-blabel">Hook</div>
              <div className="cd-hook">{p.hook}</div>
              <div className="cd-blabel">Post body</div>
              <div className="cd-body">{p.body}</div>
              <div className="cd-blabel">CTA</div>
              <div className="cd-cta">{p.cta}</div>
              <div className="cd-blabel">Hashtags</div>
              <div className="cd-tags">{p.hashtags}</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
