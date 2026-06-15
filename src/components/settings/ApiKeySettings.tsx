import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { saveUserApiKey, getUserApiKey, setUseOwnKey, deleteUserApiKey, getQuotaStatus } from "@/lib/apiKeyManager";
import { toast } from "sonner";
import { Eye, EyeOff, Save, Key, CheckCircle2, AlertCircle, Loader2, Trash2, ShieldCheck, Info, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";

export function ApiKeySettings() {
  const { canUseOwnKey, loading: subLoading } = useSubscription();
  const [provider, setProvider] = useState<'openai' | 'anthropic' | 'openrouter'>("openai");
  const [showKey, setShowKey] = useState(false);
  const [useOwnKey, setUseOwnKeyVal] = useState(false);
  const [keyMode, setKeyMode] = useState<'fallback' | 'always'>('fallback');
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [savedKeyPreview, setSavedKeyPreview] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [quota, setQuota] = useState<{ used: number; limit: number } | null>(null);

  const [customUrl, setCustomUrl] = useState(() => localStorage.getItem("contentforge_custom_supabase_url") || "");
  const [customKey, setCustomKey] = useState(() => localStorage.getItem("contentforge_custom_supabase_anon_key") || "");
  const [syncStatus, setSyncStatus] = useState<"default" | "custom_connected" | "custom_error" | "testing">("default");

  useEffect(() => {
    async function checkConnection() {
      const hasCustom = localStorage.getItem("contentforge_custom_supabase_url") && localStorage.getItem("contentforge_custom_supabase_anon_key");
      if (!hasCustom) {
        setSyncStatus("default");
        return;
      }
      setSyncStatus("testing");
      try {
        const { error } = await supabase.auth.getSession();
        if (error) {
          setSyncStatus("custom_error");
        } else {
          setSyncStatus("custom_connected");
        }
      } catch (e) {
        setSyncStatus("custom_error");
      }
    }
    checkConnection();
  }, []);

  const handleSaveCustomSupabase = () => {
    if (!customUrl.trim() || !customKey.trim()) {
      toast.error("Please enter both Supabase URL and Anon Key");
      return;
    }
    localStorage.setItem("contentforge_custom_supabase_url", customUrl.trim());
    localStorage.setItem("contentforge_custom_supabase_anon_key", customKey.trim());
    toast.success("Custom Supabase credentials saved! Refreshing page to connect…");
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  const handleClearCustomSupabase = () => {
    localStorage.removeItem("contentforge_custom_supabase_url");
    localStorage.removeItem("contentforge_custom_supabase_anon_key");
    setCustomUrl("");
    setCustomKey("");
    toast.success("Reset to default Supabase project! Refreshing page to connect…");
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  // Use uncontrolled input via ref to keep the raw key out of the React DevTools state tree
  const keyInputRef = useRef<HTMLInputElement>(null);

  // Load existing key settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await getUserApiKey();
        if (data.provider) setProvider(data.provider);
        setUseOwnKeyVal(data.useOwnKey);
        if (data.keyMode) setKeyMode(data.keyMode);
        if (data.apiKey) {
          // Mask the key: show only last 4 chars, e.g. ••••••••xQ3Z
          const last4 = data.apiKey.slice(-4);
          setSavedKeyPreview(`••••••••${last4}`);
        }
      } catch (err) {
        console.error("Failed to load user API key settings:", err);
      } finally {
        setFetching(false);
      }

      try {
        const q = await getQuotaStatus();
        setQuota({ used: q.used, limit: q.limit });
      } catch (err) {
        console.error("Failed to load quota status:", err);
      }
    }
    loadSettings();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatusMsg(null);

    try {
      const rawKey = keyInputRef.current?.value?.trim() ?? "";
      const isNewKey = rawKey && !rawKey.startsWith("••••");

      if (isNewKey) {
        await saveUserApiKey(rawKey, provider);
        const last4 = rawKey.slice(-4);
        setSavedKeyPreview(`••••••••${last4}`);
      }

      await setUseOwnKey(useOwnKey, keyMode);

      setStatusMsg({
        text: "API Key settings saved successfully!",
        type: "success"
      });
      toast.success("API Key settings saved!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save API key";
      setStatusMsg({
        text: msg === "INVALID_KEY_FORMAT"
          ? `Invalid key format for ${provider}. Please check your API key and try again.`
          : msg,
        type: "error"
      });
      toast.error(msg === "INVALID_KEY_FORMAT" ? "Invalid API key format" : "Failed to save API key settings");
    } finally {
      setLoading(false);
      // SECURITY: Clear raw key from the DOM input immediately after save (success or error)
      if (keyInputRef.current) {
        keyInputRef.current.value = "";
      }
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setStatusMsg(null);
    try {
      await deleteUserApiKey();
      setSavedKeyPreview(null);
      setUseOwnKeyVal(false);
      setConfirmDelete(false);
      if (keyInputRef.current) keyInputRef.current.value = "";
      setStatusMsg({ text: "API key removed successfully.", type: "success" });
      toast.success("API key removed.");
    } catch (err) {
      setStatusMsg({ text: err instanceof Error ? err.message : "Failed to remove key", type: "error" });
      toast.error("Failed to remove API key.");
    } finally {
      setDeleting(false);
    }
  }

  if (fetching) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#7a7a8e", fontSize: 13, padding: "20px 0" }}>
        <Loader2 className="animate-spin" size={16} />
        <span>Loading API key configurations...</span>
      </div>
    );
  }

  return (
    <>
      <div className="pf-card" style={{ marginTop: 14 }}>
      <h2 className="pf-section-h" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Key size={18} style={{ color: "#c8f09a" }} />
        <span>User API Key Fallback</span>
      </h2>

      {/* Inline Privacy Notice */}
      <div role="note" className="pf-notice">
        <ShieldCheck size={14} style={{ color: "#c8f09a", flexShrink: 0, marginTop: 1 }} />
        <span>
          Your API key is encrypted with AES-256 and stored securely. It is never logged, shared, or used for
          any purpose other than generating content on your behalf. You can delete it at any time.
        </span>
      </div>

      {quota && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#9a9aae", marginBottom: 4 }}>
            <span>Free generations used</span>
            <span>{Math.min(quota.used, quota.limit)} / {quota.limit}</span>
          </div>
          <div style={{ height: 6, borderRadius: 99, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${Math.min(100, (quota.used / quota.limit) * 100)}%`,
                background: quota.used >= quota.limit ? "#f09a9a" : "#c8f09a",
                transition: "width 0.3s ease",
              }}
            />
          </div>
          {quota.used >= quota.limit && !(useOwnKey && keyMode === 'always') && (
            <div role="alert" className="pf-notice" style={{ marginTop: 10, borderColor: "rgba(240, 154, 154, 0.2)" }}>
              <AlertCircle size={14} style={{ color: "#f09a9a", flexShrink: 0, marginTop: 1 }} />
              <span>
                You've used your free generations for now — more are coming soon! Add your own API key below and
                enable "Always use my key" to keep generating in the meantime.
              </span>
            </div>
          )}
        </div>
      )}

      <div className="pf-section-sub" style={{ marginBottom: 16 }}>
        Configure your own AI API key to be used as a fallback if the platform-level generation is rate-limited or unavailable.
      </div>

      {!subLoading && !canUseOwnKey ? (
        <div
          role="note"
          className="pf-notice"
          style={{ flexDirection: "column", alignItems: "flex-start", gap: 10, borderColor: "rgba(200,240,154,0.2)" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#edeae3", fontWeight: 600 }}>
            <Lock size={14} style={{ color: "#c8f09a" }} />
            <span>Using your own API key is a paid feature</span>
          </div>
          <span style={{ color: "#9a9aae" }}>
            Upgrade to <strong style={{ color: "#c8f09a" }}>Starter</strong> (or Pro) to securely store and use your own
            OpenAI, Anthropic, or OpenRouter key for content generation.
          </span>
          <Link to="/profile?tab=plan" className="pf-btn" style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
            <span>View plans</span>
          </Link>
        </div>
      ) : (
      <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {statusMsg && (
          <div
            role={statusMsg.type === "error" ? "alert" : "status"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 14px",
              borderRadius: "8px",
              fontSize: "12px",
              background: statusMsg.type === "error" ? "rgba(240, 154, 154, 0.08)" : "rgba(200, 240, 154, 0.08)",
              border: statusMsg.type === "error" ? "1px solid rgba(240, 154, 154, 0.2)" : "1px solid rgba(200, 240, 154, 0.2)",
              color: statusMsg.type === "error" ? "#f09a9a" : "#c8f09a",
            }}
          >
            {statusMsg.type === "error" ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
            <span>{statusMsg.text}</span>
          </div>
        )}

        <div>
          <label className="pf-label" htmlFor="api-provider">
            API Provider
          </label>
          <select
            id="api-provider"
            className="pf-select"
            value={provider}
            onChange={(e) => {
              const val = e.target.value as 'openai' | 'anthropic' | 'openrouter';
              setProvider(val);
              // Clear input when switching provider
              if (keyInputRef.current) keyInputRef.current.value = "";
            }}
            style={{ marginBottom: 0 }}
          >
            <option value="openai">OpenAI (GPT-4o / GPT-4o-mini)</option>
            <option value="anthropic">Anthropic (Claude 3.5 Sonnet / Haiku)</option>
            <option value="openrouter">OpenRouter (Any available models)</option>
          </select>
        </div>

        <div>
          <label className="pf-label" htmlFor="api-key">
            API Key
          </label>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <input
              id="api-key"
              ref={keyInputRef}
              type={showKey ? "text" : "password"}
              className="pf-input"
              placeholder={savedKeyPreview ? "Enter new API key to overwrite" : "sk-..."}
              style={{ paddingRight: "40px", marginBottom: 0 }}
              // SECURITY: Prevent password managers and OS spell-check from capturing the key
              autoComplete="new-password"
              data-1p-ignore
              data-lpignore="true"
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              aria-label={showKey ? "Hide API key" : "Show API key"}
              style={{
                position: "absolute",
                right: "12px",
                background: "none",
                border: "none",
                color: "#7a7a8e",
                cursor: "pointer",
                padding: 0,
                display: "flex",
                alignItems: "center"
              }}
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {savedKeyPreview && (
            <div style={{ fontSize: "11px", color: "#6a6a82", marginTop: "4px" }}>
              Currently configured key ends in <span className="font-mono">{savedKeyPreview.slice(-4)}</span>
            </div>
          )}
          {provider === "openai" && (
            <div style={{ fontSize: "11px", color: "#6a6a82", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
              <Info size={11} /> Format: <code>sk-...</code> (32+ characters)
            </div>
          )}
          {provider === "anthropic" && (
            <div style={{ fontSize: "11px", color: "#6a6a82", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
              <Info size={11} /> Format: <code>sk-ant-...</code>
            </div>
          )}
          {provider === "openrouter" && (
            <div style={{ fontSize: "11px", color: "#6a6a82", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
              <Info size={11} /> Format: <code>sk-or-...</code>
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "6px 0" }}>
          <input
            id="use-own-key"
            type="checkbox"
            checked={useOwnKey}
            onChange={(e) => setUseOwnKeyVal(e.target.checked)}
            style={{
              width: "16px",
              height: "16px",
              accentColor: "#c8f09a",
              cursor: "pointer",
            }}
          />
          <label
            htmlFor="use-own-key"
            style={{
              fontSize: "13px",
              color: "#edeae3",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            Enable custom API key
          </label>
        </div>

        {useOwnKey && (
          <div>
            <label className="pf-label" htmlFor="key-mode">
              Key usage mode
              <span className={`pf-mode-badge ${keyMode === 'always' ? 'active' : 'standby'}`}>
                {keyMode === 'always' ? 'Active' : 'Standby'}
              </span>
            </label>
            <div data-mode={keyMode === 'always' ? 'always' : undefined}>
              <select
                id="key-mode"
                className="pf-select"
                value={keyMode}
                onChange={(e) => setKeyMode(e.target.value as 'fallback' | 'always')}
                style={{ marginBottom: 0 }}
              >
                <option value="fallback">Fallback only — use my key when platform is unavailable</option>
                <option value="always">Always — use my key for all content generation</option>
              </select>
            </div>
            <div style={{ fontSize: "11px", color: "#6a6a82", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
              <Info size={11} />
              {keyMode === "always"
                ? "Your key will be used directly. Platform credits are not consumed."
                : "Your key activates only if the platform is rate-limited or unavailable."}
            </div>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
          <button
            type="submit"
            className="pf-btn"
            disabled={loading}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            {loading ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
            <span>{loading ? "Saving..." : "Save API configuration"}</span>
          </button>

          {savedKeyPreview && !confirmDelete && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: "13px",
                padding: "8px 14px",
                borderRadius: "8px",
                background: "rgba(240, 154, 154, 0.08)",
                border: "1px solid rgba(240, 154, 154, 0.2)",
                color: "#f09a9a",
                cursor: "pointer",
              }}
            >
              <Trash2 size={13} />
              <span>Remove Key</span>
            </button>
          )}

          {confirmDelete && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                borderRadius: "8px",
                background: "rgba(240, 154, 154, 0.08)",
                border: "1px solid rgba(240, 154, 154, 0.2)",
                fontSize: "12px",
                color: "#f09a9a",
              }}
            >
              <AlertCircle size={13} />
              <span>Are you sure? This cannot be undone.</span>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  background: "#f09a9a",
                  color: "#0a0a14",
                  border: "none",
                  borderRadius: "6px",
                  padding: "4px 10px",
                  fontSize: "11px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {deleting ? "Removing..." : "Yes, remove"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                style={{
                  background: "transparent",
                  color: "#7a7a8e",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "6px",
                  padding: "4px 10px",
                  fontSize: "11px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </form>
      )}
    </div>

      <div className="pf-card" style={{ marginTop: 24 }}>
        <h2 className="pf-section-h" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ShieldCheck size={18} style={{ color: "#c8f09a" }} />
            <span>Custom Supabase Sync</span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {syncStatus === "default" && (
              <span style={{ fontSize: 10, padding: "2px 8px", background: "rgba(255,255,255,0.06)", color: "var(--text3)", border: "1px solid var(--border2)", borderRadius: 99 }}>
                Default Project
              </span>
            )}
            {syncStatus === "testing" && (
              <span style={{ fontSize: 10, padding: "2px 8px", background: "rgba(255,255,255,0.03)", color: "var(--text2)", border: "1px solid var(--border2)", borderRadius: 99 }}>
                Connecting…
              </span>
            )}
            {syncStatus === "custom_connected" && (
              <span style={{ fontSize: 10, padding: "2px 8px", background: "rgba(200,240,154,0.12)", color: "var(--accent)", border: "1px solid rgba(200,240,154,0.2)", borderRadius: 99 }}>
                🟢 Connected to Custom DB
              </span>
            )}
            {syncStatus === "custom_error" && (
              <span style={{ fontSize: 10, padding: "2px 8px", background: "rgba(240,154,154,0.12)", color: "var(--err)", border: "1px solid rgba(240,154,154,0.2)", borderRadius: 99 }}>
                🔴 Connection Failed
              </span>
            )}
          </div>
        </h2>

        <div className="pf-section-sub" style={{ marginBottom: 16 }}>
          Sync your saved calendars and personas to your own private Supabase instance instead of the default project. Requires a page refresh to apply.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label className="pf-label" htmlFor="supabase-url">
              Supabase Project URL
            </label>
            <input
              id="supabase-url"
              type="text"
              className="pf-input"
              value={customUrl}
              onChange={e => setCustomUrl(e.target.value)}
              placeholder="https://your-project.supabase.co"
              style={{ marginBottom: 0 }}
            />
          </div>

          <div>
            <label className="pf-label" htmlFor="supabase-key">
              Supabase Anon Key
            </label>
            <input
              id="supabase-key"
              type="password"
              className="pf-input"
              value={customKey}
              onChange={e => setCustomKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              style={{ marginBottom: 0 }}
            />
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button
              type="button"
              className="pf-btn"
              onClick={handleSaveCustomSupabase}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <Save size={14} />
              <span>Save sync credentials</span>
            </button>
            {(customUrl || customKey) && (
              <button
                type="button"
                className="pf-btn ghost"
                onClick={handleClearCustomSupabase}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "rgba(240, 154, 154, 0.08)",
                  border: "1px solid rgba(240, 154, 154, 0.2)",
                  color: "#f09a9a",
                  cursor: "pointer",
                }}
              >
                <Trash2 size={13} />
                <span>Reset to default</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
