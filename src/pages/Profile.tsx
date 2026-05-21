import { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import mediaManager from "@/lib/mediaManager";
import { useDeleteTemplateMutation, useProfileQuery, useProfileUpdateMutation, useTemplatesQuery } from "@/hooks/useAppQueries";
import { toast } from "sonner";
import { normalizeTag, displayTag, parsePolicyList } from "@/lib/hashtagPolicy";
import { listTimezones, browserTimezone, tzLabel } from "@/lib/timezones";

const VOICE_OPTIONS = ["Technical & analytical", "Conversational & warm", "PM / product thinking", "Opinionated & bold", "Data-driven", "Storytelling-first", "Educational & clear", "Contrarian / challenger", "Founder POV", "Academic & research-backed", "Humorous & witty", "Inspirational & motivating"];
const STYLE_OPTIONS = ["Short punchy lines", "Long-form narrative", "Lists & frameworks", "Thread-style breakdown", "Stats-led", "Case study format", "Question-led", "First-person story", "Industry insight", "Myth-busting", "How-to guide", "Behind-the-scenes"];
const GOAL_OPTIONS = ["Awareness", "Engagement", "Drive traffic", "Lead generation", "Thought leadership", "Community building", "Sales & conversion"];

const css = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;1,400&family=Sora:wght@300;400;500;600&display=swap');
.pf-app { min-height:100vh; background:radial-gradient(circle at 18% 18%, rgba(216,255,121,0.08), transparent 24%), linear-gradient(180deg, #05060a 0%, #0a0d14 100%); color:#edeae3; font-family:'Sora',sans-serif; padding:40px 24px 100px; }
.pf-inner { max-width:560px; margin:0 auto; }
.pf-back { font-size:12px; color:#7a7a8e; text-decoration:none; }
.pf-back:hover { color:#c8f09a; }
.pf-title { font-family:'Playfair Display',serif; font-size:28px; font-weight:400; margin:14px 0 6px; }
.pf-sub { font-size:13px; color:#7a7a8e; margin-bottom:28px; }
.pf-summary { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:14px; }
.pf-summary-card { padding:14px 16px; border-radius:14px; background:#0d0f18; border:1px solid rgba(255,255,255,0.055); }
.pf-summary-label { font-size:9px; letter-spacing:.14em; text-transform:uppercase; color:#7a7a8e; font-weight:500; }
.pf-summary-value { font-family:'Playfair Display',serif; font-size:20px; color:#edeae3; margin-top:4px; }
.pf-summary-sub { font-size:11px; color:#7a7a8e; margin-top:4px; line-height:1.4; }
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

function TemplatesList() {
  const { user } = useAuth();
  type TemplateRecord = {
    id: string;
    name: string;
    description: string | null;
    config: unknown;
    created_at: string;
  };

  const { data: templates = [], isLoading: loading } = useTemplatesQuery(user?.id);
  const deleteTemplateMutation = useDeleteTemplateMutation(user?.id);

  async function handleDelete(id: string) {
    if (!confirm('Delete this template?')) return;
    try {
      await deleteTemplateMutation.mutateAsync(id);
      toast.success('Template deleted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Delete failed');
    }
  }

  function handleLoad(tpl: TemplateRecord) {
    if (!user) return toast.error('Sign in to load templates');
    const key = `draft:wizard:${user.id}`;
    const envelope = { version: 1, savedAt: Date.now(), data: tpl.config };
    try {
      localStorage.setItem(key, JSON.stringify(envelope));
      toast.success('Template loaded into wizard');
      window.location.href = '/app';
    } catch (e) {
      toast.error('Failed to load template');
    }
  }

  if (loading) return <div style={{ color: '#7a7a8e' }}>Loading templates…</div>;
  if (templates.length === 0) return <div className="pf-meta">No templates saved yet — save one from the wizard.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
      {templates.map(t => (
        <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, border: '1px solid rgba(255,255,255,0.04)', padding: 8, borderRadius: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>{t.name}</div>
            <div style={{ fontSize: 12, color: '#7a7a8e' }}>{t.description || ''} · {new Date(t.created_at).toLocaleString()}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="pf-add-btn" onClick={() => handleLoad(t)}>Load</button>
            <button className="pf-add-btn" onClick={() => handleDelete(t.id)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}

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
  const [defaultTimezone, setDefaultTimezone] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const tzList = listTimezones();

  function getAvatarPathFromPublicUrl(publicUrl: string) {
    try {
      const path = new URL(publicUrl).pathname;
      const marker = "/object/public/avatars/";
      const index = path.indexOf(marker);
      if (index === -1) return null;
      return path.slice(index + marker.length);
    } catch {
      return null;
    }
  }

  const { data: profileData } = useProfileQuery(user?.id);
  const updateProfile = useProfileUpdateMutation(user?.id);

  useEffect(() => {
    if (!profileData) return;
    setDisplayName(profileData.display_name || "");
    setAvatarUrl(profileData.avatar_url || "");
    setDefaultVoice(profileData.default_voice || "");
    setDefaultStyle(profileData.default_style || "");
    setDefaultAudiences(profileData.default_audiences || []);
    setDefaultGoals(profileData.default_goals || []);
    const d = profileData as { banned_hashtags?: string[] | null; required_hashtags?: string[] | null; default_timezone?: string | null } | null;
    setBannedHashtags(parsePolicyList(d?.banned_hashtags));
    setRequiredHashtags(parsePolicyList(d?.required_hashtags));
    setDefaultTimezone(d?.default_timezone || browserTimezone());
    setLoading(false);
  }, [profileData]);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!allowedTypes.includes(file.type)) return toast.error("Avatar must be PNG, JPEG, or WebP");
    if (file.size > 2 * 1024 * 1024) return toast.error("Image must be under 2MB");
    setUploading(true);
    const previousUrl = avatarUrl;
    const extByType: Record<string, string> = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
    };
    const path = `${user.id}/avatar.${extByType[file.type]}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
      upsert: true,
      contentType: file.type,
    });
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
    try { mediaManager.addMediaRef(user.id, newUrl); } catch {}
    await supabase.from("media_references").upsert({
      user_id: user.id,
      bucket: "avatars",
      storage_path: path,
      public_url: newUrl,
      reference_kind: "avatar",
      reference_key: user.id,
      reference_count: 1,
      last_referenced_at: new Date().toISOString(),
      orphaned_at: null,
      deleted_at: null,
    }, { onConflict: "bucket,storage_path" });
    if (previousUrl) {
      const oldPath = getAvatarPathFromPublicUrl(previousUrl);
      if (oldPath && oldPath !== path) void supabase.storage.from("avatars").remove([oldPath]);
      if (oldPath && oldPath !== path) {
        void supabase.from("media_references")
          .update({ reference_count: 0, orphaned_at: new Date().toISOString(), last_referenced_at: new Date().toISOString() })
          .eq("bucket", "avatars")
          .eq("storage_path", oldPath);
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
    const updates: Record<string, unknown> = {
      avatar_url: avatarUrl,
      default_voice: defaultVoice || null,
      default_style: defaultStyle || null,
      default_audiences: defaultAudiences.length ? defaultAudiences : null,
      default_goals: defaultGoals.length ? defaultGoals : null,
      banned_hashtags: bannedHashtags.length ? bannedHashtags : null,
      required_hashtags: requiredHashtags.length ? requiredHashtags : null,
      default_timezone: defaultTimezone || null,
    };
    if (displayName.trim()) updates.display_name = displayName.trim();
    await updateProfile.mutateAsync(updates);
    setSaving(false);
    toast.success("Profile updated");
  }

  const initial = (displayName || user?.email || "?").charAt(0).toUpperCase();
  const activeDefaults = [defaultVoice, defaultStyle, defaultTimezone].filter(Boolean).length + (defaultAudiences.length > 0 ? 1 : 0) + (defaultGoals.length > 0 ? 1 : 0);

  return (
    <>
      <style>{css}</style>
      <div className="pf-app">
        <div className="pf-inner">
          <Link to="/app" className="pf-back">← Back to ContentForge</Link>
          <h1 className="pf-title">Your profile</h1>
          <div className="pf-sub">Update how you appear inside ContentForge and set brand defaults to pre-fill the wizard.</div>

          <div className="pf-summary">
            <div className="pf-summary-card">
              <div className="pf-summary-label">Defaults set</div>
              <div className="pf-summary-value">{activeDefaults}</div>
              <div className="pf-summary-sub">Profile fields that will pre-fill the next calendar.</div>
            </div>
            <div className="pf-summary-card">
              <div className="pf-summary-label">Audiences</div>
              <div className="pf-summary-value">{defaultAudiences.length}</div>
              <div className="pf-summary-sub">Reusable audience presets.</div>
            </div>
            <div className="pf-summary-card">
              <div className="pf-summary-label">Hashtag rules</div>
              <div className="pf-summary-value">{bannedHashtags.length + requiredHashtags.length}</div>
              <div className="pf-summary-sub">Guardrails applied across generations.</div>
            </div>
          </div>

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
                      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleAvatarChange} style={{ display: "none" }} disabled={uploading} aria-label="Upload new avatar" />
                    </label>
                    <div className="pf-meta">PNG or JPG, up to 2MB.</div>
                  </div>
                </div>

                <label className="pf-label" htmlFor="pf-name">Display name</label>
                <input id="pf-name" className="pf-input" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" />

                <label className="pf-label" htmlFor="pf-email">Email</label>
                <input id="pf-email" className="pf-input" value={user?.email || ""} disabled />

                <label className="pf-label" htmlFor="pf-tz">Default timezone</label>
                <select id="pf-tz" className="pf-select" value={defaultTimezone} onChange={e => setDefaultTimezone(e.target.value)}>
                  <option value="">— Browser default ({browserTimezone()}) —</option>
                  {tzList.map(tz => <option key={tz} value={tz}>{tzLabel(tz)}</option>)}
                </select>
                <div className="pf-meta" style={{ marginTop: -8, marginBottom: 8 }}>
                  Used as the fallback when scheduling. Each calendar can override this.
                </div>
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

              <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="pf-btn" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
                </div>

                <div style={{ marginTop: 12 }}>
                  <h3 className="pf-section-h">Saved templates</h3>
                  <div className="pf-section-sub">Your saved templates (saved from the wizard). Load a template to pre-fill the wizard.</div>
                  <TemplatesList />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
