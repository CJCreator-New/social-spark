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

function buildPostText(post: Post, platform: string): string {
  const f = formatForPlatform(post, platform, { style: FontStyle.None });
  return f.text;
}

export const BufferScheduler: React.FC<BufferSchedulerProps> = ({ posts, platform, postTimes = {} }) => {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(BUFFER_KEY_STORAGE) || "");
  const [profileId, setProfileId] = useState("");
  const [open, setOpen] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [results, setResults] = useState<ScheduleResult[]>([]);
  const [apiKeySaved, setApiKeySaved] = useState(!!localStorage.getItem(BUFFER_KEY_STORAGE));

  const saveApiKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem(BUFFER_KEY_STORAGE, apiKey.trim());
      setApiKeySaved(true);
      toast.success("Buffer API key saved locally ✓");
    }
  };

  const clearApiKey = () => {
    localStorage.removeItem(BUFFER_KEY_STORAGE);
    setApiKey("");
    setApiKeySaved(false);
  };

  const scheduleAll = async () => {
    if (!apiKey.trim()) { toast.error("Enter your Buffer API key first"); return; }
    if (!profileId.trim()) { toast.error("Enter your Buffer Profile ID first"); return; }

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
        const body: Record<string, any> = {
          profile_ids: [profileId.trim()],
          text,
        };
        if (scheduledAt) {
          body.scheduled_at = scheduledAt;
        }

        const response = await fetch("https://api.bufferapp.com/1/updates/create.json", {
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
    toast.success(`${successCount}/${posts.length} posts pushed to Buffer`);
  };

  return (
    <div style={{ marginTop: 8 }}>
      <button
        type="button"
        className="cpbtn"
        onClick={() => setOpen(v => !v)}
        title="Push posts to Buffer / Hootsuite"
      >
        📤 Schedule to Buffer {open ? "▲" : "▼"}
      </button>

      {open && (
        <div style={{
          marginTop: 8, padding: "16px", background: "var(--surface)",
          border: "1px solid var(--border)", borderRadius: 12,
          display: "flex", flexDirection: "column", gap: 12,
        }}>
          <div style={{ fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--text2)", fontWeight: 500 }}>
            Buffer / Hootsuite Scheduler
          </div>

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
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="Enter Buffer API access token…"
                style={{
                  flex: 1, background: "var(--bg)", border: "1px solid var(--border2)",
                  borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "var(--text)",
                  fontFamily: "var(--font-body)", outline: "none",
                }}
              />
              <button type="button" className="cpbtn done" style={{ fontSize: 11, padding: "5px 10px" }} onClick={saveApiKey}>
                Save
              </button>
              {apiKeySaved && (
                <button type="button" className="cpbtn" style={{ fontSize: 11, padding: "5px 10px", color: "var(--err)" }} onClick={clearApiKey}>
                  Clear
                </button>
              )}
            </div>
            {apiKeySaved && <div style={{ fontSize: 10, color: "var(--accent)", opacity: 0.75 }}>✓ API key saved locally</div>}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, color: "var(--text3)" }}>
              Buffer Profile ID{" "}
              <span style={{ color: "var(--text3)", opacity: 0.7 }}>(find it in your Buffer dashboard URL)</span>
            </label>
            <input
              type="text"
              value={profileId}
              onChange={e => setProfileId(e.target.value)}
              placeholder="e.g. 4eb854340acb04e870000010"
              style={{
                background: "var(--bg)", border: "1px solid var(--border2)",
                borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "var(--text)",
                fontFamily: "var(--font-body)", outline: "none",
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 11, color: "var(--text3)" }}>
              {posts.length} posts · {niceLabelFor(platform)}
            </div>
            <button
              type="button"
              className="cpbtn done"
              onClick={scheduleAll}
              disabled={scheduling || !apiKey.trim() || !profileId.trim()}
              style={{ fontSize: 11, padding: "6px 14px" }}
            >
              {scheduling ? "Scheduling…" : `Push ${posts.length} posts to Buffer →`}
            </button>
          </div>

          {results.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
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

          <div style={{ fontSize: 10, color: "var(--text3)", fontStyle: "italic", lineHeight: 1.5 }}>
            ⚠️ Your API key is stored only in your browser's localStorage and never sent to our servers. Posts are pushed directly to Buffer's API.
          </div>
        </div>
      )}
    </div>
  );
};

export default BufferScheduler;
