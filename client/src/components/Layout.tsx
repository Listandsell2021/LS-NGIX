import { Link, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, Plus, LogOut, Shield, Key } from 'lucide-react';

interface LayoutProps {
  onLogout: () => void;
}

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/apps/new', label: 'New App', icon: Plus },
  { to: '/ssh-keys', label: 'SSH Keys', icon: Key },
  { to: '/audit', label: 'Audit Log', icon: Shield },
];

export default function Layout({ onLogout }: LayoutProps) {
  const location = useLocation();

  return (
    <div className="flex h-screen">
      <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-xl font-bold text-white">LS-NGIX</h1>
          <p className="text-xs text-gray-500 mt-1">VPS Management Panel</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-gray-800">
          <button
            onClick={onLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 w-full"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
