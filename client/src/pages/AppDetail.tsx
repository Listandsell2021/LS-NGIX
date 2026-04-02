import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Rocket } from 'lucide-react';
import api from '../api/client';
import StatusBadge from '../components/StatusBadge';
import TerminalOutput from '../components/TerminalOutput';

interface App {
  id: string;
  name: string;
  slug: string;
  gitUrl: string;
  gitBranch: string;
  installCommand: string;
  buildCommand: string;
  startCommand: string;
  port: number;
  status: string;
}

interface Deployment {
  id: number;
  status: string;
  commitHash: string;
  commitMessage: string;
  log: string;
  startedAt: string;
  finishedAt: string;
}

export default function AppDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [app, setApp] = useState<App | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [activeLog, setActiveLog] = useState<string>('');
  const [deploying, setDeploying] = useState(false);
  const [loading, setLoading] = useState(true);

  async function fetchApp() {
    try {
      const { data } = await api.get(`/apps/${id}`);
      setApp(data);
    } catch {
      navigate('/');
    } finally {
      setLoading(false);
    }
  }

  async function fetchDeployments() {
    try {
      const { data } = await api.get(`/apps/${id}/deployments`);
      setDeployments(data);
      if (data.length > 0) {
        setActiveLog(data[0].log);
      }
    } catch {
      // Deployments endpoint may not exist yet
    }
  }

  async function deploy() {
    setDeploying(true);
    try {
      await api.post(`/apps/${id}/deployments`);
      // Poll for updates
      const interval = setInterval(async () => {
        await fetchDeployments();
        await fetchApp();
        const latest = (await api.get(`/apps/${id}/deployments`)).data[0];
        if (latest && ['success', 'failed'].includes(latest.status)) {
          clearInterval(interval);
          setDeploying(false);
        }
      }, 2000);
    } catch {
      setDeploying(false);
    }
  }

  async function deleteApp() {
    if (!confirm(`Delete "${app?.name}"? This cannot be undone.`)) return;
    await api.delete(`/apps/${id}`);
    navigate('/');
  }

  useEffect(() => {
    fetchApp();
    fetchDeployments();
  }, [id]);

  if (loading || !app) {
    return <div className="text-gray-400">Loading...</div>;
  }

  return (
    <div>
      <button onClick={() => navigate('/')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 text-sm">
        <ArrowLeft size={16} /> Back to Dashboard
      </button>
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">{app.name}</h2>
            <StatusBadge status={app.status} />
          </div>
          <p className="text-gray-500 mt-1">{app.slug} &middot; Port {app.port}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={deploy} disabled={deploying} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors">
            <Rocket size={16} /> {deploying ? 'Deploying...' : 'Deploy'}
          </button>
          <button onClick={deleteApp} className="flex items-center gap-2 px-3 py-2 bg-red-600/20 hover:bg-red-600/30 rounded-lg text-sm text-red-400 transition-colors">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Config */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Configuration</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-500">Git URL</span><p className="text-white font-mono mt-1">{app.gitUrl}</p></div>
          <div><span className="text-gray-500">Branch</span><p className="text-white font-mono mt-1">{app.gitBranch}</p></div>
          <div><span className="text-gray-500">Install</span><p className="text-white font-mono mt-1">{app.installCommand}</p></div>
          <div><span className="text-gray-500">Build</span><p className="text-white font-mono mt-1">{app.buildCommand}</p></div>
          <div><span className="text-gray-500">Start</span><p className="text-white font-mono mt-1">{app.startCommand}</p></div>
          <div><span className="text-gray-500">Port</span><p className="text-white font-mono mt-1">{app.port}</p></div>
        </div>
      </div>

      {/* Deployment Log */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">
          Deployment Log
          {deployments.length > 0 && (
            <span className="text-sm text-gray-500 ml-2">
              Latest: {deployments[0].commitHash || 'pending'} — {deployments[0].status}
            </span>
          )}
        </h3>
        <TerminalOutput lines={activeLog} />
      </div>
    </div>
  );
}
