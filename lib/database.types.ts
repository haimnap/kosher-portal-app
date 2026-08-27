// Shared TypeScript types matching the Supabase schema (supabase/schema.sql).
// Keep in sync manually, or generate with:
//   npx supabase gen types typescript --project-id <your-project-id> > lib/database.types.ts

export type Role = 'client' | 'staff' | 'admin';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type ComputedStatus = 'pending' | 'rejected' | 'active' | 'expiring_soon' | 'expired';
export type PreferredLanguage = 'es' | 'en' | 'pt';

export interface Profile {
  id: string;
  role: Role;
  company_name: string | null;
  contact_name: string | null;
  phone: string | null;
  address: string | null;
  preferred_language: PreferredLanguage;
  created_at: string;
  updated_at: string;
}

export interface Certification {
  id: string;
  client_id: string;
  product_name: string;
  product_category: string | null;
  certification_number: string;
  date_issued: string | null;
  expiration_date: string;
  approval_status: ApprovalStatus;
  mashguiach_notes: string | null;
  monday_item_id: string | null;
  approved_by: string | null;
  approval_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface CertificationWithStatus extends Certification {
  status: ComputedStatus;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface ReminderLog {
  id: string;
  certification_id: string;
  threshold_days: number;
  sent_at: string;
}
