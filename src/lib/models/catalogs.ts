import type { ApiProvider } from "@/lib/apiKeyManager";

export interface ModelCatalogEntry {
  id: string;
  label: string;
}

export interface ModelCatalogGroup {
  label: string;
  models: ModelCatalogEntry[];
}

/**
 * Static curated model lists per provider, shown in the BYOK model picker.
 * `openrouter` is grouped (Free / Paid) since it aggregates many upstream
 * providers; all others are flat lists.
 */
export const MODEL_CATALOG: Record<ApiProvider, ModelCatalogEntry[]> = {
  openai: [
    { id: "gpt-5", label: "GPT-5 (recommended)" },
    { id: "gpt-5-mini", label: "GPT-5 Mini" },
    { id: "gpt-5-nano", label: "GPT-5 Nano" },
    { id: "gpt-4.1", label: "GPT-4.1" },
    { id: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
    { id: "o4-mini", label: "o4-mini" },
    { id: "gpt-4o", label: "GPT-4o" },
    { id: "gpt-4o-mini", label: "GPT-4o Mini" },
  ],
  anthropic: [
    { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5 (recommended)" },
    { id: "claude-opus-4-1", label: "Claude Opus 4.1" },
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
    { id: "claude-3-7-sonnet-latest", label: "Claude 3.7 Sonnet" },
    { id: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku" },
  ],
  gemini: [
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro (recommended)" },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
    { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  ],
  kimi: [
    { id: "kimi-k2-0905-preview", label: "Kimi K2 (recommended)" },
    { id: "moonshot-v1-128k", label: "Moonshot v1 128k" },
    { id: "moonshot-v1-32k", label: "Moonshot v1 32k" },
    { id: "moonshot-v1-8k", label: "Moonshot v1 8k" },
  ],
  glm: [
    { id: "glm-4.6", label: "GLM-4.6 (recommended)" },
    { id: "glm-4.5", label: "GLM-4.5" },
    { id: "glm-4.5-air", label: "GLM-4.5 Air" },
    { id: "glm-4-plus", label: "GLM-4 Plus" },
    { id: "glm-4-flash", label: "GLM-4 Flash" },
  ],
  openrouter: [
    // Free
    { id: "deepseek/deepseek-chat-v3.1:free", label: "DeepSeek Chat v3.1 (free, recommended)" },
    { id: "deepseek/deepseek-r1:free", label: "DeepSeek R1 (free)" },
    { id: "z-ai/glm-4.5-air:free", label: "GLM-4.5 Air (free)" },
    { id: "qwen/qwen3-coder:free", label: "Qwen3 Coder (free)" },
    { id: "qwen/qwen3-235b-a22b:free", label: "Qwen3 235B (free)" },
    { id: "meta-llama/llama-3.3-70b-instruct:free", label: "Llama 3.3 70B (free)" },
    { id: "google/gemini-2.0-flash-exp:free", label: "Gemini 2.0 Flash Exp (free)" },
    { id: "nvidia/nemotron-nano-9b-v2:free", label: "Nemotron Nano 9B v2 (free)" },
    { id: "mistralai/mistral-small-3.2-24b-instruct:free", label: "Mistral Small 3.2 24B (free)" },
    { id: "moonshotai/kimi-k2:free", label: "Kimi K2 (free)" },
    // Paid
    { id: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5 (paid)" },
    { id: "anthropic/claude-opus-4.1", label: "Claude Opus 4.1 (paid)" },
    { id: "openai/gpt-5", label: "GPT-5 (paid)" },
    { id: "openai/gpt-5-mini", label: "GPT-5 Mini (paid)" },
    { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (paid)" },
    { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (paid)" },
    { id: "x-ai/grok-4-fast", label: "Grok 4 Fast (paid)" },
    { id: "deepseek/deepseek-v3.2-exp", label: "DeepSeek v3.2 Exp (paid)" },
    { id: "qwen/qwen3-max", label: "Qwen3 Max (paid)" },
  ],
};

export const OPENROUTER_FREE_MODEL_IDS = new Set(
  MODEL_CATALOG.openrouter.filter((m) => m.id.endsWith(":free")).map((m) => m.id)
);

/** Grouped view of the OpenRouter catalog for rendering a Free / Paid dropdown. */
export function getOpenRouterGroups(): ModelCatalogGroup[] {
  const free = MODEL_CATALOG.openrouter.filter((m) => m.id.endsWith(":free"));
  const paid = MODEL_CATALOG.openrouter.filter((m) => !m.id.endsWith(":free"));
  return [
    { label: "Free", models: free },
    { label: "Paid", models: paid },
  ];
}

export const OPENROUTER_FREE_RATE_LIMIT_NOTE =
  "OpenRouter free models are rate-limited (~20 requests/min, ~50/day without credits; ~1000/day with ≥10 credits in your OpenRouter account).";

export const CUSTOM_MODEL_SENTINEL = "__custom__";
