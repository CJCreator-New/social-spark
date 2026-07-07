import React, { useState, useEffect, useRef } from "react";

import {
  saveUserApiKey,
  getUserApiKey,
  setUseOwnKey,
  deleteUserApiKey,
  getQuotaStatus,
  validateUserApiKey,
  updateUserApiModel,
  type ApiProvider,
} from "@/lib/apiKeyManager";
import {
  MODEL_CATALOG,
  getOpenRouterGroups,
  OPENROUTER_FREE_RATE_LIMIT_NOTE,
  CUSTOM_MODEL_SENTINEL,
} from "@/lib/models/catalogs";
import { toast } from "sonner";
import {
  Eye,
  EyeOff,
  Save,
  Key,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  ShieldCheck,
  Info,
  BadgeCheck,
} from "lucide-react";

export function ApiKeySettings() {
  const [provider, setProvider] = useState<ApiProvider>("openai");
  const [model, setModel] = useState<string>("");
  const [customModel, setCustomModel] = useState<string>("");
  const [savedModel, setSavedModel] = useState<string>("");
  const [showKey, setShowKey] = useState(false);
  const [useOwnKey, setUseOwnKeyVal] = useState(false);
  const [keyMode, setKeyMode] = useState<"fallback" | "always">("fallback");
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ valid: boolean; reason?: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [savedKeyPreview, setSavedKeyPreview] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error" } | null>(
    null
  );
  const [quota, setQuota] = useState<{
    used: number;
    limit: number;
    planPeriodEnd: string | null;
  } | null>(null);
  const [keyFieldState, setKeyFieldState] = useState<"empty" | "masked" | "filled">("empty");
  const [settingsError, setSettingsError] = useState(false);

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
        setSettingsError(Boolean(data.settingsError));
        if (data.apiModel) {
          const catalogIds = data.provider ? MODEL_CATALOG[data.provider].map((m) => m.id) : [];
          if (catalogIds.includes(data.apiModel)) {
            setModel(data.apiModel);
          } else {
            setModel(CUSTOM_MODEL_SENTINEL);
            setCustomModel(data.apiModel);
          }
          setSavedModel(data.apiModel);
        }
        if (data.hasKey && data.last4) {
          const maskedValue = `••••••••${data.last4}`;
          setSavedKeyPreview(maskedValue);
          setKeyFieldState("empty");
        }
      } catch (err) {
        console.error("Failed to load user API key settings:", err);
      } finally {
        setFetching(false);
      }

      try {
        const q = await getQuotaStatus();
        setQuota({ used: q.used, limit: q.limit, planPeriodEnd: q.planPeriodEnd });
      } catch (err) {
        console.error("Failed to load quota status:", err);
      }
    }
    loadSettings();
  }, []);

  // Turns a validation reason into something friendly to show the user.
  function validationMessage(reason?: string): string {
    if (reason === "INVALID_KEY_FORMAT") {
      return `Invalid key format for ${provider}. Please check your API key and try again.`;
    }
    return reason || "This key could not be verified.";
  }

  // The effective model id to persist/send: custom text input when the
  // "Custom model id..." sentinel is selected, otherwise the picked catalog id.
  function effectiveModel(): string {
    if (model === CUSTOM_MODEL_SENTINEL) return customModel.trim();
    return model;
  }

  // Live "Test key" — verifies the entered key against the provider without saving it.
  async function handleTest() {
    const rawKey = keyInputRef.current?.value?.trim() ?? "";
    if (!rawKey || rawKey.startsWith("••••")) {
      toast.error("Enter an API key to test.");
      return;
    }

    setTesting(true);
    setTestResult(null);
    setStatusMsg(null);
    try {
      const result = await validateUserApiKey(rawKey, provider, effectiveModel() || undefined);
      setTestResult(result);
      if (result.valid) {
        toast.success("API key verified — it works!");
      } else {
        toast.error("API key check failed.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Validation failed";
      setTestResult({ valid: false, reason: msg });
      toast.error("Couldn't verify the key. Please try again.");
    } finally {
      setTesting(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatusMsg(null);

    try {
      const rawKey = keyInputRef.current?.value?.trim() ?? "";
      const isNewKey = rawKey && !rawKey.startsWith("••••");
      const hasSavedKey = !!savedKeyPreview;

      if (useOwnKey && !isNewKey && !hasSavedKey) {
        toast.error("Please enter an API key to enable custom API key fallback.");
        setLoading(false);
        return;
      }

      const chosenModel = effectiveModel();

      if (isNewKey) {
        // Verify the key against the provider before storing it, so we never
        // persist a dud that would silently fail at generation time.
        const check = await validateUserApiKey(rawKey, provider, chosenModel || undefined);
        if (!check.valid) {
          setTestResult(check);
          setStatusMsg({ text: validationMessage(check.reason), type: "error" });
          toast.error(
            check.reason === "INVALID_KEY_FORMAT"
              ? "Invalid API key format"
              : "API key check failed"
          );
          setLoading(false);
          return;
        }
        await saveUserApiKey(rawKey, provider, chosenModel || undefined);
        const last4 = rawKey.slice(-4);
        setSavedKeyPreview(`••••••••${last4}`);
        setKeyFieldState("empty");
        setTestResult(null);
        setSavedModel(chosenModel);
      } else if (hasSavedKey && chosenModel !== savedModel) {
        // Key is unchanged (still masked) but the model selection changed —
        // update just the model preference without re-sending the key.
        await updateUserApiModel(chosenModel || null);
        setSavedModel(chosenModel);
      }

      await setUseOwnKey(useOwnKey, keyMode);

      setStatusMsg({
        text: "API Key settings saved successfully!",
        type: "success",
      });
      toast.success("API Key settings saved!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save API key";
      setStatusMsg({
        text:
          msg === "INVALID_KEY_FORMAT"
            ? `Invalid key format for ${provider}. Please check your API key and try again.`
            : msg,
        type: "error",
      });
      toast.error(
        msg === "INVALID_KEY_FORMAT" ? "Invalid API key format" : "Failed to save API key settings"
      );
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
      setKeyFieldState("empty");
      setModel("");
      setCustomModel("");
      setSavedModel("");
      setConfirmDelete(false);
      if (keyInputRef.current) keyInputRef.current.value = "";
      setStatusMsg({ text: "API key removed successfully.", type: "success" });
      toast.success("API key removed.");
    } catch (err) {
      setStatusMsg({
        text: err instanceof Error ? err.message : "Failed to remove key",
        type: "error",
      });
      toast.error("Failed to remove API key.");
    } finally {
      setDeleting(false);
    }
  }

  if (fetching) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: "var(--color-text-secondary)",
          fontSize: 13,
          padding: "20px 0",
        }}
      >
        <Loader2 className="animate-spin" size={16} style={{ color: "var(--color-primary)" }} />
        <span>Loading API key configurations...</span>
      </div>
    );
  }

  return (
    <>
      <div className="pf-card" style={{ marginTop: 14 }}>
        <h2 className="pf-section-h" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Key size={18} style={{ color: "var(--color-primary)" }} />
          <span>User API Key Fallback</span>
        </h2>

        {/* Inline Privacy Notice */}
        <div role="note" className="pf-notice">
          <ShieldCheck
            size={14}
            style={{ color: "var(--color-primary)", flexShrink: 0, marginTop: 1 }}
          />
          <span>
            Your API key is encrypted with AES-256 and stored securely. It is never logged, shared,
            or used for any purpose other than generating content on your behalf. You can delete it
            at any time.
          </span>
        </div>

        {quota && (
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12,
                color: "var(--color-text-muted)",
                marginBottom: 4,
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <span>Monthly platform generations used</span>
              <span>
                {Math.min(quota.used, quota.limit)} / {quota.limit}
              </span>
            </div>
            <div
              style={{
                height: 6,
                borderRadius: 99,
                background: "var(--color-border)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(100, (quota.used / quota.limit) * 100)}%`,
                  background:
                    quota.used >= quota.limit ? "var(--color-error)" : "var(--color-success)",
                  transition: "width 0.3s ease",
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
                marginTop: 6,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                Resets{" "}
                {quota.planPeriodEnd
                  ? new Intl.DateTimeFormat(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    }).format(new Date(quota.planPeriodEnd))
                  : "next month"}
              </span>
              {settingsError && (
                <span
                  style={{
                    fontSize: 10,
                    padding: "2px 8px",
                    background: "var(--color-primary-light)",
                    color: "var(--color-warning-text)",
                    border: "1px solid var(--color-warning-border)",
                    borderRadius: 99,
                  }}
                >
                  Settings row unavailable
                </span>
              )}
            </div>
            {quota.used >= quota.limit && !(useOwnKey && keyMode === "always") && (
              <div
                role="alert"
                className="pf-notice"
                style={{
                  marginTop: 10,
                  borderColor: "rgba(239,68,68,0.2)",
                  background: "var(--color-error-bg)",
                }}
              >
                <AlertCircle
                  size={14}
                  style={{ color: "var(--color-error-text)", flexShrink: 0, marginTop: 1 }}
                />
                <span>
                  You've used your platform generations for this month. Upgrade for more credits, or
                  add your own API key below and enable "Always use my key" to keep generating at no
                  platform cost.
                </span>
              </div>
            )}
          </div>
        )}

        <div className="pf-section-sub" style={{ marginBottom: 16 }}>
          Configure your own AI API key to be used as a fallback if the platform-level generation is
          rate-limited or unavailable.
        </div>

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
                background:
                  statusMsg.type === "error" ? "var(--color-error-bg)" : "var(--color-success-bg)",
                border:
                  statusMsg.type === "error"
                    ? "1px solid var(--color-error-border)"
                    : "1px solid var(--color-success-border)",
                color:
                  statusMsg.type === "error"
                    ? "var(--color-error-text)"
                    : "var(--color-success-text)",
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
                const val = e.target.value as ApiProvider;
                setProvider(val);
                // Clear input and any stale test result when switching provider
                if (keyInputRef.current) keyInputRef.current.value = "";
                setKeyFieldState("empty");
                setTestResult(null);
                // Clear model selection — a model id from another provider is
                // never valid on the new provider's endpoint.
                setModel("");
                setCustomModel("");
              }}
              style={{ marginBottom: 0 }}
            >
              <option value="openai">OpenAI (GPT-5 / GPT-4o)</option>
              <option value="anthropic">Anthropic (Claude Sonnet / Haiku)</option>
              <option value="openrouter">OpenRouter (Many models, free &amp; paid)</option>
              <option value="gemini">Gemini (Google, direct)</option>
              <option value="kimi">Kimi (Moonshot AI)</option>
              <option value="glm">GLM (Zhipu AI)</option>
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
                // Clear any stale verification result once the key is edited
                onChange={() => {
                  const value = keyInputRef.current?.value?.trim() ?? "";
                  setKeyFieldState(
                    !value ? "empty" : value.startsWith("••••") ? "masked" : "filled"
                  );
                  if (testResult) setTestResult(null);
                }}
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
                  color: "var(--color-text-secondary)",
                  cursor: "pointer",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {savedKeyPreview && (
              <div
                style={{ fontSize: "11px", color: "var(--color-text-secondary)", marginTop: "4px" }}
              >
                Currently configured key ends in{" "}
                <span className="font-mono">{savedKeyPreview.slice(-4)}</span>
              </div>
            )}
            {provider === "openai" && (
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--color-text-secondary)",
                  marginTop: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Info size={11} /> Format: <code>sk-...</code> (32+ characters)
              </div>
            )}
            {provider === "anthropic" && (
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--color-text-secondary)",
                  marginTop: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Info size={11} /> Format: <code>sk-ant-...</code>
              </div>
            )}
            {provider === "openrouter" && (
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--color-text-secondary)",
                  marginTop: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Info size={11} /> Format: <code>sk-or-...</code>
              </div>
            )}
            {provider === "gemini" && (
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--color-text-secondary)",
                  marginTop: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Info size={11} /> Format: <code>AIza...</code>
              </div>
            )}
            {provider === "kimi" && (
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--color-text-secondary)",
                  marginTop: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Info size={11} /> Format: <code>sk-...</code> (Moonshot platform key)
              </div>
            )}
            {provider === "glm" && (
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--color-text-secondary)",
                  marginTop: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Info size={11} /> Format: <code>id.secret</code> (Zhipu API key)
              </div>
            )}

            {/* Live key validation */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginTop: 10,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={handleTest}
                disabled={testing || keyFieldState !== "filled"}
                className="pf-btn ghost"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  padding: "6px 12px",
                }}
              >
                {testing ? (
                  <Loader2 className="animate-spin" size={13} />
                ) : (
                  <BadgeCheck size={13} />
                )}
                <span>{testing ? "Testing…" : "Test key"}</span>
              </button>
              {testResult && (
                <span
                  role="status"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    color: testResult.valid
                      ? "var(--color-success-text)"
                      : "var(--color-error-text)",
                  }}
                >
                  {testResult.valid ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                  <span>
                    {testResult.valid
                      ? "Key verified — it works!"
                      : validationMessage(testResult.reason)}
                  </span>
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="pf-label" htmlFor="api-model">
              Model
            </label>
            <select
              id="api-model"
              className="pf-select"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              style={{ marginBottom: 0 }}
            >
              <option value="">Use provider default</option>
              {provider === "openrouter"
                ? getOpenRouterGroups().map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.models.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </optgroup>
                  ))
                : MODEL_CATALOG[provider].map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
              <option value={CUSTOM_MODEL_SENTINEL}>Custom model id...</option>
            </select>
            {model === CUSTOM_MODEL_SENTINEL && (
              <input
                type="text"
                className="pf-input"
                placeholder="Enter a model id"
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                style={{ marginTop: 8, marginBottom: 0 }}
              />
            )}
            {provider === "openrouter" && model.endsWith(":free") && (
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--color-text-secondary)",
                  marginTop: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Info size={11} /> {OPENROUTER_FREE_RATE_LIMIT_NOTE}
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
                accentColor: "var(--color-primary)",
                cursor: "pointer",
              }}
            />
            <label
              htmlFor="use-own-key"
              style={{
                fontSize: "13px",
                color: "var(--color-text)",
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
                <span className={`pf-mode-badge ${keyMode === "always" ? "active" : "standby"}`}>
                  {keyMode === "always" ? "Active" : "Standby"}
                </span>
              </label>
              <div data-mode={keyMode === "always" ? "always" : undefined}>
                <select
                  id="key-mode"
                  className="pf-select"
                  value={keyMode}
                  onChange={(e) => setKeyMode(e.target.value as "fallback" | "always")}
                  style={{ marginBottom: 0 }}
                >
                  <option value="fallback">
                    Fallback only — use my key when platform is unavailable
                  </option>
                  <option value="always">Always — use my key for all content generation</option>
                </select>
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--color-text-secondary)",
                  marginTop: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Info size={11} />
                {keyMode === "always"
                  ? "Your key will be used directly. Platform credits are not consumed."
                  : "Your key activates only if the platform is rate-limited or unavailable."}
              </div>
            </div>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 8,
              flexWrap: "wrap",
            }}
          >
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
                  background: "var(--color-error-bg)",
                  border: "1px solid var(--color-error-border)",
                  color: "var(--color-error-text)",
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
                  background: "var(--color-error-bg)",
                  border: "1px solid var(--color-error-border)",
                  fontSize: "12px",
                  color: "var(--color-error-text)",
                }}
              >
                <AlertCircle size={13} />
                <span>Are you sure? This cannot be undone.</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{
                    background: "var(--color-error)",
                    color: "var(--color-surface)",
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
                    color: "var(--color-text-secondary)",
                    border: "1px solid var(--color-border-strong)",
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
      </div>
    </>
  );
}
