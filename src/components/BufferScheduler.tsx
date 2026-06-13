import React, { useState } from "react";
import { toast } from "sonner";
import type { Post } from "@/components/wizard/constants";
import { formatForPlatform, niceLabelFor } from "@/lib/platformCopy";
import { FontStyle } from "@/lib/unicodeFonts";

interface BufferSchedulerProps {
  posts: Post[];
  platform: string;
  postTimes?: Record<string, string>;
}

interface ScheduleResult {
  day: number;
  status: "pending" | "success" | "error";
  message?: string;
}

const BUFFER_KEY_STORAGE = "contentforge_buffer_api_key";
const HOOTSUITE_KEY_STORAGE = "contentforge_hootsuite_api_key";

const BUFFER_PROFILE_STORAGE = "contentforge_buffer_profile_id";
const HOOTSUITE_PROFILE_STORAGE = "contentforge_hootsuite_profile_id";

function buildPostText(post: Post, platform: string): string {
  const f = formatForPlatform(post, platform, { style: FontStyle.None });
  return f.text;
}

export const BufferScheduler: React.FC<BufferSchedulerProps> = ({ posts, platform, postTimes = {} }) => {
  const [schedulerType, setSchedulerType] = useState<"buffer" | "hootsuite">("buffer");
  
  const [bufferKey, setBufferKey] = useState(() => localStorage.getItem(BUFFER_KEY_STORAGE) || "");
  const [hootsuiteKey, setHootsuiteKey] = useState(() => localStorage.getItem(HOOTSUITE_KEY_STORAGE) || "");
  
  const [bufferProfileId, setBufferProfileId] = useState(() => localStorage.getItem(BUFFER_PROFILE_STORAGE) || "");
  const [hootsuiteProfileId, setHootsuiteProfileId] = useState(() => localStorage.getItem(HOOTSUITE_PROFILE_STORAGE) || "");

  const [open, setOpen] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [results, setResults] = useState<ScheduleResult[]>([]);
  
  const [bufferKeySaved, setBufferKeySaved] = useState(!!localStorage.getItem(BUFFER_KEY_STORAGE));
  const [hootsuiteKeySaved, setHootsuiteKeySaved] = useState(!!localStorage.getItem(HOOTSUITE_KEY_STORAGE));

  const saveBufferKey = () => {
    if (bufferKey.trim()) {
      localStorage.setItem(BUFFER_KEY_STORAGE, bufferKey.trim());
      setBufferKeySaved(true);
      toast.success("Buffer API key saved locally ✓");
    }
  };

  const clearBufferKey = () => {
    localStorage.removeItem(BUFFER_KEY_STORAGE);
    setBufferKey("");
    setBufferKeySaved(false);
  };

  const saveHootsuiteKey = () => {
    if (hootsuiteKey.trim()) {
      localStorage.setItem(HOOTSUITE_KEY_STORAGE, hootsuiteKey.trim());
      setHootsuiteKeySaved(true);
      toast.success("Hootsuite API key saved locally ✓");
    }
  };

  const clearHootsuiteKey = () => {
    localStorage.removeItem(HOOTSUITE_KEY_STORAGE);
    setHootsuiteKey("");
    setHootsuiteKeySaved(false);
  };

  const scheduleAll = async () => {
    const isBuffer = schedulerType === "buffer";
    const apiKey = isBuffer ? bufferKey : hootsuiteKey;
    const profileId = isBuffer ? bufferProfileId : hootsuiteProfileId;

    if (!apiKey.trim()) { toast.error(`Enter your ${isBuffer ? "Buffer" : "Hootsuite"} API key first`); return; }
    if (!profileId.trim()) { toast.error(`Enter your ${isBuffer ? "Buffer" : "Hootsuite"} Profile ID first`); return; }

    // Save profile IDs to localStorage on schedule
    if (isBuffer) {
      localStorage.setItem(BUFFER_PROFILE_STORAGE, profileId.trim());
    } else {
      localStorage.setItem(HOOTSUITE_PROFILE_STORAGE, profileId.trim());
    }

    setScheduling(true);
    const initResults: ScheduleResult[] = posts.map(p => ({ day: p.day, status: "pending" }));
    setResults(initResults);

    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      const text = buildPostText(post, platform);
      const scheduledAt = postTimes[String(post.day)]
        ? `${new Date().toISOString().slice(0, 10)}T${postTimes[String(post.day)]}:00`
        : undefined;

      try {
        let response: Response;
        if (isBuffer) {
          const body: Record<string, any> = {
            profile_ids: [profileId.trim()],
            text,
          };
          if (scheduledAt) {
            body.scheduled_at = scheduledAt;
          }
          if (post.image_url) {
            body["media[picture]"] = post.image_url;
            body["media[thumbnail]"] = post.image_url;
          }

          response = await fetch("https://api.bufferapp.com/1/updates/create.json", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey.trim()}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams(
              Object.entries(body).flatMap(([k, v]) =>
                Array.isArray(v) ? v.map((val) => [k + "[]", String(val)]) : [[k, String(v)]]
              )
            ).toString(),
          });
        } else {
          // Hootsuite API call
          response = await fetch("https://platform.hootsuite.com/v1/messages", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey.trim()}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text,
              socialProfileIds: [profileId.trim()],
              ...(scheduledAt ? { scheduledSendTime: new Date(scheduledAt).toISOString() } : {}),
              ...(post.image_url ? { media: [{ url: post.image_url }] } : {}),
            }),
          });
        }

        if (response.ok) {
          setResults(prev => prev.map(r => r.day === post.day ? { ...r, status: "success", message: "Scheduled ✓" } : r));
        } else {
          const errData = await response.json().catch(() => ({}));
          setResults(prev => prev.map(r => r.day === post.day ? { ...r, status: "error", message: errData?.error || `HTTP ${response.status}` } : r));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Network error";
        setResults(prev => prev.map(r => r.day === post.day ? { ...r, status: "error", message: msg } : r));
      }

      // Small delay between API calls to avoid rate limiting
      if (i < posts.length - 1) await new Promise(r => setTimeout(r, 400));
    }

    setScheduling(false);
    const successCount = results.filter(r => r.status === "success").length;
    toast.success(`${successCount}/${posts.length} posts pushed to ${isBuffer ? "Buffer" : "Hootsuite"}`);
  };

  return (
    <div style={{ marginTop: 8 }}>
      <button
        type="button"
        className="cpbtn"
        onClick={() => setOpen(v => !v)}
        title="Push posts to Buffer or Hootsuite"
      >
        📤 Schedule to Buffer / Hootsuite {open ? "▲" : "▼"}
      </button>

      {open && (
        <div style={{
          marginTop: 8, padding: "16px", background: "var(--surface)",
          border: "1px solid var(--border)", borderRadius: 12,
          display: "flex", flexDirection: "column", gap: 12,
          minWidth: 320,
        }}>
          {/* Tab selector for Buffer vs Hootsuite */}
          <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
            <button
              type="button"
              className="cpbtn"
              style={{
                flex: 1, padding: "6px", fontSize: 11,
                background: schedulerType === "buffer" ? "rgba(200,240,154,0.12)" : "transparent",
                borderColor: schedulerType === "buffer" ? "#c8f09a" : "rgba(255,255,255,0.1)",
                color: schedulerType === "buffer" ? "var(--accent)" : "var(--text2)",
              }}
              onClick={() => setSchedulerType("buffer")}
            >
              Buffer
            </button>
            <button
              type="button"
              className="cpbtn"
              style={{
                flex: 1, padding: "6px", fontSize: 11,
                background: schedulerType === "hootsuite" ? "rgba(200,240,154,0.12)" : "transparent",
                borderColor: schedulerType === "hootsuite" ? "#c8f09a" : "rgba(255,255,255,0.1)",
                color: schedulerType === "hootsuite" ? "var(--accent)" : "var(--text2)",
              }}
              onClick={() => setSchedulerType("hootsuite")}
            >
              Hootsuite
            </button>
          </div>

          <div style={{ fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--text2)", fontWeight: 500 }}>
            {schedulerType === "buffer" ? "Buffer Scheduler" : "Hootsuite Scheduler"}
          </div>

          {schedulerType === "buffer" ? (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 11, color: "var(--text3)" }}>
                  Buffer API Access Token{" "}
                  <a href="https://buffer.com/developers/api" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
                    (get yours →)
                  </a>
                </label>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    type="password"
                    value={bufferKey}
                    onChange={e => setBufferKey(e.target.value)}
                    placeholder="Enter Buffer API access token…"
                    style={{
                      flex: 1, background: "var(--bg)", border: "1px solid var(--border2)",
                      borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "var(--text)",
                      fontFamily: "var(--font-body)", outline: "none",
                    }}
                  />
                  <button type="button" className="cpbtn done" style={{ fontSize: 11, padding: "5px 10px" }} onClick={saveBufferKey}>
                    Save
                  </button>
                  {bufferKeySaved && (
                    <button type="button" className="cpbtn" style={{ fontSize: 11, padding: "5px 10px", color: "var(--err)" }} onClick={clearBufferKey}>
                      Clear
                    </button>
                  )}
                </div>
                {bufferKeySaved && <div style={{ fontSize: 10, color: "var(--accent)", opacity: 0.75 }}>✓ API key saved locally</div>}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 11, color: "var(--text3)" }}>
                  Buffer Profile ID{" "}
                  <span style={{ color: "var(--text3)", opacity: 0.7 }}>(find in Buffer URL)</span>
                </label>
                <input
                  type="text"
                  value={bufferProfileId}
                  onChange={e => setBufferProfileId(e.target.value)}
                  placeholder="e.g. 4eb854340acb04e870000010"
                  style={{
                    background: "var(--bg)", border: "1px solid var(--border2)",
                    borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "var(--text)",
                    fontFamily: "var(--font-body)", outline: "none",
                  }}
                />
              </div>
            </>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 11, color: "var(--text3)" }}>
                  Hootsuite API Client Credential Token{" "}
                  <a href="https://platform.hootsuite.com/docs/api" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
                    (get yours →)
                  </a>
                </label>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    type="password"
                    value={hootsuiteKey}
                    onChange={e => setHootsuiteKey(e.target.value)}
                    placeholder="Enter Hootsuite API key…"
                    style={{
                      flex: 1, background: "var(--bg)", border: "1px solid var(--border2)",
                      borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "var(--text)",
                      fontFamily: "var(--font-body)", outline: "none",
                    }}
                  />
                  <button type="button" className="cpbtn done" style={{ fontSize: 11, padding: "5px 10px" }} onClick={saveHootsuiteKey}>
                    Save
                  </button>
                  {hootsuiteKeySaved && (
                    <button type="button" className="cpbtn" style={{ fontSize: 11, padding: "5px 10px", color: "var(--err)" }} onClick={clearHootsuiteKey}>
                      Clear
                    </button>
                  )}
                </div>
                {hootsuiteKeySaved && <div style={{ fontSize: 10, color: "var(--accent)", opacity: 0.75 }}>✓ API key saved locally</div>}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 11, color: "var(--text3)" }}>
                  Hootsuite Social Profile ID{" "}
                  <span style={{ color: "var(--text3)", opacity: 0.7 }}>(find in Hootsuite developer portal)</span>
                </label>
                <input
                  type="text"
                  value={hootsuiteProfileId}
                  onChange={e => setHootsuiteProfileId(e.target.value)}
                  placeholder="e.g. 12345678"
                  style={{
                    background: "var(--bg)", border: "1px solid var(--border2)",
                    borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "var(--text)",
                    fontFamily: "var(--font-body)", outline: "none",
                  }}
                />
              </div>
            </>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
            <div style={{ fontSize: 11, color: "var(--text3)" }}>
              {posts.length} posts · {niceLabelFor(platform)}
            </div>
            <button
              type="button"
              className="cpbtn done"
              onClick={scheduleAll}
              disabled={scheduling || (schedulerType === "buffer" ? (!bufferKey.trim() || !bufferProfileId.trim()) : (!hootsuiteKey.trim() || !hootsuiteProfileId.trim()))}
              style={{ fontSize: 11, padding: "6px 14px" }}
            >
              {scheduling ? "Scheduling…" : `Push to ${schedulerType === "buffer" ? "Buffer" : "Hootsuite"} →`}
            </button>
          </div>

          {results.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
              {results.map(r => (
                <div key={r.day} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                  <span style={{ color: "var(--text3)", minWidth: 40 }}>Day {r.day}</span>
                  <span style={{
                    color: r.status === "success" ? "var(--accent)" : r.status === "error" ? "var(--err)" : "var(--text3)",
                  }}>
                    {r.status === "pending" ? "⏳ Pending" : r.status === "success" ? "✅ " + r.message : "❌ " + r.message}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div style={{ fontSize: 10, color: "var(--text3)", fontStyle: "italic", lineHeight: 1.5, marginTop: 4 }}>
            ⚠️ Your API keys are stored only in your browser's localStorage and never sent to our servers.
          </div>
        </div>
      )}
    </div>
  );
};

export default BufferScheduler;
