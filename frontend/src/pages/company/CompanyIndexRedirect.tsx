import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/** /company -> /company/<first administered company>. */
export const CompanyIndexRedirect: React.FC = () => {
  const { user, isManager } = useAuth();
  const firstId = user?.administered_company_ids?.[0];
  if (!firstId) {
    return <Navigate to={isManager ? '/manager' : '/employee'} replace />;
  }
  return <Navigate to={`/company/${firstId}`} replace />;
};

export default CompanyIndexRedirect;
