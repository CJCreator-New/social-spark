import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Post } from "@/components/wizard/constants";
import { formatForPlatform, niceLabelFor } from "@/lib/platformCopy";
import { FontStyle } from "@/lib/unicodeFonts";
import { supabase } from "@/integrations/supabase/client";
import { resolveFunctionsBaseUrl } from "@/lib/functionsBaseUrl";
import { dateForDow, nextMonday, parseLocalDate, toDateInputValue } from "@/lib/calendarSchedule";
import { suggestedTimeForDay } from "@/lib/postingTimes";
import { browserTimezone } from "@/lib/timezones";
import { buildScheduledAt, countSchedulerResults } from "@/lib/schedulerDates";
import { validateSchedulerKey, type SchedulerKeyProvider } from "@/lib/schedulerKeys";

interface BufferSchedulerProps {
  posts: Post[];
  platform: string;
  postTimes?: Record<string, string>;
  /** Monday of the calendar week (YYYY-MM-DD string or Date). Defaults to next Monday. */
  weekStart?: string | Date | null;
  /** IANA time zone the post times are expressed in. Defaults to the browser zone. */
  timezone?: string | null;
}

interface ScheduleResult {
  day: number;
  status: "pending" | "success" | "error";
  message?: string;
}

const BUFFER_PROFILE_STORAGE = "contentforge_buffer_profile_id";
const HOOTSUITE_PROFILE_STORAGE = "contentforge_hootsuite_profile_id";

function buildPostText(post: Post, platform: string): string {
  const f = formatForPlatform(post, platform, { style: FontStyle.None });
  return f.text;
}

export const BufferScheduler: React.FC<BufferSchedulerProps> = ({
  posts,
  platform,
  postTimes = {},
  weekStart,
  timezone,
}) => {
  const [schedulerType, setSchedulerType] = useState<"buffer" | "hootsuite">("buffer");

  const [bufferProfileId, setBufferProfileId] = useState(
    () => localStorage.getItem(BUFFER_PROFILE_STORAGE) || ""
  );
  const [hootsuiteProfileId, setHootsuiteProfileId] = useState(
    () => localStorage.getItem(HOOTSUITE_PROFILE_STORAGE) || ""
  );

  const [open, setOpen] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [results, setResults] = useState<ScheduleResult[]>([]);

  const [savedKeys, setSavedKeys] = useState<Record<SchedulerKeyProvider, boolean>>({
    buffer: false,
    hootsuite: false,
  });
  const [keyDraft, setKeyDraft] = useState<Record<SchedulerKeyProvider, string>>({
    buffer: "",
    hootsuite: "",
  });
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyError, setKeyError] = useState("");

  const callKeyFunction = async (payload: Record<string, unknown>) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) throw new Error("Please sign in again.");
    const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || "";
    const res = await fetch(`${resolveFunctionsBaseUrl(supabaseUrl)}/functions/v1/save-scheduler-key`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) || "",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
    return data;
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    callKeyFunction({ action: "status" })
      .then((data) => {
        if (!cancelled && data?.saved) {
          setSavedKeys({ buffer: !!data.saved.buffer, hootsuite: !!data.saved.hootsuite });
        }
      })
      .catch(() => {
        /* status is best-effort; the push button stays disabled until it succeeds */
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const saveKey = async () => {
    const check = validateSchedulerKey(schedulerType, keyDraft[schedulerType]);
    if (!check.ok) {
      setKeyError(check.reason);
      return;
    }
    setKeyError("");
    setKeyBusy(true);
    try {
      await callKeyFunction({ provider: schedulerType, key: keyDraft[schedulerType] });
      setSavedKeys((s) => ({ ...s, [schedulerType]: true }));
      setKeyDraft((d) => ({ ...d, [schedulerType]: "" }));
      toast.success("Token saved");
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : "Could not save the token.");
    } finally {
      setKeyBusy(false);
    }
  };

  const removeKey = async () => {
    setKeyError("");
    setKeyBusy(true);
    try {
      await callKeyFunction({ action: "delete", provider: schedulerType });
      setSavedKeys((s) => ({ ...s, [schedulerType]: false }));
      toast.success("Token removed");
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : "Could not remove the token.");
    } finally {
      setKeyBusy(false);
    }
  };

  const scheduleAll = async () => {
    const isBuffer = schedulerType === "buffer";
    const label = isBuffer ? "Buffer" : "Hootsuite";
    const profileId = isBuffer ? bufferProfileId : hootsuiteProfileId;

    if (!profileId.trim()) {
      toast.error(`Enter your ${label} Profile ID first`);
      return;
    }

    // Save profile IDs to localStorage on schedule
    if (isBuffer) {
      localStorage.setItem(BUFFER_PROFILE_STORAGE, profileId.trim());
    } else {
      localStorage.setItem(HOOTSUITE_PROFILE_STORAGE, profileId.trim());
    }

    setScheduling(true);
    setResults(posts.map((p) => ({ day: p.day, status: "pending" })));

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Please sign in again to push posts.");

      const weekStartDate =
        (weekStart instanceof Date ? weekStart : parseLocalDate(weekStart ?? null)) || nextMonday();
      const tz = timezone || browserTimezone();

      const payloadPosts = posts.map((post) => {
        const time = postTimes[String(post.day)] || suggestedTimeForDay(post.day, platform);
        const dayDate = toDateInputValue(dateForDow(weekStartDate, post.dow));
        return {
          text: buildPostText(post, platform),
          scheduledAt: buildScheduledAt(dayDate, time, tz),
          ...(post.image_url ? { imageUrl: post.image_url } : {}),
        };
      });

      const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || "";
      const res = await fetch(
        `${resolveFunctionsBaseUrl(supabaseUrl)}/functions/v1/push-to-scheduler`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) || "",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            provider: schedulerType,
            profileId: profileId.trim(),
            posts: payloadPosts,
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Push failed (${res.status})`);

      const failedIdx = new Map<number, string>(
        (data.errors ?? []).map((e: { index: number; message: string }) => [e.index, e.message])
      );
      setResults(
        posts.map((p, i) =>
          failedIdx.has(i)
            ? { day: p.day, status: "error", message: failedIdx.get(i) }
            : { day: p.day, status: "success", message: "Scheduled ✓" }
        )
      );

      const counts = countSchedulerResults(data, label);
      if (counts.failed > 0) {
        toast.error(`${counts.message}. ${data.errors?.[0]?.message ?? ""}`.trim());
      } else {
        toast.success(counts.message);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setResults(posts.map((p) => ({ day: p.day, status: "error", message: msg })));
      toast.error(msg);
    } finally {
      setScheduling(false);
    }
  };

  return (
    <div style={{ marginTop: 8 }}>
      <button
        type="button"
        className="cpbtn"
        onClick={() => setOpen((v) => !v)}
        title="Push posts to Buffer or Hootsuite"
      >
        📤 Schedule to Buffer / Hootsuite {open ? "▲" : "▼"}
      </button>

      {open && (
        <div
          style={{
            marginTop: 8,
            padding: "16px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            minWidth: "min(100%, 320px)",
          }}
        >
          {/* Tab selector for Buffer vs Hootsuite */}
          <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
            <button
              type="button"
              className="cpbtn"
              style={{
                flex: 1,
                padding: "6px",
                fontSize: 11,
                background: schedulerType === "buffer" ? "var(--adim)" : "transparent",
                borderColor: schedulerType === "buffer" ? "var(--accent)" : "var(--border2)",
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
                flex: 1,
                padding: "6px",
                fontSize: 11,
                background: schedulerType === "hootsuite" ? "var(--adim)" : "transparent",
                borderColor: schedulerType === "hootsuite" ? "var(--accent)" : "var(--border2)",
                color: schedulerType === "hootsuite" ? "var(--accent)" : "var(--text2)",
              }}
              onClick={() => setSchedulerType("hootsuite")}
            >
              Hootsuite
            </button>
          </div>

          <div
            style={{
              fontSize: 10,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "var(--text2)",
              fontWeight: 500,
            }}
          >
            {schedulerType === "buffer" ? "Buffer Scheduler" : "Hootsuite Scheduler"}
          </div>

          {schedulerType === "buffer" ? (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 11, color: "var(--text3)" }}>
                  Buffer Profile ID{" "}
                  <span style={{ color: "var(--text3)", opacity: 0.7 }}>(find in Buffer URL)</span>
                </label>
                <input
                  type="text"
                  value={bufferProfileId}
                  onChange={(e) => setBufferProfileId(e.target.value)}
                  placeholder="e.g. 4eb854340acb04e870000010"
                  style={{
                    background: "var(--bg)",
                    border: "1px solid var(--border2)",
                    borderRadius: 6,
                    padding: "6px 10px",
                    fontSize: 12,
                    color: "var(--text)",
                    fontFamily: "var(--font-body)",
                    outline: "none",
                  }}
                />
              </div>
            </>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 11, color: "var(--text3)" }}>
                  Hootsuite Social Profile ID{" "}
                  <span style={{ color: "var(--text3)", opacity: 0.7 }}>
                    (find in Hootsuite developer portal)
                  </span>
                </label>
                <input
                  type="text"
                  value={hootsuiteProfileId}
                  onChange={(e) => setHootsuiteProfileId(e.target.value)}
                  placeholder="e.g. 12345678"
                  style={{
                    background: "var(--bg)",
                    border: "1px solid var(--border2)",
                    borderRadius: 6,
                    padding: "6px 10px",
                    fontSize: 12,
                    color: "var(--text)",
                    fontFamily: "var(--font-body)",
                    outline: "none",
                  }}
                />
              </div>
            </>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="scheduler-token" className="text-[11px] opacity-70">
              {schedulerType === "buffer" ? "Buffer" : "Hootsuite"} access token
            </label>
            {savedKeys[schedulerType] ? (
              <div className="flex items-center gap-2 text-[11px]">
                <span>Saved</span>
                <button type="button" className="cpbtn" onClick={removeKey} disabled={keyBusy}>
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  id="scheduler-token"
                  type="password"
                  autoComplete="off"
                  value={keyDraft[schedulerType]}
                  onChange={(e) =>
                    setKeyDraft((d) => ({ ...d, [schedulerType]: e.target.value }))
                  }
                  placeholder="Paste your token"
                  className="flex-1 rounded border bg-transparent px-2 py-1 text-xs"
                />
                <button
                  type="button"
                  className="cpbtn"
                  onClick={saveKey}
                  disabled={keyBusy || !keyDraft[schedulerType]}
                >
                  {keyBusy ? "Saving…" : "Save"}
                </button>
              </div>
            )}
            {keyError && (
              <div role="alert" className="text-[11px]">
                {keyError}
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 4,
            }}
          >
            <div style={{ fontSize: 11, color: "var(--text3)" }}>
              {posts.length} posts · {niceLabelFor(platform)}
            </div>
            <button
              type="button"
              className="cpbtn done"
              onClick={scheduleAll}
              disabled={
                scheduling ||
                !savedKeys[schedulerType] ||
                (schedulerType === "buffer" ? !bufferProfileId.trim() : !hootsuiteProfileId.trim())
              }
              style={{ fontSize: 11, padding: "6px 14px" }}
            >
              {scheduling
                ? "Scheduling…"
                : `Push to ${schedulerType === "buffer" ? "Buffer" : "Hootsuite"} →`}
            </button>
          </div>

          {!savedKeys[schedulerType] && (
            <div className="text-[11px] opacity-70">
              Save your {schedulerType === "buffer" ? "Buffer" : "Hootsuite"} token above to enable
              pushing.
            </div>
          )}

          {results.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
              {results.map((r) => (
                <div
                  key={r.day}
                  style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}
                >
                  <span style={{ color: "var(--text3)", minWidth: 40 }}>Day {r.day}</span>
                  <span
                    style={{
                      color:
                        r.status === "success"
                          ? "var(--accent)"
                          : r.status === "error"
                            ? "var(--err)"
                            : "var(--text3)",
                    }}
                  >
                    {r.status === "pending"
                      ? "⏳ Pending"
                      : r.status === "success"
                        ? "✅ " + r.message
                        : "❌ " + r.message}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div
            style={{
              fontSize: 10,
              color: "var(--text3)",
              fontStyle: "italic",
              lineHeight: 1.5,
              marginTop: 4,
            }}
          >
            Posts are sent from our server using your saved access token. Once saved, the token is
            stored encrypted and is never shown again.
          </div>
        </div>
      )}
    </div>
  );
};

export default BufferScheduler;
