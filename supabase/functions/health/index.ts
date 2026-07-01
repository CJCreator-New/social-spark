import { corsHeaders, jsonResponse } from "../_shared/promptHelpers.ts";

declare const Deno: { serve(handler: (req: Request) => Response | Promise<Response>): void };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  return jsonResponse({ ok: true, ts: new Date().toISOString() });
});
