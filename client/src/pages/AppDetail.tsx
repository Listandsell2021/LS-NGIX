import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Rocket, Play, Square, RotateCcw, Activity } from 'lucide-react';
import api from '../api/client';
import StatusBadge from '../components/StatusBadge';
import TerminalOutput from '../components/TerminalOutput';
import EnvEditor from '../components/EnvEditor';

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

interface ProcessInfo {
  name: string;
  status: string;
  cpu: string;
  memory: string;
  uptime: string;
}

export default function AppDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [app, setApp] = useState<App | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [activeLog, setActiveLog] = useState<string>('');
  const [deploying, setDeploying] = useState(false);
  const [loading, setLoading] = useState(true);

  // Process control state
  const [processInfo, setProcessInfo] = useState<ProcessInfo | null>(null);
  const [processAction, setProcessAction] = useState('');
  const [processLogs, setProcessLogs] = useState('');

  // Env vars state
  const [envVars, setEnvVars] = useState<{ key: string; masked: string }[]>([]);

  // Active tab
  const [tab, setTab] = useState<'deployments' | 'logs' | 'env'>('deployments');

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
    } catch {}
  }

  async function fetchProcessInfo() {
    if (!app) return;
    try {
      const { data } = await api.get(`/apps/${app.slug}/process/status`);
      setProcessInfo(data);
    } catch {
      setProcessInfo(null);
    }
  }

  async function fetchEnvVars() {
    try {
      const { data } = await api.get(`/apps/${id}/env`);
      setEnvVars(data);
    } catch {}
  }

  async function deploy() {
    setDeploying(true);
    try {
      await api.post(`/apps/${id}/deployments`);
      const interval = setInterval(async () => {
        await fetchDeployments();
        await fetchApp();
        await fetchProcessInfo();
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

  async function processControl(action: 'stop' | 'restart') {
    if (!app) return;
    setProcessAction(action);
    try {
      await api.post(`/apps/${app.slug}/process/${action}`);
      await fetchApp();
      await fetchProcessInfo();
    } catch {}
    setProcessAction('');
  }

  async function fetchPm2Logs() {
    if (!app) return;
    try {
      const { data } = await api.get(`/apps/${app.slug}/process/logs`);
      setProcessLogs(typeof data === 'string' ? data : JSON.stringify(data));
      setTab('logs');
    } catch {
      setProcessLogs('No logs available. App may not be running.');
      setTab('logs');
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
    fetchEnvVars();
  }, [id]);

  useEffect(() => {
    if (app) {
      fetchProcessInfo();
      // Poll process info every 10 seconds
      const interval = setInterval(fetchProcessInfo, 10000);
      return () => clearInterval(interval);
    }
  }, [app?.slug]);

  if (loading || !app) {
    return <div className="text-gray-400">Loading...</div>;
  }

  const isStopped = app.status === 'stopped' || processInfo?.status === 'stopped';

  return (
    <div>
      <button onClick={() => navigate('/')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 text-sm">
        <ArrowLeft size={16} /> Back to Dashboard
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">{app.name}</h2>
            <StatusBadge status={app.status} />
          </div>
          <p className="text-gray-500 mt-1">{app.slug} &middot; Port {app.port}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={deploy}
            disabled={deploying}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors"
          >
            <Rocket size={16} /> {deploying ? 'Deploying...' : 'Deploy'}
          </button>
          <button
            onClick={deleteApp}
            className="flex items-center gap-2 px-3 py-2 bg-red-600/20 hover:bg-red-600/30 rounded-lg text-sm text-red-400 transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Process Control Panel */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Activity size={16} className="text-gray-400" />
              Process Control
            </h3>
            {processInfo ? (
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span>Status: <span className={processInfo.status === 'online' ? 'text-green-400' : 'text-red-400'}>{processInfo.status}</span></span>
                <span>CPU: <span className="text-white">{processInfo.cpu}</span></span>
                <span>Memory: <span className="text-white">{processInfo.memory}</span></span>
                <span>Uptime: <span className="text-white">{processInfo.uptime}</span></span>
              </div>
            ) : (
              <span className="text-xs text-gray-600">Not running</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => processControl('restart')}
              disabled={!!processAction || isStopped}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-600/20 hover:bg-yellow-600/30 disabled:opacity-30 rounded-lg text-xs text-yellow-400 transition-colors"
              title="Restart"
            >
              <RotateCcw size={13} />
              {processAction === 'restart' ? 'Restarting...' : 'Restart'}
            </button>
            <button
              onClick={() => processControl('stop')}
              disabled={!!processAction || isStopped}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 disabled:opacity-30 rounded-lg text-xs text-red-400 transition-colors"
              title="Stop"
            >
              <Square size={13} />
              {processAction === 'stop' ? 'Stopping...' : 'Stop'}
            </button>
            <button
              onClick={fetchPm2Logs}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs text-gray-300 transition-colors"
              title="View PM2 Logs"
            >
              <Play size={13} />
              Logs
            </button>
          </div>
        </div>
      </div>

      {/* Configuration */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Configuration</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-500">Git URL</span><p className="text-white font-mono mt-1 break-all">{app.gitUrl}</p></div>
          <div><span className="text-gray-500">Branch</span><p className="text-white font-mono mt-1">{app.gitBranch}</p></div>
          <div><span className="text-gray-500">Install</span><p className="text-white font-mono mt-1">{app.installCommand}</p></div>
          <div><span className="text-gray-500">Build</span><p className="text-white font-mono mt-1">{app.buildCommand}</p></div>
          <div><span className="text-gray-500">Start</span><p className="text-white font-mono mt-1">{app.startCommand}</p></div>
          <div><span className="text-gray-500">Port</span><p className="text-white font-mono mt-1">{app.port}</p></div>
        </div>
      </div>

      {/* Tabs: Deployments / PM2 Logs / Env Vars */}
      <div className="flex gap-1 mb-4 border-b border-gray-800">
        <button
          onClick={() => setTab('deployments')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'deployments'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          Deployments
        </button>
        <button
          onClick={() => { setTab('logs'); if (!processLogs) fetchPm2Logs(); }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'logs'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          PM2 Logs
        </button>
        <button
          onClick={() => setTab('env')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'env'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          Environment
        </button>
      </div>

      {/* Tab Content */}
      {tab === 'deployments' && (
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

          {/* Deployment History */}
          {deployments.length > 1 && (
            <div className="mt-4 border-t border-gray-800 pt-4">
              <h4 className="text-sm font-semibold text-gray-400 mb-2">History</h4>
              <div className="space-y-1">
                {deployments.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setActiveLog(d.log)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${
                      activeLog === d.log ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800/50'
                    }`}
                  >
                    <span className="font-mono">{d.commitHash || `#${d.id}`}</span>
                    <span>{d.commitMessage || 'No message'}</span>
                    <StatusBadge status={d.status} />
                    <span>{new Date(d.startedAt).toLocaleString()}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'logs' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">PM2 Application Logs</h3>
            <button
              onClick={fetchPm2Logs}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-gray-300 transition-colors"
            >
              Refresh
            </button>
          </div>
          <TerminalOutput lines={processLogs} />
        </div>
      )}

      {tab === 'env' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Environment Variables</h3>
          <p className="text-sm text-gray-400 mb-4">
            Variables are encrypted at rest. Changes take effect on next deployment or restart.
          </p>
          <EnvEditor appId={id!} envVars={envVars} onUpdate={fetchEnvVars} />
        </div>
      )}
    </div>
  );
}
