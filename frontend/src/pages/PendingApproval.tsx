import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Clock, LogOut, RefreshCw, XCircle } from 'lucide-react';
import { Logo } from '../components/common/Logo';
import { useAuth } from '../context/AuthContext';

/** Shown to signed-in users whose company membership is not yet approved
 * (or was rejected). The backend blocks all business endpoints for them. */
export const PendingApproval: React.FC = () => {
  const navigate = useNavigate();
  const { user, isApproved, isManager, refreshUser, logout } = useAuth();
  const [checking, setChecking] = useState(false);

  if (!user) return <Navigate to="/login" replace />;
  if (isApproved) return <Navigate to={isManager ? '/manager' : '/employee'} replace />;

  const rejected = user.approval_status === 'REJECTED';

  const check = async () => {
    setChecking(true);
    await refreshUser();
    setChecking(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#100B1D] p-4 text-[#FAF8FF]">
      <section className="w-full max-w-md rounded-2xl border border-violet-300/20 bg-[#19112B] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.55)]">
        <Logo size="sm" onDarkBackground />
        <div className="mt-6 flex items-center gap-3">
          {rejected ? (
            <XCircle className="h-6 w-6 text-rose-300" />
          ) : (
            <Clock className="h-6 w-6 text-amber-300" />
          )}
          <h1 className="text-xl font-semibold text-white">
            {rejected ? 'Membership not approved' : 'Waiting for approval'}
          </h1>
        </div>
        <p className="mt-3 text-sm leading-6 text-[#B7ADC9]">
          {rejected
            ? `Your request to join ${user.company_name ?? 'this company'} was not approved by its Company Admin. Contact them if you think this is a mistake.`
            : `Your account for ${user.company_name ?? 'your company'} has been created. Its Company Admin needs to approve it before you can use WorkPilot.`}
        </p>
        <div className="mt-6 flex gap-2">
          {!rejected && (
            <button
              type="button"
              onClick={() => void check()}
              disabled={checking}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
              Check again
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              logout();
              navigate('/login', { replace: true });
            }}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-[#D8D0E7] hover:bg-white/[0.05]"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </section>
    </div>
  );
};

export default PendingApproval;
