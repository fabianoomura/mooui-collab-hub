-- Order attachments table
create table if not exists public.order_attachments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  file_name text not null,
  file_url text not null,
  file_type text,
  file_size bigint,
  created_at timestamptz not null default now()
);

alter table public.order_attachments enable row level security;

create policy "Members can view order attachments"
  on public.order_attachments for select
  using (
    exists (
      select 1 from public.orders o
      join public.organization_members om on om.organization_id = o.organization_id
      where o.id = order_attachments.order_id
        and om.user_id = auth.uid()
    )
  );

create policy "Members can insert order attachments"
  on public.order_attachments for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.orders o
      join public.organization_members om on om.organization_id = o.organization_id
      where o.id = order_attachments.order_id
        and om.user_id = auth.uid()
    )
  );

create policy "Owner can delete order attachments"
  on public.order_attachments for delete
  using (auth.uid() = user_id);

-- Storage bucket (idempotent)
insert into storage.buckets (id, name, public)
values ('order-attachments', 'order-attachments', false)
on conflict (id) do nothing;

create policy "Authenticated users can upload order attachments"
  on storage.objects for insert
  with check (bucket_id = 'order-attachments' and auth.role() = 'authenticated');

create policy "Authenticated users can read order attachments"
  on storage.objects for select
  using (bucket_id = 'order-attachments' and auth.role() = 'authenticated');

create policy "Users can delete own order attachments"
  on storage.objects for delete
  using (bucket_id = 'order-attachments' and auth.role() = 'authenticated');
