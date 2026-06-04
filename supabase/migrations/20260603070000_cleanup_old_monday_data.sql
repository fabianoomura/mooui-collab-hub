-- ============================================================
-- CLEANUP: Remove old Monday.com imported data (before 2026)
-- Keep everything from 2026 onwards + items with no date (NULL)
-- Child records are auto-deleted via ON DELETE CASCADE
-- ============================================================

BEGIN;

-- 1. Melhorias (data_abertura < 2026)
DELETE FROM public.melhorias
WHERE data_abertura < '2026-01-01';

-- 2. Conteudo items (scheduled_date < 2026)
DELETE FROM public.conteudo_items
WHERE scheduled_date < '2026-01-01';

-- 3. Newsletters (scheduled_date < 2026)
DELETE FROM public.newsletters
WHERE scheduled_date < '2026-01-01';

-- 4. Pautas (scheduled_date < 2026)
-- pauta_items cascade-deleted
DELETE FROM public.pautas
WHERE scheduled_date < '2026-01-01';

-- 5. Sessoes (scheduled_date < 2026)
-- sessao_shots cascade-deleted
DELETE FROM public.sessoes
WHERE scheduled_date < '2026-01-01';

-- 6. Produtos (launch_target < 2026, or no launch_target but cronograma_end < 2026)
-- produto_stages + produto_design_items cascade-deleted
DELETE FROM public.produtos
WHERE (launch_target IS NOT NULL AND launch_target < '2026-01-01')
   OR (launch_target IS NULL AND cronograma_end IS NOT NULL AND cronograma_end < '2026-01-01');

-- 7. Annual events (start_date < 2026)
-- annual_event_etapas cascade-deleted
DELETE FROM public.annual_events
WHERE start_date < '2026-01-01';

COMMIT;
