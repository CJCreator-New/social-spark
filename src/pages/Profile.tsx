import { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import mediaManager from "@/lib/mediaManager";
import { useDeleteTemplateMutation, useProfileQuery, useProfileUpdateMutation, useTemplatesQuery } from "@/hooks/useAppQueries";
import { toast } from "sonner";
import { normalizeTag, displayTag, parsePolicyList } from "@/lib/hashtagPolicy";
import { listTimezones, browserTimezone, tzLabel } from "@/lib/timezones";
import { WorkspacePage } from "@/components/layout/WorkspacePage";
import { motion, AnimatePresence } from "framer-motion";
import "@/styles/pages.css";

const VOICE_OPTIONS = ["Technical & analytical", "Conversational & warm", "PM / product thinking", "Opinionated & bold", "Data-driven", "Storytelling-first", "Educational & clear", "Contrarian / challenger", "Founder POV", "Academic & research-backed", "Humorous & witty", "Inspirational & motivating"];
const STYLE_OPTIONS = ["Short punchy lines", "Long-form narrative", "Lists & frameworks", "Thread-style breakdown", "Stats-led", "Case study format", "Question-led", "First-person story", "Industry insight", "Myth-busting", "How-to guide", "Behind-the-scenes"];
const GOAL_OPTIONS = ["Awareness", "Engagement", "Drive traffic", "Lead generation", "Thought leadership", "Community building", "Sales & conversion"];

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
  const [defaultTimezone, setDefaultTimezone] = useState<string>(browserTimezone());
  const [brandExamples, setBrandExamples] = useState<string[]>([]);
  const [brandExampleInput, setBrandExampleInput] = useState("");
  const [defaultFramework, setDefaultFramework] = useState<string>("Auto");
  const [forbiddenPhrases, setForbiddenPhrases] = useState<string[]>([]);
  const [forbiddenPhraseInput, setForbiddenPhraseInput] = useState("");
  const [proofPoints, setProofPoints] = useState<string[]>([]);
  const [proofPointInput, setProofPointInput] = useState("");
  const [ctaPreferences, setCtaPreferences] = useState<string[]>([]);
  const [ctaPreferenceInput, setCtaPreferenceInput] = useState("");
  const [preferredStructures, setPreferredStructures] = useState<string[]>([]);
  const [preferredStructureInput, setPreferredStructureInput] = useState("");
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

  const { data: profileData, isLoading: profileLoading, error: profileError } = useProfileQuery(user?.id);
  const updateProfile = useProfileUpdateMutation(user?.id);

  useEffect(() => {
    if (!profileData) return;
    setDisplayName(profileData.display_name || "");
    setAvatarUrl(profileData.avatar_url || "");
    setDefaultVoice(profileData.default_voice || "");
    setDefaultStyle(profileData.default_style || "");
    setDefaultAudiences(profileData.default_audiences || []);
    setDefaultGoals(profileData.default_goals || []);
    const d = profileData as {
      banned_hashtags?: string[] | null;
      required_hashtags?: string[] | null;
      default_timezone?: string | null;
      brand_examples?: string[] | null;
      default_framework?: string | null;
      forbidden_phrases?: string[] | null;
      proof_points?: string[] | null;
      cta_preferences?: string[] | null;
      preferred_structures?: string[] | null;
    } | null;
    setBannedHashtags(parsePolicyList(d?.banned_hashtags));
    setRequiredHashtags(parsePolicyList(d?.required_hashtags));
    setDefaultTimezone(d?.default_timezone || browserTimezone());
    setBrandExamples(d?.brand_examples || []);
    setDefaultFramework(d?.default_framework || "Auto");
    setForbiddenPhrases(d?.forbidden_phrases || []);
    setProofPoints(d?.proof_points || []);
    setCtaPreferences(d?.cta_preferences || []);
    setPreferredStructures(d?.preferred_structures || []);
  }, [profileData]);

  useEffect(() => {
    if (profileError instanceof Error) {
      toast.error(profileError.message);
    }
  }, [profileError]);

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
    try {
      mediaManager.addMediaRef(user.id, newUrl);
    } catch {
      /* media reference tracking is best effort */
    }
    await (supabase.from as any)("media_references").upsert({
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
        void (supabase.from as any)("media_references")
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

  function addBrandExample() {
    const v = brandExampleInput.trim();
    if (!v) return;
    if (brandExamples.length >= 3) return toast.error('Max 3 examples');
    setBrandExamples(p => [...p, v]);
    setBrandExampleInput('');
  }

  function addForbiddenPhrase() {
    const v = forbiddenPhraseInput.trim();
    if (!v) return;
    if (forbiddenPhrases.includes(v)) return;
    setForbiddenPhrases(p => [...p, v]);
    setForbiddenPhraseInput("");
  }

  function addProofPoint() {
    const v = proofPointInput.trim();
    if (!v) return;
    if (proofPoints.includes(v)) return;
    setProofPoints(p => [...p, v]);
    setProofPointInput("");
  }

  function addCtaPreference() {
    const v = ctaPreferenceInput.trim();
    if (!v) return;
    if (ctaPreferences.includes(v)) return;
    setCtaPreferences(p => [...p, v]);
    setCtaPreferenceInput("");
  }

  function addPreferredStructure() {
    const v = preferredStructureInput.trim();
    if (!v) return;
    if (preferredStructures.includes(v)) return;
    setPreferredStructures(p => [...p, v]);
    setPreferredStructureInput("");
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
    try {
      const updates: Record<string, unknown> = {
        avatar_url: avatarUrl,
        default_voice: defaultVoice || null,
        default_style: defaultStyle || null,
        default_audiences: defaultAudiences.length ? defaultAudiences : null,
        default_goals: defaultGoals.length ? defaultGoals : null,
        banned_hashtags: bannedHashtags.length ? bannedHashtags : null,
        required_hashtags: requiredHashtags.length ? requiredHashtags : null,
        default_timezone: defaultTimezone || null,
        forbidden_phrases: forbiddenPhrases.length ? forbiddenPhrases : null,
        proof_points: proofPoints.length ? proofPoints : null,
        cta_preferences: ctaPreferences.length ? ctaPreferences : null,
        preferred_structures: preferredStructures.length ? preferredStructures : null,
      };
      if (brandExamples.length) updates.brand_examples = brandExamples;
      if (defaultFramework) updates.default_framework = defaultFramework;
      if (displayName.trim()) updates.display_name = displayName.trim();
      await updateProfile.mutateAsync(updates);
      toast.success("Profile updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  const initial = (displayName || user?.email || "?").charAt(0).toUpperCase();
  const activeDefaults = [defaultVoice, defaultStyle, defaultTimezone].filter(Boolean).length + (defaultAudiences.length > 0 ? 1 : 0) + (defaultGoals.length > 0 ? 1 : 0);

  return (
    <>
      <WorkspacePage size="narrow">
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
          {profileLoading ? (
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
                  <div className="pf-meta">PNG, JPEG, or WebP, up to 2MB.</div>
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

        {!profileLoading && (
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
                <AnimatePresence>
                  {defaultAudiences.length === 0 ? (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pf-tagrow-empty">No audiences saved yet</motion.span>
                  ) : (
                    defaultAudiences.map(a => (
                      <motion.span layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ type: "spring", stiffness: 500, damping: 25 }} key={a} className="pf-tag" role="listitem">
                        {a}
                        <button className="pf-tag-x" onClick={() => removeAudience(a)} aria-label={`Remove ${a}`}>×</button>
                      </motion.span>
                    ))
                  )}
                </AnimatePresence>
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
                  <motion.button
                    key={g}
                    type="button"
                    className={`pf-chip ${defaultGoals.includes(g) ? "on" : ""}`}
                    onClick={() => toggleGoal(g)}
                    aria-pressed={defaultGoals.includes(g)}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                  >
                    {g}
                  </motion.button>
                ))}
              </div>

              <label className="pf-label" htmlFor="pf-framework">Default prompt framework</label>
              <select id="pf-framework" className="pf-select" value={defaultFramework} onChange={e => setDefaultFramework(e.target.value)}>
                <option value="Auto">Auto (choose best)</option>
                <option value="AIDA">AIDA</option>
                <option value="PAS">PAS</option>
                <option value="BAB">BAB</option>
                <option value="4U">4U</option>
                <option value="FAB">FAB</option>
                <option value="Question-led">Question-led</option>
                <option value="Story-led">Story-led</option>
              </select>

              <div className="pf-label">Brand example posts (optional — up to 3)</div>
              <div className="pf-tagrow" aria-hidden>
                {brandExamples.length === 0 ? <div className="pf-tagrow-empty">No examples saved</div> : brandExamples.map((b, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ flex: 1, fontSize: 13, color: '#c8f09a' }}>{b}</div>
                    <button className="pf-add-btn" onClick={() => setBrandExamples(prev => prev.filter((_, idx) => idx !== i))}>Remove</button>
                  </div>
                ))}
              </div>
              <div className="pf-add-row">
                <input className="pf-input" placeholder="Paste one of your best posts" value={brandExampleInput} onChange={e => setBrandExampleInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addBrandExample())} />
                <button className="pf-add-btn" onClick={() => addBrandExample()}>Add</button>
              </div>

              {/* Brand Memory & Style Lock */}
              <div style={{ height: 16 }} />
              <h3 className="pf-section-h" style={{ fontSize: 14 }}>Style Lock & Brand Memory</h3>
              <div className="pf-section-sub">
                Lock specific phrases, proofs, CTAs, or formats across all generated content to maintain brand consistency.
              </div>

              {/* Forbidden Phrases */}
              <div className="pf-label" id="pf-forbidden-label">Forbidden Phrases (Never use)</div>
              <div className="pf-tagrow" role="list" aria-labelledby="pf-forbidden-label">
                {forbiddenPhrases.length === 0
                  ? <span className="pf-tagrow-empty">No forbidden phrases locked</span>
                  : forbiddenPhrases.map(p => (
                    <span key={p} className="pf-tag" role="listitem" style={{ background: "rgba(240,154,154,0.1)", borderColor: "rgba(240,154,154,0.3)", color: "#f09a9a" }}>
                      "{p}"
                      <button className="pf-tag-x" onClick={() => setForbiddenPhrases(prev => prev.filter(x => x !== p))} aria-label={`Remove ${p}`} style={{ color: "rgba(240,154,154,0.6)" }}>×</button>
                    </span>
                  ))}
              </div>
              <div className="pf-add-row">
                <input
                  className="pf-input"
                  placeholder='+ e.g. "delight", "synergy", "game-changer"'
                  value={forbiddenPhraseInput}
                  onChange={e => setForbiddenPhraseInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addForbiddenPhrase())}
                  aria-label="New forbidden phrase"
                />
                <button className="pf-add-btn" onClick={addForbiddenPhrase}>Add</button>
              </div>

              {/* Proof Points */}
              <div className="pf-label" id="pf-proof-label">Key Proof Points & Data Points</div>
              <div className="pf-tagrow" role="list" aria-labelledby="pf-proof-label">
                {proofPoints.length === 0
                  ? <span className="pf-tagrow-empty">No proof points saved</span>
                  : proofPoints.map(p => (
                    <span key={p} className="pf-tag" role="listitem">
                      {p}
                      <button className="pf-tag-x" onClick={() => setProofPoints(prev => prev.filter(x => x !== p))} aria-label={`Remove ${p}`}>×</button>
                    </span>
                  ))}
              </div>
              <div className="pf-add-row">
                <input
                  className="pf-input"
                  placeholder="+ e.g. 10k+ active users, 99.9% uptime, bootstrapped"
                  value={proofPointInput}
                  onChange={e => setProofPointInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addProofPoint())}
                  aria-label="New proof point"
                />
                <button className="pf-add-btn" onClick={addProofPoint}>Add</button>
              </div>

              {/* Preferred CTAs */}
              <div className="pf-label" id="pf-cta-label">Preferred CTA Styles / Phrases</div>
              <div className="pf-tagrow" role="list" aria-labelledby="pf-cta-label">
                {ctaPreferences.length === 0
                  ? <span className="pf-tagrow-empty">No preferred CTAs saved</span>
                  : ctaPreferences.map(c => (
                    <span key={c} className="pf-tag" role="listitem">
                      {c}
                      <button className="pf-tag-x" onClick={() => setCtaPreferences(prev => prev.filter(x => x !== c))} aria-label={`Remove ${c}`}>×</button>
                    </span>
                  ))}
              </div>
              <div className="pf-add-row">
                <input
                  className="pf-input"
                  placeholder="+ e.g. DM to get the list, Try it for free"
                  value={ctaPreferenceInput}
                  onChange={e => setCtaPreferenceInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addCtaPreference())}
                  aria-label="New preferred CTA"
                />
                <button className="pf-add-btn" onClick={addCtaPreference}>Add</button>
              </div>

              {/* Preferred Structures */}
              <div className="pf-label" id="pf-structure-label">Preferred Formats / Structures</div>
              <div className="pf-tagrow" role="list" aria-labelledby="pf-structure-label">
                {preferredStructures.length === 0
                  ? <span className="pf-tagrow-empty">No preferred structures saved</span>
                  : preferredStructures.map(s => (
                    <span key={s} className="pf-tag" role="listitem">
                      {s}
                      <button className="pf-tag-x" onClick={() => setPreferredStructures(prev => prev.filter(x => x !== s))} aria-label={`Remove ${s}`}>×</button>
                    </span>
                  ))}
              </div>
              <div className="pf-add-row">
                <input
                  className="pf-input"
                  placeholder="+ e.g. before-after comparison, bulleted takeaways"
                  value={preferredStructureInput}
                  onChange={e => setPreferredStructureInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addPreferredStructure())}
                  aria-label="New preferred structure"
                />
                <button className="pf-add-btn" onClick={addPreferredStructure}>Add</button>
              </div>

              <div style={{ height: 8 }} />
              <h2 className="pf-section-h" style={{ marginTop: 14 }}>Hashtag policy</h2>
              <div className="pf-section-sub">
                Banned tags are stripped from every generated post. Required tags are appended automatically (up to each platform's natural limit).
              </div>

              <div className="pf-label">Banned hashtags ({bannedHashtags.length}/30)</div>
              <div className="pf-tagrow" role="list" aria-label="Banned hashtags">
                <AnimatePresence>
                  {bannedHashtags.length === 0 ? (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pf-tagrow-empty">No banned tags yet</motion.span>
                  ) : (
                    bannedHashtags.map(t => (
                      <motion.span layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ type: "spring", stiffness: 500, damping: 25 }} key={t} className="pf-tag" role="listitem" style={{ background: "rgba(240,154,154,0.1)", borderColor: "rgba(240,154,154,0.3)", color: "#f09a9a" }}>
                        {displayTag(t)}
                        <button className="pf-tag-x" onClick={() => removeTag("ban", t)} aria-label={`Remove ${displayTag(t)}`} style={{ color: "rgba(240,154,154,0.6)" }}>×</button>
                      </motion.span>
                    ))
                  )}
                </AnimatePresence>
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
                <AnimatePresence>
                  {requiredHashtags.length === 0 ? (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pf-tagrow-empty">No required tags yet</motion.span>
                  ) : (
                    requiredHashtags.map(t => (
                      <motion.span layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ type: "spring", stiffness: 500, damping: 25 }} key={t} className="pf-tag" role="listitem">
                        {displayTag(t)}
                        <button className="pf-tag-x" onClick={() => removeTag("req", t)} aria-label={`Remove ${displayTag(t)}`}>×</button>
                      </motion.span>
                    ))
                  )}
                </AnimatePresence>
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
      </WorkspacePage>
    </>
  );
}
