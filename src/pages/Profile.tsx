import { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const css = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;1,400&family=Sora:wght@300;400;500;600&display=swap');
.pf-app { min-height:100vh; background:#07080d; color:#edeae3; font-family:'Sora',sans-serif; padding:40px 24px 100px; }
.pf-inner { max-width:560px; margin:0 auto; }
.pf-back { font-size:12px; color:#7a7a8e; text-decoration:none; }
.pf-back:hover { color:#c8f09a; }
.pf-title { font-family:'Playfair Display',serif; font-size:28px; font-weight:400; margin:14px 0 6px; }
.pf-sub { font-size:13px; color:#7a7a8e; margin-bottom:28px; }
.pf-card { background:#0d0f18; border:1px solid rgba(255,255,255,0.055); border-radius:16px; padding:28px; }
.pf-row { display:flex; align-items:center; gap:18px; margin-bottom:24px; }
.pf-avatar { width:80px; height:80px; border-radius:50%; background:#07080d; border:1px solid rgba(255,255,255,0.1); object-fit:cover; display:flex; align-items:center; justify-content:center; font-family:'Playfair Display',serif; font-size:28px; color:#7a7a8e; }
.pf-uplabel { font-size:12px; color:#c8f09a; cursor:pointer; padding:7px 12px; border:1px solid rgba(200,240,154,0.32); border-radius:8px; background:rgba(200,240,154,0.06); display:inline-block; }
.pf-uplabel:hover { background:rgba(200,240,154,0.12); }
.pf-label { font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:#7a7a8e; margin-bottom:7px; font-weight:500; }
.pf-input { width:100%; background:#07080d; border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:11px 13px; font-size:13px; color:#edeae3; font-family:'Sora',sans-serif; font-weight:300; outline:none; box-sizing:border-box; margin-bottom:16px; }
.pf-input:focus { border-color:rgba(200,240,154,0.28); }
.pf-input:disabled { opacity:.6; cursor:not-allowed; }
.pf-btn { padding:11px 18px; border-radius:8px; font-size:13px; font-weight:500; cursor:pointer; border:none; background:#c8f09a; color:#07080d; }
.pf-btn:disabled { opacity:.5; cursor:not-allowed; }
.pf-meta { font-size:11px; color:#3a3a50; margin-top:10px; }
`;

export default function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name, avatar_url").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        setDisplayName(data?.display_name || "");
        setAvatarUrl(data?.avatar_url || "");
        setLoading(false);
      });
  }, [user]);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("Image must be under 2MB");
    setUploading(true);

    // Remember previous avatar so we can clean it up after a successful save.
    const previousUrl = avatarUrl;

    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (upErr) { setUploading(false); return toast.error(upErr.message); }

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const newUrl = data.publicUrl;

    // Auto-persist the avatar URL so the upload isn't orphaned if the user navigates away.
    const { error: updErr } = await supabase.from("profiles")
      .update({ avatar_url: newUrl })
      .eq("user_id", user.id);

    if (updErr) {
      // Roll back the storage object on DB failure.
      await supabase.storage.from("avatars").remove([path]);
      setUploading(false);
      return toast.error(updErr.message);
    }

    setAvatarUrl(newUrl);

    // Best-effort: delete the previous avatar object owned by this user.
    if (previousUrl) {
      const marker = `/avatars/${user.id}/`;
      const idx = previousUrl.indexOf(marker);
      if (idx !== -1) {
        const oldPath = previousUrl.slice(idx + "/avatars/".length);
        // Fire-and-forget; don't block UX on cleanup failures.
        void supabase.storage.from("avatars").remove([oldPath]);
      }
    }

    // Reset the file input so the same file can be re-selected later.
    if (fileRef.current) fileRef.current.value = "";

    setUploading(false);
    toast.success("Avatar updated");
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles")
      .update({ display_name: displayName, avatar_url: avatarUrl })
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
          <div className="pf-sub">Update how you appear inside ContentForge.</div>

          <div className="pf-card">
            {loading ? (
              <div style={{ color: "#7a7a8e", fontSize: 13 }}>Loading…</div>
            ) : (
              <>
                <div className="pf-row">
                  {avatarUrl
                    ? <img className="pf-avatar" src={avatarUrl} alt="avatar" />
                    : <div className="pf-avatar">{initial}</div>}
                  <div>
                    <label className="pf-uplabel">
                      {uploading ? "Uploading…" : "Upload new avatar"}
                      <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: "none" }} disabled={uploading} />
                    </label>
                    <div className="pf-meta">PNG or JPG, up to 2MB.</div>
                  </div>
                </div>

                <div className="pf-label">Display name</div>
                <input className="pf-input" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" />

                <div className="pf-label">Email</div>
                <input className="pf-input" value={user?.email || ""} disabled />

                <button className="pf-btn" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
