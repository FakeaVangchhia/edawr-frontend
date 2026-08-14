'use client';

import { LogOut } from 'lucide-react';
import ManagerDashboard from './ManagerDashboard';
import { AdminSession } from '../types';

type AdminShellProps = {
  adminUser: AdminSession;
  onBackToStore: () => void;
  onLogout: () => void;
};

export default function AdminShell({ adminUser, onBackToStore, onLogout }: AdminShellProps) {
  const headerActions = (
    <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
      <div className="pill">{adminUser.username}</div>
      <button type="button" onClick={onBackToStore} className="btn-ghost">
        Back to store
      </button>
      <button
        type="button"
        onClick={onLogout}
        className="btn-ghost inline-flex items-center gap-2"
      >
        <LogOut className="h-4 w-4" aria-hidden />
        Log out
      </button>
    </div>
  );

  return (
    <div className="relative min-h-dvh bg-transparent">
      <ManagerDashboard headerActions={headerActions} />
    </div>
  );
}
