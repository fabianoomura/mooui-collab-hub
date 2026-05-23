DO $$
DECLARE
  r RECORD;
  pairs text[][] := ARRAY[
    -- table, column, on_delete
    ARRAY['organization_members','user_id','CASCADE'],
    ARRAY['user_roles','user_id','CASCADE'],
    ARRAY['channel_members','user_id','CASCADE'],
    ARRAY['messages','user_id','CASCADE'],
    ARRAY['message_reactions','user_id','CASCADE'],
    ARRAY['department_members','user_id','CASCADE'],
    ARRAY['project_members','user_id','CASCADE'],
    ARRAY['task_assignees','user_id','CASCADE'],
    ARRAY['task_activity_log','user_id','CASCADE'],
    ARRAY['doc_favorites','user_id','CASCADE'],
    ARRAY['notifications','user_id','CASCADE'],
    ARRAY['ticket_attachments','user_id','CASCADE'],
    ARRAY['ticket_comments','user_id','CASCADE'],
    ARRAY['order_comments','user_id','CASCADE'],
    ARRAY['meeting_room_bookings','user_id','CASCADE'],
    ARRAY['tickets','assigned_to','SET NULL'],
    ARRAY['orders','assigned_to','SET NULL'],
    ARRAY['launch_stages','assignee_id','SET NULL'],
    ARRAY['launch_checklist_items','assignee_id','SET NULL'],
    ARRAY['doc_pages','updated_by','SET NULL'],
    ARRAY['ticket_activity','user_id','SET NULL'],
    ARRAY['order_activity','user_id','SET NULL']
  ];
  i int;
  tbl text; col text; act text; cname text;
BEGIN
  FOR i IN 1 .. array_length(pairs, 1) LOOP
    tbl := pairs[i][1];
    col := pairs[i][2];
    act := pairs[i][3];
    cname := tbl || '_' || col || '_profile_fkey';
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      WHERE t.relname = tbl AND c.conname = cname
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.profiles(id) ON DELETE %s',
        tbl, cname, col, act
      );
    END IF;
  END LOOP;
END $$;