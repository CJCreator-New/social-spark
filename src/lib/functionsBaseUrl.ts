// In local `vite dev`, route Supabase Edge Function calls through the Vite
// dev-server proxy (see vite.config.ts `server.proxy["/functions/v1"]`)
// instead of the absolute production URL, so the browser treats the request
// as same-origin and skips the CORS preflight entirely. Production builds and
// the test/mock-env paths are unaffected — this only kicks in for `vite dev`.
export function resolveFunctionsBaseUrl(rawUrl: string): string {
  if (import.meta.env.MODE === "development" && rawUrl && !rawUrl.includes("mock.supabase.co")) {
    return "";
  }
  return rawUrl;
}
