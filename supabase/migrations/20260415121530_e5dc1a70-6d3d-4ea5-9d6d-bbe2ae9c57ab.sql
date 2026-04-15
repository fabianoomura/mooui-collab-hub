-- Create "Ações Mensais" project
INSERT INTO public.projects (id, name, description, color, created_by)
VALUES ('a1b2c3d4-0001-4000-a000-000000000001', 'Ações Mensais', 'Controle de ações mensais de marketing, lançamentos e eventos', '#7B61FF', '494e75ad-2c33-4d4b-b447-811fde001319');

-- Add creator as member
INSERT INTO public.project_members (project_id, user_id, role)
VALUES ('a1b2c3d4-0001-4000-a000-000000000001', '494e75ad-2c33-4d4b-b447-811fde001319', 'owner');

-- April 2026 tasks
INSERT INTO public.tasks (project_id, title, priority, status, due_date, ticket_number, created_by, position) VALUES
('a1b2c3d4-0001-4000-a000-000000000001', 'Dia do Arquiteto', 'high', 'in_progress', '2026-04-15', 'MOOUI-001', '494e75ad-2c33-4d4b-b447-811fde001319', 0),
('a1b2c3d4-0001-4000-a000-000000000001', 'Páscoa', 'medium', 'done', '2026-04-03', 'MOOUI-002', '494e75ad-2c33-4d4b-b447-811fde001319', 1),
('a1b2c3d4-0001-4000-a000-000000000001', 'Lançamento | 2026 Drop 7 - Tennis', 'high', 'done', '2026-04-07', 'MOOUI-003', '494e75ad-2c33-4d4b-b447-811fde001319', 2),
('a1b2c3d4-0001-4000-a000-000000000001', 'Salone del Mobile | Milão', 'medium', 'todo', '2026-04-10', 'MOOUI-004', '494e75ad-2c33-4d4b-b447-811fde001319', 3),
('a1b2c3d4-0001-4000-a000-000000000001', 'Dia Nacional do Livro Infantil', 'medium', 'todo', '2026-04-18', 'MOOUI-005', '494e75ad-2c33-4d4b-b447-811fde001319', 4),
('a1b2c3d4-0001-4000-a000-000000000001', 'Lançamento | Festa Junina', 'high', 'todo', '2026-04-23', 'MOOUI-006', '494e75ad-2c33-4d4b-b447-811fde001319', 5),
('a1b2c3d4-0001-4000-a000-000000000001', 'Atacado | Feira Ópera (São Paulo)', 'high', 'todo', '2026-04-25', 'MOOUI-007', '494e75ad-2c33-4d4b-b447-811fde001319', 6);

-- May 2026 tasks
INSERT INTO public.tasks (project_id, title, priority, status, due_date, ticket_number, created_by, position) VALUES
('a1b2c3d4-0001-4000-a000-000000000001', 'Lançamento | Match Point', 'high', 'todo', '2026-05-05', 'MOOUI-008', '494e75ad-2c33-4d4b-b447-811fde001319', 7),
('a1b2c3d4-0001-4000-a000-000000000001', 'Ação | Match Point (APT/Nabor)', 'high', 'todo', '2026-05-05', 'MOOUI-009', '494e75ad-2c33-4d4b-b447-811fde001319', 8),
('a1b2c3d4-0001-4000-a000-000000000001', 'Casa Cor | Curitiba', 'medium', 'todo', '2026-05-09', 'MOOUI-010', '494e75ad-2c33-4d4b-b447-811fde001319', 9),
('a1b2c3d4-0001-4000-a000-000000000001', 'Dia das Mães', 'high', 'todo', '2026-05-10', 'MOOUI-011', '494e75ad-2c33-4d4b-b447-811fde001319', 10),
('a1b2c3d4-0001-4000-a000-000000000001', 'Ação | Dia das Mães (almoço ou jantar com mães)', 'high', 'todo', '2026-05-10', 'MOOUI-012', '494e75ad-2c33-4d4b-b447-811fde001319', 11);