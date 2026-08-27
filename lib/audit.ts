import { SupabaseClient } from '@supabase/supabase-js';

// Writes one row to audit_logs. Call this after any meaningful
// write (approve, reject, create, print) so there's a full trail
// of who did what and when — useful for compliance and for
// resolving client disputes ("I never approved that").
export async function logAudit(
  supabase: SupabaseClient,
  params: {
    userId: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    details?: Record<string, unknown>;
  }
) {
  const { error } = await supabase.from('audit_logs').insert({
    user_id: params.userId,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    details: params.details ?? null,
  });

  if (error) {
    // Never let audit logging failures break the primary action.
    console.error('audit log failed:', error.message);
  }
}
