
-- Favorites
CREATE TABLE public.doc_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  page_id uuid NOT NULL REFERENCES public.doc_pages(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, page_id)
);
ALTER TABLE public.doc_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own favorites" ON public.doc_favorites
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own favorites" ON public.doc_favorites
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own favorites" ON public.doc_favorites
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Templates
CREATE TABLE public.doc_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  name text NOT NULL,
  icon text DEFAULT '📄',
  description text,
  content text NOT NULL DEFAULT '',
  is_global boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.doc_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View global or org templates" ON public.doc_templates
  FOR SELECT TO authenticated
  USING (is_global = true OR (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id)));

CREATE POLICY "Org admins create templates" ON public.doc_templates
  FOR INSERT TO authenticated
  WITH CHECK (organization_id IS NOT NULL AND is_org_admin(auth.uid(), organization_id) AND auth.uid() = created_by);

CREATE POLICY "Org admins update templates" ON public.doc_templates
  FOR UPDATE TO authenticated
  USING (organization_id IS NOT NULL AND is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Org admins delete templates" ON public.doc_templates
  FOR DELETE TO authenticated
  USING (organization_id IS NOT NULL AND is_org_admin(auth.uid(), organization_id));

CREATE TRIGGER doc_templates_updated_at
  BEFORE UPDATE ON public.doc_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed global templates
INSERT INTO public.doc_templates (name, icon, description, content, is_global) VALUES
('Ata de reunião', '📝', 'Modelo para registrar reuniões',
'# Ata de reunião

**Data:** 
**Participantes:** 
**Objetivo:** 

## Pauta
- 

## Decisões
- 

## Próximos passos
- [ ] 
', true),
('PRD', '📋', 'Product Requirements Document',
'# PRD — Nome do produto/feature

## Contexto e problema

## Objetivo

## Métricas de sucesso

## Escopo
### Dentro do escopo
- 
### Fora do escopo
- 

## Requisitos funcionais
- 

## Requisitos não-funcionais
- 

## Riscos e dependências
', true),
('Runbook', '🚨', 'Procedimento operacional',
'# Runbook — Nome do procedimento

## Quando usar

## Pré-requisitos
- 

## Passos
1. 
2. 
3. 

## Verificação

## Rollback

## Contatos
', true),
('Onboarding', '🎓', 'Roteiro de onboarding',
'# Onboarding

## Boas-vindas!

## Primeira semana
- [ ] Acessos
- [ ] Apresentação ao time
- [ ] Setup do ambiente

## Primeiro mês
- [ ] 
- [ ] 

## Recursos úteis
- 
', true);

-- Full-text search index on content (portuguese)
CREATE INDEX doc_pages_content_fts ON public.doc_pages
  USING gin (to_tsvector('portuguese', coalesce(title,'') || ' ' || coalesce(content,'')));
