import { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { normalizeTag, displayTag, parsePolicyList } from "@/lib/hashtagPolicy";

const VOICE_OPTIONS = ["Technical & analytical", "Conversational & warm", "PM / product thinking", "Opinionated & bold", "Data-driven", "Storytelling-first", "Educational & clear", "Contrarian / challenger", "Founder POV", "Academic & research-backed", "Humorous & witty", "Inspirational & motivating"];
const STYLE_OPTIONS = ["Short punchy lines", "Long-form narrative", "Lists & frameworks", "Thread-style breakdown", "Stats-led", "Case study format", "Question-led", "First-person story", "Industry insight", "Myth-busting", "How-to guide", "Behind-the-scenes"];
const GOAL_OPTIONS = ["Awareness", "Engagement", "Drive traffic", "Lead generation", "Thought leadership", "Community building", "Sales & conversion"];

const css = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;1,400&family=Sora:wght@300;400;500;600&display=swap');
.pf-app { min-height:100vh; background:#07080d; color:#edeae3; font-family:'Sora',sans-serif; padding:40px 24px 100px; }
.pf-inner { max-width:560px; margin:0 auto; }
.pf-back { font-size:12px; color:#7a7a8e; text-decoration:none; }
.pf-back:hover { color:#c8f09a; }
.pf-title { font-family:'Playfair Display',serif; font-size:28px; font-weight:400; margin:14px 0 6px; }
.pf-sub { font-size:13px; color:#7a7a8e; margin-bottom:28px; }
.pf-card { background:#0d0f18; border:1px solid rgba(255,255,255,0.055); border-radius:16px; padding:28px; margin-bottom:14px; }
.pf-section-h { font-family:'Playfair Display',serif; font-size:18px; font-weight:400; margin:0 0 6px; }
.pf-section-sub { font-size:12px; color:#7a7a8e; margin-bottom:18px; font-weight:300; }
.pf-row { display:flex; align-items:center; gap:18px; margin-bottom:24px; }
.pf-avatar { width:80px; height:80px; border-radius:50%; background:#07080d; border:1px solid rgba(255,255,255,0.1); object-fit:cover; display:flex; align-items:center; justify-content:center; font-family:'Playfair Display',serif; font-size:28px; color:#7a7a8e; }
.pf-uplabel { font-size:12px; color:#c8f09a; cursor:pointer; padding:7px 12px; border:1px solid rgba(200,240,154,0.32); border-radius:8px; background:rgba(200,240,154,0.06); display:inline-block; }
.pf-uplabel:hover { background:rgba(200,240,154,0.12); }
.pf-uplabel:focus-within { outline:2px solid rgba(200,240,154,0.6); outline-offset:2px; }
.pf-label { font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:#7a7a8e; margin-bottom:7px; font-weight:500; }
.pf-input { width:100%; background:#07080d; border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:11px 13px; font-size:13px; color:#edeae3; font-family:'Sora',sans-serif; font-weight:300; outline:none; box-sizing:border-box; margin-bottom:16px; }
.pf-input:focus { border-color:rgba(200,240,154,0.4); box-shadow:0 0 0 3px rgba(200,240,154,0.08); }
.pf-input:disabled { opacity:.6; cursor:not-allowed; }
.pf-select { width:100%; background:#07080d; border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:11px 13px; font-size:13px; color:#edeae3; font-family:'Sora',sans-serif; font-weight:300; outline:none; box-sizing:border-box; margin-bottom:16px; appearance:auto; cursor:pointer; }
.pf-select:focus { border-color:rgba(200,240,154,0.4); box-shadow:0 0 0 3px rgba(200,240,154,0.08); }
.pf-chips { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:16px; }
.pf-chip { padding:6px 14px; border-radius:99px; border:1px solid rgba(255,255,255,0.1); font-size:12px; color:#9a9aae; cursor:pointer; background:transparent; font-family:'Sora',sans-serif; font-weight:300; transition:all .15s; }
.pf-chip:hover { border-color:rgba(200,240,154,0.28); color:#edeae3; }
.pf-chip.on { background:rgba(200,240,154,0.12); border-color:rgba(200,240,154,0.4); color:#c8f09a; font-weight:400; }
.pf-chip:focus-visible { outline:2px solid rgba(200,240,154,0.6); outline-offset:2px; }
.pf-tagrow { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px; min-height:32px; padding:6px 8px; background:#07080d; border:1px solid rgba(255,255,255,0.1); border-radius:8px; }
.pf-tag { background:rgba(200,240,154,0.12); border:1px solid rgba(200,240,154,0.3); color:#c8f09a; border-radius:5px; padding:3px 9px; font-size:11px; display:inline-flex; align-items:center; gap:6px; }
.pf-tag-x { cursor:pointer; color:rgba(200,240,154,0.6); font-size:14px; line-height:1; background:none; border:none; padding:0; }
.pf-tag-x:hover { color:#c8f09a; }
.pf-tagrow-empty { color:#3a3a50; font-size:12px; padding:4px 4px; font-weight:300; }
.pf-add-row { display:flex; gap:8px; margin-bottom:16px; }
.pf-add-row .pf-input { margin-bottom:0; flex:1; }
.pf-add-btn { padding:0 16px; background:rgba(200,240,154,0.1); border:1px solid rgba(200,240,154,0.28); border-radius:8px; color:#c8f09a; font-size:12px; cursor:pointer; font-family:'Sora',sans-serif; white-space:nowrap; font-weight:400; }
.pf-add-btn:hover { background:rgba(200,240,154,0.18); }
.pf-btn { padding:11px 18px; border-radius:8px; font-size:13px; font-weight:500; cursor:pointer; border:none; background:#c8f09a; color:#07080d; }
.pf-btn:disabled { opacity:.5; cursor:not-allowed; }
.pf-btn:focus-visible { outline:2px solid rgba(200,240,154,0.6); outline-offset:2px; }
.pf-meta { font-size:11px; color:#6a6a82; margin-top:10px; }
`;

export default function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [defaultVoice, setDefaultVoice] = useState("");
  const [defaultStyle, setDefaultStyle] = useState("");
  const [defaultAudiences, setDefaultAudiences] = useState<string[]>([]);
  const [defaultGoals, setDefaultGoals] = useState<string[]>([]);
  const [audienceInput, setAudienceInput] = useState("");
  const [bannedHashtags, setBannedHashtags] = useState<string[]>([]);
  const [requiredHashtags, setRequiredHashtags] = useState<string[]>([]);
  const [bannedTagInput, setBannedTagInput] = useState("");
  const [requiredTagInput, setRequiredTagInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name, avatar_url, default_voice, default_style, default_audiences, default_goals, banned_hashtags, required_hashtags").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        setDisplayName(data?.display_name || "");
        setAvatarUrl(data?.avatar_url || "");
        setDefaultVoice(data?.default_voice || "");
        setDefaultStyle(data?.default_style || "");
        setDefaultAudiences(data?.default_audiences || []);
        setDefaultGoals(data?.default_goals || []);
        const d = data as { banned_hashtags?: string[] | null; required_hashtags?: string[] | null } | null;
        setBannedHashtags(parsePolicyList(d?.banned_hashtags));
        setRequiredHashtags(parsePolicyList(d?.required_hashtags));
        setLoading(false);
      });
  }, [user]);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("Image must be under 2MB");
    setUploading(true);
    const previousUrl = avatarUrl;
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (upErr) { setUploading(false); return toast.error(upErr.message); }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const newUrl = data.publicUrl;
    const { error: updErr } = await supabase.from("profiles").update({ avatar_url: newUrl }).eq("user_id", user.id);
    if (updErr) {
      await supabase.storage.from("avatars").remove([path]);
      setUploading(false);
      return toast.error(updErr.message);
    }
    setAvatarUrl(newUrl);
    if (previousUrl) {
      const marker = `/avatars/${user.id}/`;
      const idx = previousUrl.indexOf(marker);
      if (idx !== -1) {
        const oldPath = previousUrl.slice(idx + "/avatars/".length);
        void supabase.storage.from("avatars").remove([oldPath]);
      }
    }
    if (fileRef.current) fileRef.current.value = "";
    setUploading(false);
    toast.success("Avatar updated");
  }

  function toggleGoal(g: string) {
    setDefaultGoals(p => p.includes(g) ? p.filter(x => x !== g) : [...p, g]);
  }

  function addAudience() {
    const v = audienceInput.trim();
    if (!v || defaultAudiences.includes(v) || defaultAudiences.length >= 6) return;
    setDefaultAudiences(p => [...p, v]);
    setAudienceInput("");
  }

  function removeAudience(a: string) {
    setDefaultAudiences(p => p.filter(x => x !== a));
  }

  function addTag(kind: "ban" | "req") {
    const raw = kind === "ban" ? bannedTagInput : requiredTagInput;
    const tag = normalizeTag(raw);
    if (!tag) return;
    if (kind === "ban") {
      if (bannedHashtags.includes(tag) || bannedHashtags.length >= 30) return;
      setBannedHashtags(p => [...p, tag]);
      setBannedTagInput("");
    } else {
      if (requiredHashtags.includes(tag) || requiredHashtags.length >= 10) return;
      setRequiredHashtags(p => [...p, tag]);
      setRequiredTagInput("");
    }
  }

  function removeTag(kind: "ban" | "req", tag: string) {
    if (kind === "ban") setBannedHashtags(p => p.filter(t => t !== tag));
    else setRequiredHashtags(p => p.filter(t => t !== tag));
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles")
      .update({
        display_name: displayName,
        avatar_url: avatarUrl,
        default_voice: defaultVoice || null,
        default_style: defaultStyle || null,
        default_audiences: defaultAudiences.length ? defaultAudiences : null,
        default_goals: defaultGoals.length ? defaultGoals : null,
        banned_hashtags: bannedHashtags.length ? bannedHashtags : null,
        required_hashtags: requiredHashtags.length ? requiredHashtags : null,
      })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
  }

  const initial = (displayName || user?.email || "?").charAt(0).toUpperCase();

  return (
    <>
      <style>{css}</style>
      <div className="pf-app">
        <div className="pf-inner">
          <Link to="/" className="pf-back">← Back to ContentForge</Link>
          <h1 className="pf-title">Your profile</h1>
          <div className="pf-sub">Update how you appear inside ContentForge and set brand defaults to pre-fill the wizard.</div>

          <div className="pf-card">
            {loading ? (
              <div style={{ color: "#7a7a8e", fontSize: 13 }}>Loading…</div>
            ) : (
              <>
                <div className="pf-row">
                  {avatarUrl
                    ? <img className="pf-avatar" src={avatarUrl} alt="Your avatar" />
                    : <div className="pf-avatar" aria-hidden="true">{initial}</div>}
                  <div>
                    <label className="pf-uplabel">
                      {uploading ? "Uploading…" : "Upload new avatar"}
                      <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: "none" }} disabled={uploading} aria-label="Upload new avatar" />
                    </label>
                    <div className="pf-meta">PNG or JPG, up to 2MB.</div>
                  </div>
                </div>

                <label className="pf-label" htmlFor="pf-name">Display name</label>
                <input id="pf-name" className="pf-input" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" />

                <label className="pf-label" htmlFor="pf-email">Email</label>
                <input id="pf-email" className="pf-input" value={user?.email || ""} disabled />
              </>
            )}
          </div>

          {!loading && (
            <div className="pf-card">
              <h2 className="pf-section-h">Brand defaults</h2>
              <div className="pf-section-sub">Pre-fill the wizard with your usual voice, style, audiences, and goals. You can still change them per calendar.</div>

              <label className="pf-label" htmlFor="pf-voice">Default voice / tone</label>
              <select id="pf-voice" className="pf-select" value={defaultVoice} onChange={e => setDefaultVoice(e.target.value)}>
                <option value="">— No default —</option>
                {VOICE_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>

              <label className="pf-label" htmlFor="pf-style">Default writing style</label>
              <select id="pf-style" className="pf-select" value={defaultStyle} onChange={e => setDefaultStyle(e.target.value)}>
                <option value="">— No default —</option>
                {STYLE_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>

              <div className="pf-label" id="pf-aud-label">Default audiences (up to 6)</div>
              <div className="pf-tagrow" role="list" aria-labelledby="pf-aud-label">
                {defaultAudiences.length === 0
                  ? <span className="pf-tagrow-empty">No audiences saved yet</span>
                  : defaultAudiences.map(a => (
                    <span key={a} className="pf-tag" role="listitem">
                      {a}
                      <button className="pf-tag-x" onClick={() => removeAudience(a)} aria-label={`Remove ${a}`}>×</button>
                    </span>
                  ))}
              </div>
              <div className="pf-add-row">
                <input
                  className="pf-input"
                  placeholder="+ add an audience, e.g. Startup founders"
                  value={audienceInput}
                  onChange={e => setAudienceInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addAudience())}
                  aria-label="New audience"
                />
                <button className="pf-add-btn" onClick={addAudience}>Add</button>
              </div>

              <div className="pf-label" id="pf-goals-label">Default goals</div>
              <div className="pf-chips" role="group" aria-labelledby="pf-goals-label">
                {GOAL_OPTIONS.map(g => (
                  <button
                    key={g}
                    type="button"
                    className={`pf-chip ${defaultGoals.includes(g) ? "on" : ""}`}
                    onClick={() => toggleGoal(g)}
                    aria-pressed={defaultGoals.includes(g)}
                  >
                    {g}
                  </button>
                ))}
              </div>

              <div style={{ height: 8 }} />
              <h2 className="pf-section-h" style={{ marginTop: 14 }}>Hashtag policy</h2>
              <div className="pf-section-sub">
                Banned tags are stripped from every generated post. Required tags are appended automatically (up to each platform's natural limit).
              </div>

              <div className="pf-label">Banned hashtags ({bannedHashtags.length}/30)</div>
              <div className="pf-tagrow" role="list" aria-label="Banned hashtags">
                {bannedHashtags.length === 0
                  ? <span className="pf-tagrow-empty">No banned tags yet</span>
                  : bannedHashtags.map(t => (
                    <span key={t} className="pf-tag" role="listitem" style={{ background: "rgba(240,154,154,0.1)", borderColor: "rgba(240,154,154,0.3)", color: "#f09a9a" }}>
                      {displayTag(t)}
                      <button className="pf-tag-x" onClick={() => removeTag("ban", t)} aria-label={`Remove ${displayTag(t)}`} style={{ color: "rgba(240,154,154,0.6)" }}>×</button>
                    </span>
                  ))}
              </div>
              <div className="pf-add-row">
                <input
                  className="pf-input"
                  placeholder="+ ban a tag, e.g. growthhacks"
                  value={bannedTagInput}
                  onChange={e => setBannedTagInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTag("ban"))}
                  aria-label="New banned hashtag"
                />
                <button className="pf-add-btn" onClick={() => addTag("ban")}>Ban</button>
              </div>

              <div className="pf-label">Required hashtags ({requiredHashtags.length}/10)</div>
              <div className="pf-tagrow" role="list" aria-label="Required hashtags">
                {requiredHashtags.length === 0
                  ? <span className="pf-tagrow-empty">No required tags yet</span>
                  : requiredHashtags.map(t => (
                    <span key={t} className="pf-tag" role="listitem">
                      {displayTag(t)}
                      <button className="pf-tag-x" onClick={() => removeTag("req", t)} aria-label={`Remove ${displayTag(t)}`}>×</button>
                    </span>
                  ))}
              </div>
              <div className="pf-add-row">
                <input
                  className="pf-input"
                  placeholder="+ require a brand tag, e.g. acmeai"
                  value={requiredTagInput}
                  onChange={e => setRequiredTagInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTag("req"))}
                  aria-label="New required hashtag"
                />
                <button className="pf-add-btn" onClick={() => addTag("req")}>Require</button>
              </div>

              <button className="pf-btn" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
