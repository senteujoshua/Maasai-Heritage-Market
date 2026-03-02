import { createAdminClient } from '@/lib/supabase/server';

interface AuditParams {
  actorId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  payload?: Record<string, unknown>;
}

/**
 * Write an immutable audit-log entry via the admin client.
 * Errors are swallowed (never block the main request path).
 */
export async function auditLog({ actorId, action, entityType, entityId, payload }: AuditParams) {
  try {
    const supabase = await createAdminClient();
    await supabase.rpc('write_audit_log', {
      p_actor_id:    actorId,
      p_action:      action,
      p_entity_type: entityType ?? null,
      p_entity_id:   entityId ?? null,
      p_payload:     payload ?? {},
    });
  } catch {
    // audit failures must never crash the request
  }
}
