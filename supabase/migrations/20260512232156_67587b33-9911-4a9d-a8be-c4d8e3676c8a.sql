
-- 1) Função que semeia etapas padrão para um pipeline recém-criado
CREATE OR REPLACE FUNCTION public.seed_default_crm_stages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só semeia se o pipeline ainda não tem etapas
  IF EXISTS (SELECT 1 FROM public.crm_stages WHERE pipeline_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  IF NEW.kind = 'varejo' THEN
    INSERT INTO public.crm_stages (pipeline_id, name, position, color, is_won, is_lost) VALUES
      (NEW.id, 'Carrinho Abandonado', 0, '#F59E0B', false, false),
      (NEW.id, 'Recuperação Iniciada', 1, '#3B82F6', false, false),
      (NEW.id, 'Em Negociação',         2, '#8B5CF6', false, false),
      (NEW.id, 'Pedido Confirmado',     3, '#10B981', true,  false),
      (NEW.id, 'Perdido',               4, '#EF4444', false, true);
  ELSE
    -- atacado / default
    INSERT INTO public.crm_stages (pipeline_id, name, position, color, is_won, is_lost) VALUES
      (NEW.id, 'Primeiro Contato',     0, '#94A3B8', false, false),
      (NEW.id, 'Qualificação',          1, '#3B82F6', false, false),
      (NEW.id, 'Catálogo Enviado',      2, '#6366F1', false, false),
      (NEW.id, 'Orçamento',             3, '#8B5CF6', false, false),
      (NEW.id, 'Negociação',            4, '#F59E0B', false, false),
      (NEW.id, 'Aguardando Pagamento',  5, '#EAB308', false, false),
      (NEW.id, 'Ganho',                 6, '#10B981', true,  false),
      (NEW.id, 'Perdido',               7, '#EF4444', false, true);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_default_crm_stages ON public.crm_pipelines;
CREATE TRIGGER trg_seed_default_crm_stages
AFTER INSERT ON public.crm_pipelines
FOR EACH ROW
EXECUTE FUNCTION public.seed_default_crm_stages();

-- 2) Campos para sincronização de checkouts abandonados do Shopify
ALTER TABLE public.crm_deals
  ADD COLUMN IF NOT EXISTS shopify_checkout_token text,
  ADD COLUMN IF NOT EXISTS shopify_checkout_url   text,
  ADD COLUMN IF NOT EXISTS shopify_customer_email text,
  ADD COLUMN IF NOT EXISTS abandoned_at           timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS crm_deals_shopify_checkout_token_uq
  ON public.crm_deals (organization_id, shopify_checkout_token)
  WHERE shopify_checkout_token IS NOT NULL;
