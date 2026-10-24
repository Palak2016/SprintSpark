// Run with `npm test` (node --test). Node 24 loads the .ts module directly.
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSignupDetails } from './signup.ts';

test('"Create a company" sends a company name and never a code', () => {
  assert.deepEqual(
    buildSignupDetails({ role: 'ADMIN', companyName: '  Acme  ', companyCode: 'IGNORED', designation: '' }),
    { company_name: 'Acme' },
  );
});

test('manager access for a founder is sent only when explicitly ticked', () => {
  assert.deepEqual(
    buildSignupDetails({ role: 'ADMIN', companyName: 'Acme', designation: ' Founder ', alsoManager: true }),
    { company_name: 'Acme', designation: 'Founder', also_manager: true },
  );
  assert.equal('also_manager' in buildSignupDetails({ role: 'ADMIN', companyName: 'Acme' }), false);
});

test('managers join with a code and designation, never a company name', () => {
  const details = buildSignupDetails({
    role: 'MANAGER', companyName: 'Should not be sent', companyCode: ' ab12cd34 ', designation: ' Lead ', alsoManager: true,
  });
  assert.deepEqual(details, { company_code: 'AB12CD34', designation: 'Lead' });
});

test('employees join with a code only', () => {
  assert.deepEqual(
    buildSignupDetails({ role: 'EMPLOYEE', companyCode: 'xyz98765', designation: 'ignored' }),
    { company_code: 'XYZ98765' },
  );
});

test('invitations carry only the token (plus a manager designation)', () => {
  assert.deepEqual(
    buildSignupDetails({ role: 'EMPLOYEE', inviteToken: 'tok', companyCode: 'X', companyName: 'Y' }),
    { invitation_token: 'tok' },
  );
  assert.deepEqual(
    buildSignupDetails({ role: 'MANAGER', inviteToken: 'tok', designation: 'Lead' }),
    { invitation_token: 'tok', designation: 'Lead' },
  );
});
