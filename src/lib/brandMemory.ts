import { Database } from "@/integrations/supabase/types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * Checks if the user has configured any brand memory elements in their profile.
 */
export function hasBrandMemory(profile?: Partial<ProfileRow> | null): boolean {
  if (!profile) return false;
  
  const hasForbidden = Array.isArray(profile.forbidden_phrases) && profile.forbidden_phrases.length > 0;
  const hasProof = Array.isArray(profile.proof_points) && profile.proof_points.length > 0;
  const hasCta = Array.isArray(profile.cta_preferences) && profile.cta_preferences.length > 0;
  const hasStructures = Array.isArray(profile.preferred_structures) && profile.preferred_structures.length > 0;

  return hasForbidden || hasProof || hasCta || hasStructures;
}

/**
 * Builds a prompt snippet enforcing brand identity based on profile settings.
 */
export function buildBrandMemoryPrompt(profile?: Partial<ProfileRow> | null): string {
  if (!profile || !hasBrandMemory(profile)) return "";

  const sections: string[] = ["### BRAND MEMORY & IDENTITY CONSTRAINTS"];

  if (Array.isArray(profile.forbidden_phrases) && profile.forbidden_phrases.length > 0) {
    sections.push(`- **FORBIDDEN PHRASES (NEVER USE)**: ${profile.forbidden_phrases.map(p => `"${p}"`).join(", ")}`);
  }

  if (Array.isArray(profile.proof_points) && profile.proof_points.length > 0) {
    sections.push("- **PROOF POINTS & KEY DATA (WEAVE THESE IN WHERE NATURAL)**:");
    profile.proof_points.forEach(point => {
      sections.push(`  * ${point}`);
    });
  }

  if (Array.isArray(profile.cta_preferences) && profile.cta_preferences.length > 0) {
    sections.push(`- **PREFERRED CTA PATTERNS**: Use call-to-action styles matching: ${profile.cta_preferences.join(", ")}`);
  }

  if (Array.isArray(profile.preferred_structures) && profile.preferred_structures.length > 0) {
    sections.push(`- **PREFERRED WRITING STRUCTURES**: Align content formats to: ${profile.preferred_structures.join(", ")}`);
  }

  return sections.join("\n");
}
