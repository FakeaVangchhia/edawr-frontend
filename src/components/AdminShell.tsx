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
      <div className="rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm backdrop-blur">
        {adminUser.username}
      </div>
      <button
        onClick={onBackToStore}
        className="secondary-action px-4 py-2 text-sm font-semibold shadow-sm backdrop-blur transition"
      >
        Back to Store
      </button>
      <button
        onClick={onLogout}
        className="secondary-action inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold shadow-sm backdrop-blur transition"
      >
        <LogOut className="h-4 w-4" />
        Logout
      </button>
    </div>
  );

  return (
    <div className="relative min-h-screen bg-transparent">
      <ManagerDashboard headerActions={headerActions} />
    </div>
  );
}
