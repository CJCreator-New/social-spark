/**
 * Templates Service
 *
 * Manages saving, loading, and sharing form configuration templates.
 *
 * Usage:
 * ```typescript
 * import { templatesService } from '@/lib/templates';
 *
 * // Save current form as template
 * await templatesService.saveTemplate({
 *   name: 'SaaS Growth Hacking',
 *   description: 'Template for SaaS companies focusing on growth',
 *   config: formData,
 * });
 *
 * // Load a template
 * const template = await templatesService.getTemplate(templateId);
 *
 * // List user's templates
 * const templates = await templatesService.listUserTemplates();
 * ```
 */

import { supabase } from "@/integrations/supabase/client";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Template configuration (form data that can be reused).
 */
export interface TemplateConfig {
  industry: string;
  industryLabel?: string;
  coreIdea: string;
  platform: string;
  voice: string;
  style: string;
  goals: string[];
  topics?: string[];
  audiences: string[];
  format: string;
  cta: string;
  length: string;
  structure: string;
  extra: string;
  bannedWords: string[];
  requiredWords: string[];
  bannedHashtags: string[];
  requiredHashtags: string[];
}

/**
 * Saved template metadata and data.
 */
export interface Template {
  id: string;
  userId: string;
  name: string;
  description?: string;
  config: TemplateConfig;
  isShared: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Template summary for list views.
 */
export interface TemplateSummary {
  id: string;
  name: string;
  description?: string;
  industry: string;
  createdAt: Date;
  isShared: boolean;
}

// ============================================================================
// TEMPLATES SERVICE
// ============================================================================

class TemplatesService {
  /**
   * Save a new template.
   *
   * @param data Template name, description, and config
   * @returns Created template
   * @throws Error if save fails
   *
   * @example
   * ```typescript
   * const template = await templatesService.saveTemplate({
   *   name: 'My Template',
   *   description: 'For SaaS audiences',
   *   config: {
   *     industry: 'SaaS',
   *     platform: 'LinkedIn',
   *     // ... rest of form data
   *   },
   * });
   * ```
   */
  async saveTemplate(data: {
    name: string;
    description?: string;
    config: TemplateConfig;
    isShared?: boolean;
  }): Promise<Template> {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.user) {
      throw new Error("User not authenticated");
    }

    const { data: template, error } = await supabase
      .from("templates")
      .insert({
        user_id: session.user.id,
        name: data.name,
        description: data.description || null,
        config: data.config,
        is_shared: data.isShared || false,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save template: ${error.message}`);
    }

    return this.mapTemplate(template);
  }

  /**
   * Get a specific template by ID.
   *
   * @param templateId Template ID to retrieve
   * @returns Template or null if not found
   * @throws Error if fetch fails
   */
  async getTemplate(templateId: string): Promise<Template | null> {
    const { data: template, error } = await supabase
      .from("templates")
      .select()
      .eq("id", templateId)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows found
      throw new Error(`Failed to fetch template: ${error.message}`);
    }

    return template ? this.mapTemplate(template) : null;
  }

  /**
   * List all templates for the current user.
   *
   * @returns Array of user's templates (most recent first)
   * @throws Error if fetch fails
   *
   * @example
   * ```typescript
   * const templates = await templatesService.listUserTemplates();
   * templates.forEach(t => console.log(t.name));
   * ```
   */
  async listUserTemplates(): Promise<TemplateSummary[]> {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.user) {
      throw new Error("User not authenticated");
    }

    const { data: templates, error } = await supabase
      .from("templates")
      .select("id, name, description, config, is_shared, created_at, updated_at")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to list templates: ${error.message}`);
    }

    return (templates || []).map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      industry: (t.config as any)?.industry || "Unknown",
      createdAt: new Date(t.created_at),
      isShared: t.is_shared,
    }));
  }

  /**
   * List shared/public templates.
   *
   * @returns Array of public templates (most recent first)
   * @throws Error if fetch fails
   */
  async listSharedTemplates(): Promise<TemplateSummary[]> {
    const { data: templates, error } = await supabase
      .from("shared_templates")
      .select("id, name, description, config, created_at");

    if (error) {
      throw new Error(`Failed to list shared templates: ${error.message}`);
    }

    return (templates || []).map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      industry: (t.config as any)?.industry || "Unknown",
      createdAt: new Date(t.created_at),
      isShared: true,
    }));
  }

  /**
   * Update an existing template.
   *
   * @param templateId Template ID to update
   * @param data Updated template data
   * @returns Updated template
   * @throws Error if update fails
   */
  async updateTemplate(
    templateId: string,
    data: Partial<{
      name: string;
      description: string;
      config: TemplateConfig;
      isShared: boolean;
    }>
  ): Promise<Template> {
    const { data: updated, error } = await supabase
      .from("templates")
      .update({
        name: data.name,
        description: data.description,
        config: data.config,
        is_shared: data.isShared,
        updated_at: new Date().toISOString(),
      })
      .eq("id", templateId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update template: ${error.message}`);
    }

    return this.mapTemplate(updated);
  }

  /**
   * Delete a template.
   *
   * @param templateId Template ID to delete
   * @throws Error if deletion fails
   */
  async deleteTemplate(templateId: string): Promise<void> {
    const { error } = await supabase.from("templates").delete().eq("id", templateId);

    if (error) {
      throw new Error(`Failed to delete template: ${error.message}`);
    }
  }

  /**
   * Toggle template sharing (public/private).
   *
   * @param templateId Template ID to toggle
   * @returns Updated template
   * @throws Error if update fails
   */
  async toggleSharing(templateId: string): Promise<Template> {
    // Get current sharing state
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error("Template not found");
    }

    // Toggle sharing
    return this.updateTemplate(templateId, {
      isShared: !template.isShared,
    });
  }

  /**
   * Duplicate an existing template.
   *
   * @param templateId Template ID to duplicate
   * @param newName Name for the duplicated template
   * @returns New template
   * @throws Error if duplication fails
   *
   * @example
   * ```typescript
   * const original = await templatesService.getTemplate('template-1');
   * const copy = await templatesService.duplicateTemplate('template-1', 'Copy of Original');
   * ```
   */
  async duplicateTemplate(templateId: string, newName: string): Promise<Template> {
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error("Template not found");
    }

    return this.saveTemplate({
      name: newName,
      description: template.description ? `${template.description} (copy)` : undefined,
      config: template.config,
      isShared: false, // Duplicates are private by default
    });
  }

  /**
   * Search templates by name or industry.
   *
   * @param query Search query (matches name or industry)
   * @returns Matching templates
   * @throws Error if search fails
   *
   * @example
   * ```typescript
   * const results = await templatesService.searchTemplates('SaaS');
   * ```
   */
  async searchTemplates(query: string): Promise<TemplateSummary[]> {
    const templates = await this.listUserTemplates();
    const lowerQuery = query.toLowerCase();

    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(lowerQuery) ||
        t.industry.toLowerCase().includes(lowerQuery) ||
        (t.description?.toLowerCase().includes(lowerQuery) || false)
    );
  }

  /**
   * Get template usage statistics.
   *
   * @returns Stats object with template count and sharing info
   */
  async getStats(): Promise<{
    totalTemplates: number;
    sharedTemplates: number;
    privateTemplates: number;
  }> {
    const templates = await this.listUserTemplates();
    const shared = templates.filter((t) => t.isShared).length;

    return {
      totalTemplates: templates.length,
      sharedTemplates: shared,
      privateTemplates: templates.length - shared,
    };
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Map database template to Template interface.
   * @private
   */
  private mapTemplate(dbTemplate: any): Template {
    return {
      id: dbTemplate.id,
      userId: dbTemplate.user_id,
      name: dbTemplate.name,
      description: dbTemplate.description,
      config: dbTemplate.config,
      isShared: dbTemplate.is_shared,
      createdAt: new Date(dbTemplate.created_at),
      updatedAt: new Date(dbTemplate.updated_at),
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Global singleton instance of the templates service.
 *
 * Usage:
 * ```typescript
 * import { templatesService } from '@/lib/templates';
 *
 * const template = await templatesService.saveTemplate({
 *   name: 'My Template',
 *   config: formData,
 * });
 * ```
 */
export const templatesService = new TemplatesService();
