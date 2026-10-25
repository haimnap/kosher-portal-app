// Server-only helpers for companies that have several people.
//
// A company is stored as one "main" account (owns the certifications,
// remembers the Monday item) plus team-member accounts that point at it
// through profiles.company_owner_id.

import type { SupabaseClient } from '@supabase/supabase-js';

// Makes `newOwnerId` the company's main account instead of `oldOwnerId`:
// moves the team members, the certifications and the Monday link over,
// and turns the old main account into an ordinary team member.
// `admin` must be the service-role client.
export async function transferCompanyOwnership(admin: SupabaseClient, oldOwnerId: string, newOwnerId: string) {
  if (oldOwnerId === newOwnerId) return;

  const { data: oldOwner, error: readError } = await admin
    .from('profiles')
    .select('monday_item_id, company_name')
    .eq('id', oldOwnerId)
    .single();
  if (readError) throw new Error(readError.message);

  // The new main account must not point at anyone itself.
  const { error: promoteError } = await admin
    .from('profiles')
    .update({
      company_owner_id: null,
      monday_item_id: oldOwner?.monday_item_id ?? null,
      company_name: oldOwner?.company_name ?? null,
    })
    .eq('id', newOwnerId);
  if (promoteError) throw new Error(promoteError.message);

  const { error: membersError } = await admin
    .from('profiles')
    .update({ company_owner_id: newOwnerId })
    .eq('company_owner_id', oldOwnerId)
    .neq('id', newOwnerId);
  if (membersError) throw new Error(membersError.message);

  const { error: certsError } = await admin
    .from('certifications')
    .update({ client_id: newOwnerId })
    .eq('client_id', oldOwnerId);
  if (certsError) throw new Error(certsError.message);

  const { error: oldError } = await admin
    .from('profiles')
    .update({ company_owner_id: newOwnerId, monday_item_id: null })
    .eq('id', oldOwnerId);
  if (oldError) throw new Error(oldError.message);
}
