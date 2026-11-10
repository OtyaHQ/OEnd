export const OTYAPOINT_READ_ROUTES: Set<string>;
export const OTYAPOINT_POST_ROUTES: Set<string>;
export function isAllowedOtyaPointRoute(method: string, path: string): boolean;
export function isSafeOtyaPointMutation(origin: string | null, requestOrigin: string, fetchSite: string | null): boolean;
export function allowedOtyaPointQueryKeys(path: string): Set<string>;
export function parseOtyaPointBootstrapBody(value: unknown):
  | { ok: true; bootstrapKey: string; displayName: string }
  | { ok: false; code: string };
