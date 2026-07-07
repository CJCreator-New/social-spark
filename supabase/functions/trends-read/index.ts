import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, jsonResponse } from "../_shared/promptHelpers.ts";

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

  // Allow GET and POST (fallback)
  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed. Use GET." }, 405);
  }

  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return jsonResponse({ error: "Unauthorized access. Missing auth token." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    
    // Verify authentication
    const { data: { user }, error: authError } = await tempClient.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized access. Invalid token." }, 401);
    }

    // Parse query params (handling potential POST body params too for convenience)
    let page = 1;
    let limit = 25;
    let category = null;
    let source = null;
    let q = null;

    if (req.method === "GET") {
      const url = new URL(req.url);
      page = Math.max(1, Number(url.searchParams.get("page") || "1"));
      limit = Math.min(Number(url.searchParams.get("limit") || "25"), 200);
      category = url.searchParams.get("category");
      source = url.searchParams.get("source");
      q = url.searchParams.get("q");
    } else {
      // POST body
      const body = await req.json().catch(() => ({}));
      page = Math.max(1, Number(body.page || 1));
      limit = Math.min(Number(body.limit || 25), 200);
      category = body.category || null;
      source = body.source || null;
      q = body.q || null;
    }

    // Query using the user's authenticated client to ensure RLS is enforced
    let query = tempClient
      .from("trends")
      .select("*", { count: "exact" })
      .order("volume", { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (category) {
      query = query.eq("category", category);
    }
    if (source) {
      query = query.eq("source", source);
    }
    if (q) {
      query = query.ilike("keyword", `%${q}%`);
    }

    const { data: trends, error: dbError, count } = await query;

    if (dbError) {
      console.error("Database error in trends-read:", dbError);
      return jsonResponse({ error: "Failed to retrieve trends from database." }, 500);
    }

    return jsonResponse({
      data: trends || [],
      meta: {
        page,
        limit,
        total: count || (trends || []).length,
      },
    });
  } catch (e) {
    console.error("trends-read error:", e);
    return jsonResponse({ error: "An unexpected error occurred." }, 500);
  }
});
