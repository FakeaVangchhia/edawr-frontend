import { LogOut } from 'lucide-react';
import ManagerDashboard from './ManagerDashboard';
import { User } from '../types';

type AdminShellProps = {
  adminUser: User;
  onBackToStore: () => void;
  onLogout: () => void;
};

export default function AdminShell({ adminUser, onBackToStore, onLogout }: AdminShellProps) {
  return (
    <div className="relative min-h-screen bg-transparent">
      <div className="fixed right-4 top-4 z-20 flex items-center gap-3">
        <div className="hidden rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-slate-600 shadow-lg backdrop-blur sm:block">
          {adminUser.name}
        </div>
        <button
          onClick={onBackToStore}
          className="secondary-action px-4 py-2 text-sm font-semibold shadow-lg backdrop-blur transition"
        >
          Back to Store
        </button>
        <button
          onClick={onLogout}
          className="secondary-action inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold shadow-lg backdrop-blur transition"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
      <ManagerDashboard />
    </div>
  );
}
