import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import api from '../api/client';
import AppCard from '../components/AppCard';

interface App {
  id: string;
  name: string;
  slug: string;
  gitBranch: string;
  port: number;
  status: string;
}

export default function Dashboard() {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchApps() {
    setLoading(true);
    try {
      const { data } = await api.get('/apps');
      setApps(data);
    } catch (err) {
      console.error('Failed to fetch apps', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchApps();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold">Applications</h2>
          <p className="text-gray-400 mt-1">{apps.length} app{apps.length !== 1 ? 's' : ''} deployed</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchApps}
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors"
          >
            <RefreshCw size={16} />
          </button>
          <Link
            to="/apps/new"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium text-white transition-colors"
          >
            <Plus size={16} />
            New App
          </Link>
        </div>
      </div>
      {loading ? (
        <div className="text-gray-400">Loading applications...</div>
      ) : apps.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 mb-4">No applications yet.</p>
          <Link
            to="/apps/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium text-white transition-colors"
          >
            <Plus size={16} />
            Deploy Your First App
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {apps.map((app) => (
            <AppCard key={app.id} {...app} />
          ))}
        </div>
      )}
    </div>
  );
}
