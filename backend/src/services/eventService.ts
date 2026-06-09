import { supabase } from '../db/client.js';
import type { BotEvent } from '../schemas/index.js';
import type { EventRow } from '../db/types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const client = supabase as any;

/**
 * Ingest a bot event into the Supabase events table.
 */
export async function recordBotEvent(event: BotEvent): Promise<EventRow> {
  const { data, error } = await client
    .from('events')
    .insert({
      learner_id: event.learner_id ?? null,
      event_type: event.event_type,
      source: 'bot',
      metadata: event.metadata ?? {},
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error((error as { message?: string })?.message ?? 'Failed to record event');
  }

  // If the event carries a phone and we can find a learner, try to link them
  if (event.phone && !event.learner_id) {
    const { data: learner } = await client
      .from('learners')
      .select('id')
      .eq('phone', event.phone)
      .single();

    if (learner) {
      await client
        .from('events')
        .update({ learner_id: (learner as { id: string }).id })
        .eq('id', (data as EventRow).id);
    }
  }

  return data as EventRow;
}

/**
 * Fetch recent events (for admin audit).
 */
export async function getRecentEvents(limit = 50): Promise<EventRow[]> {
  const { data, error } = await client
    .from('events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error((error as { message?: string })?.message ?? 'Query failed');
  return (data ?? []) as EventRow[];
}
