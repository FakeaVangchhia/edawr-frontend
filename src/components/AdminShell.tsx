import ManagerDashboard from './ManagerDashboard';

type AdminShellProps = {
  onBackToStore: () => void;
};

export default function AdminShell({ onBackToStore }: AdminShellProps) {
  return (
    <div className="relative min-h-screen bg-slate-900">
      <button
        onClick={onBackToStore}
        className="fixed right-4 top-4 z-20 rounded-full border border-white/20 bg-slate-950/80 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-slate-900"
      >
        Back to Store
      </button>
      <ManagerDashboard />
    </div>
  );
}
