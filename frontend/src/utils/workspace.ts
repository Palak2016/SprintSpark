/**
 * Which workspaces a signed-in user may open, and where the app sends them.
 *
 * The list comes from the server (`/auth/me` -> `workspaces`), which derives
 * it from the user's approval status, company role and active Company Admin
 * grants. This module only decides navigation; every API call is authorized
 * again by the backend.
 *
 * Kept free of imports so `node --test` can load it directly.
 */

export type Workspace = 'admin' | 'manager' | 'employee';

export interface WorkspaceUser {
  approval_status?: string;
  workspaces?: Workspace[];
  administered_company_ids?: number[];
}

export const WORKSPACE_LABELS: Record<Workspace, string> = {
  admin: 'Admin console',
  manager: 'Manager workspace',
  employee: 'My workspace',
};

const WORKSPACE_HOME: Record<Workspace, string> = {
  admin: '/admin',
  manager: '/manager',
  employee: '/employee',
};

export const isApprovedUser = (user: WorkspaceUser | null | undefined): boolean =>
  user?.approval_status === 'APPROVED';

/** Workspaces the server allows, most specific first. */
export const allowedWorkspaces = (user: WorkspaceUser | null | undefined): Workspace[] =>
  isApprovedUser(user) ? (user?.workspaces ?? []) : [];

export const canOpenWorkspace = (
  user: WorkspaceUser | null | undefined,
  workspace: Workspace,
): boolean => allowedWorkspaces(user).includes(workspace);

export const workspaceHome = (workspace: Workspace): string => WORKSPACE_HOME[workspace];

/**
 * Where to send a user after sign-in, or when they open a page they may not use.
 * Company Admins land in the Admin console; everyone else in their own workspace.
 */
export const homePath = (user: WorkspaceUser | null | undefined): string => {
  if (!user) return '/login';
  if (!isApprovedUser(user)) return '/pending-approval';
  const [first] = allowedWorkspaces(user);
  return first ? WORKSPACE_HOME[first] : '/pending-approval';
};

/** /admin/<companyId>/<section> for a company this user administers. */
export const adminPath = (companyId: number, section = 'overview'): string =>
  `/admin/${companyId}/${section}`;

/** True when the user holds an active Company Admin grant for this company. */
export const administersCompany = (
  user: WorkspaceUser | null | undefined,
  companyId: number | null,
): boolean =>
  companyId !== null &&
  canOpenWorkspace(user, 'admin') &&
  (user?.administered_company_ids ?? []).includes(companyId);
