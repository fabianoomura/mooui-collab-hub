
-- 1. Atualiza is_org_admin para incluir diretores (acesso global)
CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND organization_id = _org_id AND role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'director'
      AND EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = _user_id AND om.organization_id = _org_id
      )
  )
$$;

-- 2. Função para listar membros de um departamento por nome
CREATE OR REPLACE FUNCTION public.get_dept_member_ids(_org_id uuid, _dept_name text)
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT dm.user_id
  FROM public.department_members dm
  JOIN public.org_departments d ON d.id = dm.department_id
  WHERE d.organization_id = _org_id
    AND lower(d.name) = lower(_dept_name)
$$;

-- 3. Popular departamentos do Brasil
-- TI: Fabiano (master), Alice (admin)
INSERT INTO public.department_members (department_id, user_id, role)
SELECT 'b36921c4-c831-43c5-a25c-a9f073becdb1'::uuid, om.user_id,
  CASE WHEN p.full_name = 'Fabiano Omura' THEN 'manager' ELSE 'operator' END
FROM public.organization_members om
JOIN public.profiles p ON p.id = om.user_id
WHERE om.organization_id = '0d32934f-9628-4bd5-b3f4-1bc74f9227de'
  AND p.full_name IN ('Fabiano Omura', 'Alice Teste')
ON CONFLICT DO NOTHING;

-- Marketing: Bob como operador, Thais como gerente
INSERT INTO public.department_members (department_id, user_id, role)
SELECT '56d6d724-335c-4161-b601-14f2193db0c4'::uuid, om.user_id,
  CASE WHEN p.full_name = 'Thais Master' THEN 'manager' ELSE 'operator' END
FROM public.organization_members om
JOIN public.profiles p ON p.id = om.user_id
WHERE om.organization_id = '0d32934f-9628-4bd5-b3f4-1bc74f9227de'
  AND p.full_name IN ('Bob Teste', 'Thais Master')
ON CONFLICT DO NOTHING;

-- Vendas: Alice operadora
INSERT INTO public.department_members (department_id, user_id, role)
SELECT '0dff255f-34fb-436d-9d50-00cb2b502279'::uuid, om.user_id, 'operator'
FROM public.organization_members om
JOIN public.profiles p ON p.id = om.user_id
WHERE om.organization_id = '0d32934f-9628-4bd5-b3f4-1bc74f9227de'
  AND p.full_name = 'Alice Teste'
ON CONFLICT DO NOTHING;

-- Operações: Bob operador
INSERT INTO public.department_members (department_id, user_id, role)
SELECT 'b8863040-44cc-4a56-b23a-2a7bcf72f85b'::uuid, om.user_id, 'operator'
FROM public.organization_members om
JOIN public.profiles p ON p.id = om.user_id
WHERE om.organization_id = '0d32934f-9628-4bd5-b3f4-1bc74f9227de'
  AND p.full_name = 'Bob Teste'
ON CONFLICT DO NOTHING;

-- Financeiro: Thais gerente
INSERT INTO public.department_members (department_id, user_id, role)
SELECT 'bf98ae59-ab36-463c-9be4-bee7bbd30b1a'::uuid, om.user_id, 'manager'
FROM public.organization_members om
JOIN public.profiles p ON p.id = om.user_id
WHERE om.organization_id = '0d32934f-9628-4bd5-b3f4-1bc74f9227de'
  AND p.full_name = 'Thais Master'
ON CONFLICT DO NOTHING;

-- Design: Alice operadora
INSERT INTO public.department_members (department_id, user_id, role)
SELECT '43353abb-b6b7-483d-832a-b54c5ff67e99'::uuid, om.user_id, 'operator'
FROM public.organization_members om
JOIN public.profiles p ON p.id = om.user_id
WHERE om.organization_id = '0d32934f-9628-4bd5-b3f4-1bc74f9227de'
  AND p.full_name = 'Alice Teste'
ON CONFLICT DO NOTHING;
