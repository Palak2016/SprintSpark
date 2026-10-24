/**
 * What the signup form sends for each of the three signup paths. The backend
 * validates the same rules (and rejects anything else); this keeps the form
 * from ever mixing them. Kept import-free so `node --test` can load it.
 */

export type SignupRole = 'ADMIN' | 'MANAGER' | 'EMPLOYEE';

export interface SignupFormState {
  role: SignupRole;
  inviteToken?: string | null;
  companyName?: string;
  companyCode?: string;
  designation?: string;
  alsoManager?: boolean;
}

export interface SignupDetails {
  invitation_token?: string;
  company_name?: string;
  company_code?: string;
  designation?: string;
  also_manager?: boolean;
}

export const buildSignupDetails = (form: SignupFormState): SignupDetails => {
  const designation = form.designation?.trim() ?? '';

  // Invitation: the company and role come from the invitation itself.
  if (form.inviteToken) {
    return {
      invitation_token: form.inviteToken,
      ...(form.role === 'MANAGER' ? { designation } : {}),
    };
  }

  // A. Create a new company; the creator becomes its Company Admin.
  if (form.role === 'ADMIN') {
    return {
      company_name: form.companyName?.trim() ?? '',
      ...(designation ? { designation } : {}),
      ...(form.alsoManager ? { also_manager: true } : {}),
    };
  }

  // B / C. Join an existing company with its signup code.
  const company_code = form.companyCode?.trim().toUpperCase() ?? '';
  return form.role === 'MANAGER' ? { company_code, designation } : { company_code };
};
