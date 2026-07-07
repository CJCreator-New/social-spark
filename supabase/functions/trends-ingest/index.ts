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
        isAuthorized = true;
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

    // Perform the upsert to update existing or insert new keywords
    const { data: insertedData, error: dbError } = await adminClient
      .from("trends")
      .upsert(simulatedTrends, { onConflict: "keyword,source" })
      .select();

    if (dbError) {
      console.error("Database error in trends-ingest:", dbError);
      return jsonResponse({ error: "Failed to store ingested trends." }, 500);
    }

    return jsonResponse({
      success: true,
      message: `Successfully ingested ${insertedData?.length || 0} trends.`,
      data: insertedData,
    });
  } catch (e) {
    console.error("trends-ingest error:", e);
    return jsonResponse({ error: "An unexpected error occurred." }, 500);
  }
});
