CREATE TABLE public.wizard_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wizard_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own wizard drafts" ON public.wizard_drafts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own wizard drafts" ON public.wizard_drafts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own wizard drafts" ON public.wizard_drafts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own wizard drafts" ON public.wizard_drafts FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_wizard_drafts_user ON public.wizard_drafts(user_id, updated_at DESC);

CREATE TRIGGER trg_wizard_drafts_updated BEFORE UPDATE ON public.wizard_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();