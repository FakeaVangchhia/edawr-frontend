import ManagerDashboard from './components/ManagerDashboard';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      <div className="flex-1 relative overflow-hidden">
        <ManagerDashboard />
      </div>
    </div>
  );
}

