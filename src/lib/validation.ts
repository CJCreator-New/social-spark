import { z } from "zod";

/**
 * Comprehensive form validation schemas
 * Used across frontend forms and backend API validation
 */

// ============================================================================
// BASE FIELD SCHEMAS
// ============================================================================

export const Industry = z
  .string()
  .min(1, "Please select your industry / niche.")
  .max(100, "Industry name too long");

export const CoreIdea = z
  .string()
  .min(10, "Please describe your core idea (at least 10 characters).")
  .max(500, "Core idea too long (max 500 characters).");

export const Platform = z
  .enum([
    "LinkedIn",
    "Twitter",
    "Instagram",
    "Facebook",
    "TikTok",
    "Threads",
    "Bluesky",
    "Newsletter",
    "Blog",
  ])
  .default("LinkedIn");

export const Voice = z
  .string()
  .max(200, "Voice description too long")
  .optional()
  .or(z.literal(""));

export const Style = z
  .string()
  .max(200, "Style description too long")
  .optional()
  .or(z.literal(""));

export const Topics = z
  .array(z.string().min(1).max(100))
  .min(1, "Please select at least 1 topic.")
  .max(7, "Maximum 7 topics allowed.");

export const Topic = z
  .string()
  .min(1, "Please enter a topic.")
  .max(100, "Topic too long");

export const Goals = z
  .array(z.string().min(1).max(50))
  .max(6, "Maximum 6 goals allowed.")
  .default(["Awareness", "Engagement"]);

export const Audiences = z
  .array(z.string().min(1).max(50))
  .max(6, "Maximum 6 audiences allowed.")
  .default([]);

export const BannedWords = z
  .array(z.string().min(1).max(50))
  .max(6, "Maximum 6 banned words allowed.")
  .default([]);

export const RequiredWords = z
  .array(z.string().min(1).max(50))
  .max(6, "Maximum 6 required words allowed.")
  .default([]);

export const Format = z
  .string()
  .max(100, "Format description too long")
  .default("Balanced mix");

export const CTA = z
  .string()
  .max(100, "CTA too long")
  .default("Share & repost bait");

export const Length = z
  .enum(["short", "medium", "long", "mixed"])
  .default("medium");

export const Structure = z
  .enum(["paragraphs", "bullets", "mixed", "perPost"])
  .default("mixed");

export const Extra = z
  .string()
  .max(500, "Extra instructions too long")
  .optional()
  .or(z.literal(""));

export const DayOfWeek = z
  .enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])
  .default("Mon");

export const DateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (expected YYYY-MM-DD)");

export const Mode = z.enum(["week", "day"]).default("week");

// ============================================================================
// FORM SCHEMAS - BY STEP
// ============================================================================

/**
 * Step 1: Industry & Core Idea
 */
export const FormStep1Schema = z.object({
  industry: Industry,
  platform: Platform,
  coreIdea: CoreIdea,
});

export type FormStep1 = z.infer<typeof FormStep1Schema>;

/**
 * Step 2: Voice, Topics, Goals, Rules
 */
export const FormStep2Schema = z
  .object({
    audiences: Audiences,
    voice: Voice,
    style: Style,
    goals: Goals,
    topics: Topics.optional(),
    topic: Topic.optional(),
    format: Format,
    cta: CTA,
    length: Length,
    structure: Structure,
    extra: Extra,
    bannedWords: BannedWords,
    requiredWords: RequiredWords,
    mode: Mode,
    targetDate: DateString.optional(),
  })
  .refine(
    (data) => {
      // If mode is "day", require targetDate
      if (data.mode === "day") {
        return !!data.targetDate;
      }
      return true;
    },
    {
      message: "Date is required for single-day generation.",
      path: ["targetDate"],
    }
  )
  .refine(
    (data) => {
      // If mode is "day", require topic (single)
      if (data.mode === "day") {
        return !!data.topic?.trim();
      }
      // If mode is "week", require topics (plural)
      return (data.topics?.length ?? 0) > 0;
    },
    {
      message:
        data.mode === "day"
          ? "Please enter a topic for this post."
          : "Please select at least 1 topic.",
      path: ["topics"],
    }
  );

export type FormStep2 = z.infer<typeof FormStep2Schema>;

/**
 * Step 3: Generating (UI state, not validated)
 */
export const FormStep3Schema = z.object({
  isGenerating: z.boolean().default(true),
  statusMessage: z.string().default("Generating your posts..."),
});

export type FormStep3 = z.infer<typeof FormStep3Schema>;

/**
 * Step 4: Review & Save
 */
export const PostSchema = z.object({
  day: z.number().int().min(1).max(7),
  dow: DayOfWeek,
  topic: z.string(),
  format: z.string(),
  title: z.string(),
  hook: z.string(),
  body: z.string(),
  cta: z.string(),
  hashtags: z.string().default(""),
  rationale: z.string().default(""),
});

export type Post = z.infer<typeof PostSchema>;

export const FormStep4Schema = z.object({
  posts: z
    .array(PostSchema)
    .min(1, "No posts generated")
    .max(7, "Too many posts"),
  activeDay: z.number().int().min(0).max(6).default(0),
});

export type FormStep4 = z.infer<typeof FormStep4Schema>;

// ============================================================================
// COMPLETE FORM SCHEMA
// ============================================================================

/**
 * Complete form state for the wizard
 */
export const FormSchema = z.object({
  // Step 1
  industry: Industry,
  platform: Platform,
  coreIdea: CoreIdea,

  // Step 2
  audiences: Audiences,
  voice: Voice,
  style: Style,
  goals: Goals,
  topics: Topics,
  topic: z.string().default(""), // Single-post mode
  format: Format,
  cta: CTA,
  length: Length,
  structure: Structure,
  extra: Extra,
  bannedWords: BannedWords,
  requiredWords: RequiredWords,
  bannedHashtags: z.array(z.string()).default([]),
  requiredHashtags: z.array(z.string()).default([]),

  // Mode & date
  mode: Mode,
  targetDate: DateString.optional(),
  weekStart: DateString.optional(),

  // Runtime state (not strictly validated but typed)
  step: z.number().int().min(1).max(4).default(1),
  isGenerating: z.boolean().default(false),
  posts: z.array(PostSchema).default([]),
  activeDay: z.number().int().min(0).max(6).default(0),
});

export type Form = z.infer<typeof FormSchema>;

/**
 * API Payload for generation (sent to edge functions)
 */
export const GenerationPayloadSchema = z.object({
  industry: Industry.optional(),
  industryLabel: z.string().optional(),
  platform: Platform,
  coreIdea: CoreIdea,
  audiences: Audiences,
  voice: Voice,
  style: Style,
  goals: Goals,
  topic: Topic.optional(), // Single-post only
  topics: Topics.optional(), // Calendar only
  dow: DayOfWeek.optional(), // Single-post only
  date: DateString.optional(), // Single-post only
  format: Format,
  cta: CTA,
  length: Length,
  structure: Structure,
  extra: Extra,
  bannedWords: BannedWords,
  requiredWords: RequiredWords,
  bannedHashtags: z.array(z.string()).default([]),
  requiredHashtags: z.array(z.string()).default([]),
});

export type GenerationPayload = z.infer<typeof GenerationPayloadSchema>;

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate complete form
 */
export function validateForm(data: unknown): { valid: boolean; errors?: Record<string, string> } {
  const result = FormSchema.safeParse(data);
  if (result.success) {
    return { valid: true };
  }

  const errors: Record<string, string> = {};
  result.error.errors.forEach((err) => {
    const path = err.path.join(".");
    errors[path] = err.message;
  });

  return { valid: false, errors };
}

/**
 * Validate step-by-step
 */
export function validateStep(step: number, data: unknown): { valid: boolean; errors?: Record<string, string> } {
  let schema;

  switch (step) {
    case 1:
      schema = FormStep1Schema;
      break;
    case 2:
      schema = FormStep2Schema;
      break;
    case 3:
      schema = FormStep3Schema;
      break;
    case 4:
      schema = FormStep4Schema;
      break;
    default:
      return { valid: false, errors: { step: "Invalid step number" } };
  }

  const result = schema.safeParse(data);
  if (result.success) {
    return { valid: true };
  }

  const errors: Record<string, string> = {};
  result.error.errors.forEach((err) => {
    const path = err.path.join(".");
    errors[path] = err.message;
  });

  return { valid: false, errors };
}

/**
 * Validate generation payload for API calls
 */
export function validateGenerationPayload(data: unknown): { valid: boolean; data?: GenerationPayload; error?: string } {
  const result = GenerationPayloadSchema.safeParse(data);
  if (result.success) {
    return { valid: true, data: result.data };
  }

  const errorMessages = result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
  return { valid: false, error: errorMessages };
}

// ============================================================================
// FIELD-LEVEL VALIDATORS (for use in components)
// ============================================================================

/**
 * Validate a single field
 */
export function validateField(
  fieldName: keyof Form,
  value: unknown,
  context?: Partial<Form>
): { valid: boolean; error?: string } {
  // Get the schema for the field
  const fieldSchema = FormSchema.pick({ [fieldName]: true });

  const result = fieldSchema.safeParse({ [fieldName]: value });
  if (result.success) {
    return { valid: true };
  }

  const error = result.error.errors[0]?.message || "Invalid value";
  return { valid: false, error };
}

/**
 * Validate topics array
 */
export function validateTopics(topics: unknown): { valid: boolean; error?: string } {
  const result = Topics.safeParse(topics);
  if (result.success) {
    return { valid: true };
  }
  return { valid: false, error: result.error.errors[0]?.message };
}

/**
 * Validate industry
 */
export function validateIndustry(industry: unknown): { valid: boolean; error?: string } {
  const result = Industry.safeParse(industry);
  if (result.success) {
    return { valid: true };
  }
  return { valid: false, error: result.error.errors[0]?.message };
}

/**
 * Validate date format
 */
export function validateDate(date: unknown): { valid: boolean; error?: string } {
  const result = DateString.safeParse(date);
  if (result.success) {
    return { valid: true };
  }
  return { valid: false, error: result.error.errors[0]?.message };
}

export default {
  FormSchema,
  FormStep1Schema,
  FormStep2Schema,
  FormStep3Schema,
  FormStep4Schema,
  GenerationPayloadSchema,
  PostSchema,
  validateForm,
  validateStep,
  validateGenerationPayload,
  validateField,
  validateTopics,
  validateIndustry,
  validateDate,
};
