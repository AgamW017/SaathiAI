import { supabase } from '../db/client.js';
import type { PlacementCreate } from '../schemas/index.js';
import type { PlacementRow } from '../db/types.js';

/**
 * Confirm a learner placement.
 * Updates the learner status to 'placed' and records the placement.
 */
export async function confirmPlacement(
  body: PlacementCreate,
  officerId: string
): Promise<PlacementRow> {
  // Insert placement record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { data: placement, error: placementError } = await client
    .from('placements')
    .insert({
      learner_id: body.learner_id,
      job_id: body.job_id,
      confirmed_by: officerId,
      placement_date: body.placement_date,
      salary: body.salary ?? null,
      notes: body.notes ?? null,
    })
    .select()
    .single();

  if (placementError || !placement) {
    throw new Error((placementError as { message?: string })?.message ?? 'Failed to create placement');
  }

  // Update learner status → placed
  await client
    .from('learners')
    .update({ status: 'placed', updated_at: new Date().toISOString() })
    .eq('id', body.learner_id);

  // Update application status if matching one exists
  await client
    .from('applications')
    .update({ status: 'hired', updated_at: new Date().toISOString() })
    .eq('learner_id', body.learner_id)
    .eq('job_id', body.job_id);

  return placement as PlacementRow;
}
