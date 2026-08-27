import { Certification, CertificationWithStatus, ComputedStatus } from './database.types';

// Mirrors the SQL view `certifications_with_status` — used when we
// already have a plain Certification row in JS and want the same
// status label without a round trip to the DB (e.g. right after an
// optimistic UI update).
export function computeStatus(cert: Certification): ComputedStatus {
  if (cert.approval_status !== 'approved') return cert.approval_status;

  const expiration = new Date(cert.expiration_date);
  const now = new Date();
  const in30Days = new Date();
  in30Days.setDate(now.getDate() + 30);

  if (expiration < now) return 'expired';
  if (expiration < in30Days) return 'expiring_soon';
  return 'active';
}

export function withStatus(cert: Certification): CertificationWithStatus {
  return { ...cert, status: computeStatus(cert) };
}

export const STATUS_LABELS: Record<ComputedStatus, string> = {
  pending: 'Pending Review',
  rejected: 'Rejected',
  active: 'Active',
  expiring_soon: 'Expiring Soon',
  expired: 'Expired',
};

export const STATUS_COLORS: Record<ComputedStatus, { bg: string; text: string }> = {
  pending: { bg: 'bg-amber-100', text: 'text-amber-800' },
  rejected: { bg: 'bg-red-100', text: 'text-red-800' },
  active: { bg: 'bg-green-100', text: 'text-green-800' },
  expiring_soon: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  expired: { bg: 'bg-red-100', text: 'text-red-800' },
};
