export const OPOINT_STAFF_INVITATION_PATH = '/internal/notifications/opoint/staff-invitation' as const;
export const OPOINT_STAFF_INVITATION_ROLES = [
  'ADMIN',
  'MANAGER',
  'CASHIER',
  'AGENT',
  'ACCOUNTANT',
  'AUDITOR',
] as const;

export type OpointStaffInvitationRole = (typeof OPOINT_STAFF_INVITATION_ROLES)[number];

const allowedRoles = new Set<string>(OPOINT_STAFF_INVITATION_ROLES);

export function isOpointStaffInvitationPath(pathname: string): boolean {
  return pathname === OPOINT_STAFF_INVITATION_PATH;
}

export function isAllowedOpointStaffInvitationRole(
  value: unknown,
): value is OpointStaffInvitationRole {
  return typeof value === 'string' && allowedRoles.has(value);
}
