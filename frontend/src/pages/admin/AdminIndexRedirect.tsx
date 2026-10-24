import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { adminPath } from '../../utils/workspace';

/** /admin -> the first company this user administers (server list). */
export const AdminIndexRedirect: React.FC = () => {
  const { user, homePath } = useAuth();
  const firstId = user?.administered_company_ids?.[0];
  if (!firstId) {
    return <Navigate to={homePath === '/admin' ? '/pending-approval' : homePath} replace />;
  }
  return <Navigate to={adminPath(firstId)} replace />;
};

/** Old /company/<id>/<section> links (notifications, bookmarks) -> Admin console. */
export const LegacyCompanyRedirect: React.FC = () => {
  const { companyId, section } = useParams();
  const id = Number(companyId);
  if (!Number.isInteger(id) || id <= 0) return <Navigate to="/admin" replace />;
  return <Navigate to={adminPath(id, section || 'overview')} replace />;
};

export default AdminIndexRedirect;
