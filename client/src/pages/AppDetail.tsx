import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Rocket, Play, Square, RotateCcw, Activity, Globe, Lock, Plus, X } from 'lucide-react';
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

interface DomainEntry {
  id: number;
  domain: string;
  sslEnabled: boolean;
  createdAt: string;
}

export default function AppDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [app, setApp] = useState<App | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [activeLog, setActiveLog] = useState<string>('');
  const [deploying, setDeploying] = useState(false);
  const [loading, setLoading] = useState(true);

  // Process control
  const [processInfo, setProcessInfo] = useState<ProcessInfo | null>(null);
  const [processAction, setProcessAction] = useState('');
  const [processLogs, setProcessLogs] = useState('');

  // Env vars
  const [envVars, setEnvVars] = useState<{ key: string; masked: string }[]>([]);

  // Domains
  const [domains, setDomains] = useState<DomainEntry[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [addingDomain, setAddingDomain] = useState(false);
  const [domainError, setDomainError] = useState('');
  const [sslEmail, setSslEmail] = useState('');
  const [enablingSsl, setEnablingSsl] = useState<number | null>(null);

  // Active tab
  const [tab, setTab] = useState<'deployments' | 'logs' | 'env' | 'domains'>('deployments');

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
      if (data.length > 0) setActiveLog(data[0].log);
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

  async function fetchDomains() {
    try {
      const { data } = await api.get(`/apps/${id}/domains`);
      setDomains(data);
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

  async function addDomain() {
    if (!newDomain) return;
    setAddingDomain(true);
    setDomainError('');
    try {
      await api.post(`/apps/${id}/domains`, { domain: newDomain });
      setNewDomain('');
      await fetchDomains();
    } catch (err: any) {
      setDomainError(err.response?.data?.message || 'Failed to add domain');
    } finally {
      setAddingDomain(false);
    }
  }

  async function removeDomain(domainId: number) {
    if (!confirm('Remove this domain? Nginx config will be deleted.')) return;
    try {
      await api.delete(`/apps/${id}/domains/${domainId}`);
      await fetchDomains();
    } catch {}
  }

  async function enableSsl(domainId: number) {
    if (!sslEmail) {
      setDomainError('Enter your email for Let\'s Encrypt SSL certificate');
      return;
    }
    setEnablingSsl(domainId);
    setDomainError('');
    try {
      await api.post(`/apps/${id}/domains/${domainId}/ssl`, { email: sslEmail });
      await fetchDomains();
    } catch (err: any) {
      setDomainError(err.response?.data?.message || 'Failed to enable SSL. Make sure DNS points to this server.');
    } finally {
      setEnablingSsl(null);
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
    fetchDomains();
  }, [id]);

  useEffect(() => {
    if (app) {
      fetchProcessInfo();
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
            >
              <RotateCcw size={13} />
              {processAction === 'restart' ? 'Restarting...' : 'Restart'}
            </button>
            <button
              onClick={() => processControl('stop')}
              disabled={!!processAction || isStopped}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 disabled:opacity-30 rounded-lg text-xs text-red-400 transition-colors"
            >
              <Square size={13} />
              {processAction === 'stop' ? 'Stopping...' : 'Stop'}
            </button>
            <button
              onClick={fetchPm2Logs}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs text-gray-300 transition-colors"
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

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-800">
        {(['deployments', 'domains', 'logs', 'env'] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              if (t === 'logs' && !processLogs) fetchPm2Logs();
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-blue-500 text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {t === 'deployments' ? 'Deployments' : t === 'domains' ? 'Domains' : t === 'logs' ? 'PM2 Logs' : 'Environment'}
          </button>
        ))}
      </div>

      {/* Deployments Tab */}
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

      {/* Domains Tab */}
      {tab === 'domains' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-2">Custom Domains</h3>
          <p className="text-sm text-gray-400 mb-6">
            Point your domain's DNS A record to your server IP, then add it here. Nginx reverse proxy config is generated automatically.
          </p>

          {domainError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {domainError}
            </div>
          )}

          {/* Add Domain */}
          <div className="flex gap-3 mb-6">
            <input
              type="text"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="api.example.com"
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDomain())}
            />
            <button
              onClick={addDomain}
              disabled={addingDomain || !newDomain}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors"
            >
              <Plus size={14} />
              {addingDomain ? 'Adding...' : 'Add Domain'}
            </button>
          </div>

          {/* SSL Email (needed for Let's Encrypt) */}
          <div className="mb-6">
            <label className="block text-xs text-gray-500 mb-1">Email for SSL certificates (Let's Encrypt)</label>
            <input
              type="email"
              value={sslEmail}
              onChange={(e) => setSslEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full max-w-sm px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Domain List */}
          {domains.length === 0 ? (
            <div className="text-center py-8">
              <Globe size={32} className="mx-auto text-gray-600 mb-3" />
              <p className="text-gray-500">No custom domains yet.</p>
              <p className="text-xs text-gray-600 mt-1">Your app is accessible via server IP:{app.port}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {domains.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between p-4 bg-gray-800 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {d.sslEnabled ? (
                      <Lock size={16} className="text-green-400" />
                    ) : (
                      <Globe size={16} className="text-gray-400" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-white">
                        {d.sslEnabled ? 'https' : 'http'}://{d.domain}
                      </p>
                      <p className="text-xs text-gray-500">
                        {d.sslEnabled ? 'SSL enabled' : 'HTTP only'} &middot; Added {new Date(d.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!d.sslEnabled && (
                      <button
                        onClick={() => enableSsl(d.id)}
                        disabled={enablingSsl === d.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 disabled:opacity-50 rounded-lg text-xs text-green-400 transition-colors"
                      >
                        <Lock size={12} />
                        {enablingSsl === d.id ? 'Enabling...' : 'Enable SSL'}
                      </button>
                    )}
                    <button
                      onClick={() => removeDomain(d.id)}
                      className="px-2 py-1.5 text-red-400 hover:text-red-300 hover:bg-red-600/10 rounded-lg transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Instructions */}
          <div className="mt-6 bg-gray-800/50 rounded-lg p-4 text-xs text-gray-400 space-y-2">
            <p className="font-semibold text-gray-300">How it works:</p>
            <p>1. Point your domain's <span className="text-white">DNS A record</span> to your server's IP address</p>
            <p>2. Add the domain above — Nginx reverse proxy config is <span className="text-white">auto-generated</span></p>
            <p>3. Click <span className="text-green-400">Enable SSL</span> to get a free Let's Encrypt HTTPS certificate</p>
            <p>4. Your app is now live at <span className="text-white">https://yourdomain.com</span></p>
          </div>
        </div>
      )}

      {/* PM2 Logs Tab */}
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

      {/* Environment Tab */}
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
