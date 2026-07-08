import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, jsonResponse, verifyCronSecret } from "../_shared/promptHelpers.ts";

declare const Deno: {
  serve(handler: (req: Request) => Response | Promise<Response>): void;
  env: {
    get(key: string): string | undefined;
  };
};

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed. Use POST." }, 405);
  }

  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    
    let isAuthorized = false;

    // Check if the request has a valid internal cron secret first
    if (verifyCronSecret(req)) {
      isAuthorized = true;
    } else if (token) {
      // Validate user token
      const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
      const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user } } = await tempClient.auth.getUser();
      if (user) {
        // Non-cron callers must be admins — this is a full trend-table
        // re-ingest, not a read, so any-authenticated-user was over-broad.
        // Same has_role RPC pattern used by useIsAdmin/admin RLS policies.
        const { data: isAdmin, error: roleError } = await tempClient.rpc("has_role", {
          _user_id: user.id,
          _role: "admin",
        });
        if (!roleError && isAdmin === true) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return jsonResponse({ error: "Unauthorized access." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return jsonResponse({ error: "Server configuration missing." }, 500);
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // List of simulated trends to ingest
    const simulatedTrends = [
      { keyword: "AI Agents", volume: 85000, category: "Artificial Intelligence", source: "Google Trends" },
      { keyword: "TypeScript 5.5", volume: 12000, category: "Software Development", source: "GitHub" },
      { keyword: "Tailwind CSS v4", volume: 18000, category: "Web Design", source: "X" },
      { keyword: "Solopreneurship", volume: 45000, category: "Business", source: "Reddit" },
      { keyword: "Prompt Engineering", volume: 60000, category: "Artificial Intelligence", source: "Google Trends" },
      { keyword: "Next.js 15", volume: 25000, category: "Software Development", source: "GitHub" },
      { keyword: "Remote Work Culture", volume: 38000, category: "Business", source: "LinkedIn" },
      { keyword: "Vector Databases", volume: 15000, category: "Database", source: "Reddit" },
      { keyword: "SaaS Marketing", volume: 22000, category: "Marketing", source: "LinkedIn" },
      { keyword: "Rust Web Frameworks", volume: 9500, category: "Software Development", source: "GitHub" },
    ];

    // Explicitly stamp last_seen on every row: DEFAULT now() only fires on
    // INSERT, so without this, still-trending keywords that get re-upserted
    // (UPDATE path) would keep a stale last_seen and be wrongly swept up by
    // the 14-day TTL cleanup in cleanup-media's deleteExpiredTrends.
    const now = new Date().toISOString();
    const rowsToUpsert = simulatedTrends.map((t) => ({ ...t, last_seen: now }));

    // Chunk the upsert per-source so one bad row in one source's batch
    // doesn't fail the entire ingest with a single 500.
    const bySource = new Map<string, typeof rowsToUpsert>();
    for (const row of rowsToUpsert) {
      const bucket = bySource.get(row.source) ?? [];
      bucket.push(row);
      bySource.set(row.source, bucket);
    }

    const insertedData: unknown[] = [];
    const failures: { source: string; error: string }[] = [];
    for (const [source, rows] of bySource) {
      const { data, error } = await adminClient
        .from("trends")
        .upsert(rows, { onConflict: "keyword,source" })
        .select();
      if (error) {
        console.error(`Database error in trends-ingest for source "${source}":`, error);
        failures.push({ source, error: error.message });
        continue;
      }
      if (data) insertedData.push(...data);
    }

    if (insertedData.length === 0 && failures.length > 0) {
      return jsonResponse({ error: "Failed to store ingested trends.", failures }, 500);
    }

    return jsonResponse({
      success: true,
      message: `Successfully ingested ${insertedData.length} trends.`,
      data: insertedData,
      ...(failures.length > 0 ? { failures } : {}),
    });
  } catch (e) {
    console.error("trends-ingest error:", e);
    return jsonResponse({ error: "An unexpected error occurred." }, 500);
  }
});
