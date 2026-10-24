// Run with `npm test` (node --test). Node 24 loads the .ts module directly.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  adminPath,
  administersCompany,
  allowedWorkspaces,
  canOpenWorkspace,
  homePath,
} from './workspace.ts';

const admin = {
  approval_status: 'APPROVED',
  workspaces: ['admin', 'manager'],
  administered_company_ids: [2],
};
const employeeAdmin = {
  approval_status: 'APPROVED',
  workspaces: ['admin', 'employee'],
  administered_company_ids: [2],
};
const adminOnly = {
  approval_status: 'APPROVED',
  workspaces: ['admin'],
  administered_company_ids: [2],
};
const manager = { approval_status: 'APPROVED', workspaces: ['manager'], administered_company_ids: [] };

test('an administration-only account lands in the Admin console and nowhere else', () => {
  assert.equal(homePath(adminOnly), '/admin');
  assert.equal(canOpenWorkspace(adminOnly, 'admin'), true);
  assert.equal(canOpenWorkspace(adminOnly, 'manager'), false);
  assert.equal(canOpenWorkspace(adminOnly, 'employee'), false);
});

test('a deactivated account opens nothing, even with stale workspaces', () => {
  const user = { ...adminOnly, approval_status: 'DEACTIVATED' };
  assert.equal(homePath(user), '/pending-approval');
  assert.deepEqual(allowedWorkspaces(user), []);
});
const employee = { approval_status: 'APPROVED', workspaces: ['employee'], administered_company_ids: [] };

test('sign-in lands each role in its own workspace', () => {
  assert.equal(homePath(admin), '/admin');
  assert.equal(homePath(employeeAdmin), '/admin');
  assert.equal(homePath(manager), '/manager');
  assert.equal(homePath(employee), '/employee');
});

test('signed-out, pending and rejected users never reach a workspace', () => {
  assert.equal(homePath(null), '/login');
  for (const status of ['PENDING', 'REJECTED']) {
    // Even if a stale client copy still lists workspaces, they are ignored.
    const user = { ...admin, approval_status: status };
    assert.equal(homePath(user), '/pending-approval');
    assert.deepEqual(allowedWorkspaces(user), []);
    assert.equal(canOpenWorkspace(user, 'admin'), false);
  }
});

test('approved account without any workspace waits on the pending page', () => {
  assert.equal(homePath({ approval_status: 'APPROVED', workspaces: [] }), '/pending-approval');
});

test('a Company Admin keeps their project role as a second workspace', () => {
  assert.equal(canOpenWorkspace(admin, 'manager'), true);
  assert.equal(canOpenWorkspace(admin, 'employee'), false);
  assert.equal(canOpenWorkspace(employeeAdmin, 'employee'), true);
  assert.equal(canOpenWorkspace(employeeAdmin, 'manager'), false);
});

test('managers and employees cannot open the Admin console', () => {
  assert.equal(canOpenWorkspace(manager, 'admin'), false);
  assert.equal(canOpenWorkspace(employee, 'admin'), false);
  assert.equal(canOpenWorkspace(employee, 'manager'), false);
});

test('admin pages are tied to the specific administered company', () => {
  assert.equal(adminPath(2), '/admin/2/overview');
  assert.equal(adminPath(2, 'members'), '/admin/2/members');
  assert.equal(administersCompany(admin, 2), true);
  assert.equal(administersCompany(admin, 3), false);
  assert.equal(administersCompany(admin, null), false);
  assert.equal(administersCompany(manager, 2), false);
});

test('several administered companies are each allowed, others are not', () => {
  const multi = { ...admin, administered_company_ids: [2, 5] };
  assert.equal(administersCompany(multi, 5), true);
  assert.equal(administersCompany(multi, 4), false);
});
