import { supabase } from '@/integrations/supabase/client';

/**
 * Posts an automated message to a channel by name.
 * Finds the channel in the given org, then inserts a message as the given user.
 * Silently fails if channel doesn't exist.
 */
export async function autoPostToChannel(opts: {
  orgId: string;
  channelName: string;
  userId: string;
  content: string;
}) {
  try {
    const { data: channel } = await supabase
      .from('channels')
      .select('id')
      .eq('organization_id', opts.orgId)
      .eq('name', opts.channelName)
      .limit(1)
      .single();
    if (!channel) return;
    await supabase.from('messages').insert({
      channel_id: channel.id,
      user_id: opts.userId,
      content: opts.content,
    });
  } catch {
    // Silently ignore — channel may not exist
  }
}
