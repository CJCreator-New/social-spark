#!/usr/bin/env node
/**
 * Inlines Supabase edge functions for the Dashboard editor (which doesn't
 * support ../_shared imports). For each function, it concatenates the shared
 * modules it imports (with `export` stripped) ahead of the function body (with
 * the _shared import lines removed), producing a single self-contained file.
 *
 * Output: dashboard-deploy/<fn>.ts  (paste-ready, no imports except esm.sh).
 *
 * Run: node scripts/inline-edge-functions.mjs
 *
 * NOTE: This is a deploy convenience for a Lovable-managed project that lacks
 * CLI access. The real source of truth stays in supabase/functions/. Re-run
 * this whenever a function or _shared changes.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fnDir = join(root, "supabase", "functions");
const sharedDir = join(fnDir, "_shared");
const outDir = join(root, "dashboard-deploy");

mkdirSync(outDir, { recursive: true });

// Read a shared module, strip the leading `declare const Deno` and `export`
// keywords so its symbols become local to the inlined file.
function loadShared(name) {
  const src = readFileSync(join(sharedDir, name), "utf8");
  return src
    .replace(/^\s*declare const Deno:\s*\{[\s\S]*?\n\};\s*$/gm, "")
    .replace(/^\s*declare const Deno:.*$/gm, "")
    .replace(/^export\s+/gm, "")
    .replace(/^export\s+/gm, "");
}

const SHARED = {
  "promptHelpers.ts": null, // lazy
  "plans.ts": null,
};
function shared(name) {
  if (SHARED[name] == null) SHARED[name] = loadShared(name);
  return SHARED[name];
}

// Parse the imported symbol names from a function's _shared import lines.
function importedSymbols(src) {
  const re = /import\s+\{([^}]*)\}\s+from\s+["']\.\.\/_shared\/([^"']+)["']/g;
  const map = {};
  let m;
  while ((m = re.exec(src)) !== null) {
    const mod = m[2];
    const names = m[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    (map[mod] ||= []).push(...names);
  }
  return map;
}

// Extract a single top-level symbol's full source (handles function/const/
// interface/type/class) by brace/paren matching from its `export` declaration.
function extractSymbol(rawSrc, name) {
  // rawSrc still has `export` keywords. Find the declaration.
  const decl = new RegExp(
    `export\\s+(?:async\\s+)?(?:function|const|let|interface|type|class)\\s+${name}\\b`
  );
  const start = rawSrc.search(decl);
  if (start === -1) return null;
  // Walk forward to the end of the statement/block.
  let i = rawSrc.indexOf(name, start) + name.length;
  // type X = ... ;  (no braces)
  const after = rawSrc.slice(i);
  // Find first of { ( = ;
  let depth = 0;
  let started = false;
  let j = i;
  // For `const NAME = {...}` or `function NAME(...){...}` or `type NAME = ...;`
  for (; j < rawSrc.length; j++) {
    const c = rawSrc[j];
    if (c === "{" || c === "(" || c === "[") {
      depth++;
      started = true;
    } else if (c === "}" || c === ")" || c === "]") {
      depth--;
    } else if (c === ";" && depth === 0) {
      j++;
      break;
    }
    if (started && depth === 0 && rawSrc[j] === "}") {
      // end of a block-bodied function/class; consume optional trailing ;
      if (rawSrc[j + 1] === ";") j++;
      j++;
      break;
    }
  }
  return rawSrc.slice(start, j).replace(/^export\s+/, "");
}

// Remove a top-level `function NAME(...) { ... }` definition from source,
// brace-matching to find the end. Used to drop a body's duplicate of a symbol
// already provided by the inlined shared preamble.
function stripLocalFunction(src, name) {
  const re = new RegExp(`(^|\\n)\\s*function\\s+${name}\\s*\\(`);
  const m = re.exec(src);
  if (!m) return src;
  const start = m.index + (m[1] ? m[1].length : 0);
  // Find the opening brace of the body.
  let i = src.indexOf("{", start);
  if (i === -1) return src;
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
  }
  return src.slice(0, start) + src.slice(i);
}

// Discover function dirs (each has index.ts), skip _shared and test files.
const fns = readdirSync(fnDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== "_shared")
  .map((d) => d.name)
  .filter((n) => existsSync(join(fnDir, n, "index.ts")));

const importRe = /^\s*import\s+\{[^}]*\}\s+from\s+["']\.\.\/_shared\/([^"']+)["'];?\s*$/gm;

let count = 0;
for (const fn of fns) {
  const srcPath = join(fnDir, fn, "index.ts");
  let body = readFileSync(srcPath, "utf8");

  // Which shared modules does this function import?
  const needed = new Set();
  let m;
  importRe.lastIndex = 0;
  while ((m = importRe.exec(body)) !== null) needed.add(m[1]);

  if (needed.size === 0) {
    // No shared imports — copy as-is.
    writeFileSync(join(outDir, `${fn}.ts`), body);
    count++;
    continue;
  }

  // Strip the _shared import lines from the body.
  body = body
    .replace(importRe, "")
    .replace(/^\s*declare const Deno:\s*\{[\s\S]*?\n\};\s*$/gm, "")
    .replace(/^\s*declare const Deno:.*$/gm, "");

  // promptHelpers must come before plans? They're independent; order them
  // deterministically (promptHelpers first, then plans).
  const order = ["promptHelpers.ts", "plans.ts"];
  const preamble = order
    .filter((n) => needed.has(n))
    .map((n) => `// ===== inlined from _shared/${n} =====\n${shared(n)}`)
    .join("\n\n");

  // Collision fix: promptHelpers already provides corsHeaders + jsonResponse.
  // Some function bodies ALSO define a local jsonResponse (the api-key/payment
  // fns). When promptHelpers is inlined, remove the body's duplicate to avoid
  // "already declared" compile errors. Only do this if promptHelpers is present.
  if (needed.has("promptHelpers.ts")) {
    // Remove a local `function jsonResponse(...) { ... }` block from the body.
    body = stripLocalFunction(body, "jsonResponse");
    // Remove a local `const corsHeaders = { ... };` if present.
    body = body.replace(/(^|\n)\s*const corsHeaders\s*=\s*\{[\s\S]*?\};\s*/m, "\n");
  }

  const header =
    `// ============================================================================\n` +
    `// ${fn}  —  PASTE-READY for the Supabase Dashboard Edge Functions editor.\n` +
    `// AUTO-GENERATED by scripts/inline-edge-functions.mjs — do not edit by hand.\n` +
    `// Source of truth: supabase/functions/${fn}/index.ts (+ _shared).\n` +
    `// ============================================================================\n`;

  // Pull any esm.sh imports out of the body to the very top (Deno needs them first).
  const esmImports = [];
  body = body.replace(/^\s*import\s+.*from\s+["']https?:\/\/[^"']+["'];?\s*$/gm, (line) => {
    esmImports.push(line.trim());
    return "";
  });

  const out =
    header +
    (esmImports.length ? esmImports.join("\n") + "\n\n" : "") +
    "declare const Deno: any;\n\n" +
    preamble +
    "\n\n// ===== function body =====\n" +
    body.replace(/^\s*\n/, "");

  writeFileSync(join(outDir, `${fn}.ts`), out);
  count++;
}

console.log(`Inlined ${count} edge function(s) -> dashboard-deploy/`);
