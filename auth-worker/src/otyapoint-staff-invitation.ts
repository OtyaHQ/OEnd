export const OTYAPOINT_STAFF_INVITATION_PATH = '/internal/notifications/otyapoint/staff-invitation' as const;
export const LEGACY_OPINT_STAFF_INVITATION_PATH = '/internal/notifications/omnipoint/staff-invitation' as const;

export const OTYAPOINT_STAFF_INVITATION_ROLES = [
  'OWNER',
  'ADMIN',
  'MANAGER',
  'CASHIER',
  'AGENT',
  'ACCOUNTANT',
  'AUDITOR',
] as const;

// Transitional values are accepted only to avoid breaking the retired v1
// Cloudflare API while it is being removed. New OtyaPoint invitations must use
// the canonical role values above.
export const LEGACY_OPINT_STAFF_INVITATION_ROLES = [
  'ATTENDANT',
  'MANAGING_DIRECTOR',
  'CHAIRMAN',
] as const;

export type OtyaPointStaffInvitationRole =
  | (typeof OTYAPOINT_STAFF_INVITATION_ROLES)[number]
  | (typeof LEGACY_OPINT_STAFF_INVITATION_ROLES)[number];

const allowedRoles = new Set<string>([
  ...OTYAPOINT_STAFF_INVITATION_ROLES,
  ...LEGACY_OPINT_STAFF_INVITATION_ROLES,
]);

export function isOtyaPointStaffInvitationPath(pathname: string): boolean {
  return pathname === OTYAPOINT_STAFF_INVITATION_PATH
    || pathname === LEGACY_OPINT_STAFF_INVITATION_PATH;
}

export function isAllowedOtyaPointStaffInvitationRole(
  value: unknown,
): value is OtyaPointStaffInvitationRole {
  return typeof value === 'string' && allowedRoles.has(value);
}
