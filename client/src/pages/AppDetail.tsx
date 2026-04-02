import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Rocket, Play, Square, RotateCcw, Activity, Globe, Lock, Plus, X, TerminalSquare, Pencil, Save, ChevronDown, Loader2, GitBranch, Send } from 'lucide-react';
import api from '../api/client';
import StatusBadge from '../components/StatusBadge';
import TerminalOutput from '../components/TerminalOutput';
import EnvEditor from '../components/EnvEditor';
import FileManager from '../components/FileManager';

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

  // Configuration editing
  const [editingConfig, setEditingConfig] = useState(false);
  const [configForm, setConfigForm] = useState({ gitBranch: '', installCommand: '', buildCommand: '', startCommand: '', port: 0 });
  const [savingConfig, setSavingConfig] = useState(false);
  const [branches, setBranches] = useState<string[]>([]);
  const [fetchingBranches, setFetchingBranches] = useState(false);

  // Command runner
  const [cmdInput, setCmdInput] = useState('');
  const [cmdOutput, setCmdOutput] = useState('');
  const [cmdRunning, setCmdRunning] = useState(false);

  // Active tab
  const [tab, setTab] = useState<'deployments' | 'domains' | 'files' | 'terminal' | 'logs' | 'env'>('deployments');

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

  function startEditConfig() {
    if (!app) return;
    setConfigForm({
      gitBranch: app.gitBranch,
      installCommand: app.installCommand,
      buildCommand: app.buildCommand,
      startCommand: app.startCommand,
      port: app.port,
    });
    setEditingConfig(true);
    fetchBranches();
  }

  async function saveConfig() {
    if (!app) return;
    setSavingConfig(true);
    try {
      const { data } = await api.patch(`/apps/${id}`, configForm);
      setApp(data);
      setEditingConfig(false);
    } catch {}
    setSavingConfig(false);
  }

  async function runCommand(cmd?: string) {
    const command = cmd || cmdInput;
    if (!command || !app) return;
    setCmdRunning(true);
    setCmdOutput((prev) => prev + `\n$ ${command}\n`);
    try {
      const { data } = await api.post(`/apps/${app.slug}/process/run-command`, { command });
      setCmdOutput((prev) => prev + (data.output || '(no output)') + '\n');
    } catch (err: any) {
      setCmdOutput((prev) => prev + (err.response?.data?.message || 'Error running command') + '\n');
    }
    setCmdRunning(false);
    if (!cmd) setCmdInput('');
  }

  async function fetchBranches() {
    setFetchingBranches(true);
    try {
      const { data } = await api.get(`/apps/${id}/branches`);
      setBranches(data.branches);
    } catch {
      setBranches([]);
    }
    setFetchingBranches(false);
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
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Configuration</h3>
          {!editingConfig ? (
            <button
              onClick={startEditConfig}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-gray-300 transition-colors"
            >
              <Pencil size={13} /> Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setEditingConfig(false)}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-gray-400 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveConfig}
                disabled={savingConfig}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-xs text-white transition-colors"
              >
                <Save size={13} /> {savingConfig ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
        </div>

        {!editingConfig ? (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-500">Git URL</span><p className="text-white font-mono mt-1 break-all">{app.gitUrl}</p></div>
            <div><span className="text-gray-500">Branch</span><p className="text-white font-mono mt-1">{app.gitBranch}</p></div>
            <div><span className="text-gray-500">Install</span><p className="text-white font-mono mt-1">{app.installCommand}</p></div>
            <div><span className="text-gray-500">Build</span><p className="text-white font-mono mt-1">{app.buildCommand}</p></div>
            <div><span className="text-gray-500">Start</span><p className="text-white font-mono mt-1">{app.startCommand}</p></div>
            <div><span className="text-gray-500">Port</span><p className="text-white font-mono mt-1">{app.port}</p></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Git URL</span>
              <p className="text-white font-mono mt-1 break-all opacity-60">{app.gitUrl}</p>
              <p className="text-xs text-gray-600 mt-1">Cannot be changed after creation</p>
            </div>
            <div>
              <label className="text-gray-500 block mb-1">Branch</label>
              <div className="flex gap-2">
                {branches.length > 0 ? (
                  <div className="relative flex-1">
                    <select
                      value={configForm.gitBranch}
                      onChange={(e) => setConfigForm({ ...configForm, gitBranch: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-blue-500 appearance-none pr-8"
                    >
                      {branches.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                      {!branches.includes(configForm.gitBranch) && (
                        <option value={configForm.gitBranch}>{configForm.gitBranch}</option>
                      )}
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                  </div>
                ) : (
                  <input
                    type="text"
                    value={configForm.gitBranch}
                    onChange={(e) => setConfigForm({ ...configForm, gitBranch: e.target.value })}
                    className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-blue-500"
                  />
                )}
                <button
                  onClick={fetchBranches}
                  disabled={fetchingBranches}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-lg text-xs text-gray-400 transition-colors whitespace-nowrap"
                  title="Fetch branches from remote"
                >
                  {fetchingBranches ? <Loader2 size={13} className="animate-spin" /> : <GitBranch size={13} />}
                  Fetch
                </button>
              </div>
            </div>
            <div>
              <label className="text-gray-500 block mb-1">Install</label>
              <input
                type="text"
                value={configForm.installCommand}
                onChange={(e) => setConfigForm({ ...configForm, installCommand: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-gray-500 block mb-1">Build</label>
              <input
                type="text"
                value={configForm.buildCommand}
                onChange={(e) => setConfigForm({ ...configForm, buildCommand: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-gray-500 block mb-1">Start</label>
              <input
                type="text"
                value={configForm.startCommand}
                onChange={(e) => setConfigForm({ ...configForm, startCommand: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-gray-500 block mb-1">Port</label>
              <input
                type="number"
                value={configForm.port}
                onChange={(e) => setConfigForm({ ...configForm, port: Number(e.target.value) })}
                min={1024}
                max={65535}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-800">
        {(['deployments', 'domains', 'files', 'terminal', 'logs', 'env'] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              if (t === 'logs' && !processLogs) fetchPm2Logs();
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              tab === t
                ? 'border-blue-500 text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {t === 'terminal' && <TerminalSquare size={14} />}
            {t === 'deployments' ? 'Deployments' : t === 'domains' ? 'Domains' : t === 'files' ? 'Files' : t === 'terminal' ? 'Run Commands' : t === 'logs' ? 'PM2 Logs' : 'Environment'}
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

      {/* Files Tab */}
      {tab === 'files' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">File Manager</h3>
          <FileManager appId={id!} />
        </div>
      )}

      {/* Run Commands Tab */}
      {tab === 'terminal' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-2">Run Node.js Commands</h3>
          <p className="text-sm text-gray-400 mb-4">
            Run commands in your app's directory. Allowed: npm, npx, node, yarn, pnpm, git, ls.
          </p>

          {/* Quick action buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button onClick={() => runCommand('npm install')} disabled={cmdRunning} className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 disabled:opacity-50 rounded-lg text-xs text-blue-400 transition-colors">npm install</button>
            <button onClick={() => runCommand('npm run build')} disabled={cmdRunning} className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 disabled:opacity-50 rounded-lg text-xs text-blue-400 transition-colors">npm run build</button>
            <button onClick={() => runCommand('npm start')} disabled={cmdRunning} className="px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 disabled:opacity-50 rounded-lg text-xs text-green-400 transition-colors">npm start</button>
            <button onClick={() => { processControl('restart'); setCmdOutput((p) => p + '\n$ pm2 restart\nRestarting...\n'); }} disabled={!!processAction} className="px-3 py-1.5 bg-yellow-600/20 hover:bg-yellow-600/30 disabled:opacity-50 rounded-lg text-xs text-yellow-400 transition-colors flex items-center gap-1"><RotateCcw size={12} /> Restart App</button>
            <button onClick={() => runCommand('git status')} disabled={cmdRunning} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg text-xs text-gray-300 transition-colors">git status</button>
            <button onClick={() => runCommand('ls -la')} disabled={cmdRunning} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg text-xs text-gray-300 transition-colors">ls -la</button>
          </div>

          {/* Command input */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={cmdInput}
              onChange={(e) => setCmdInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !cmdRunning && runCommand()}
              placeholder="npm install express"
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-blue-500"
              disabled={cmdRunning}
            />
            <button
              onClick={() => runCommand()}
              disabled={cmdRunning || !cmdInput}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors"
            >
              {cmdRunning ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {cmdRunning ? 'Running...' : 'Run'}
            </button>
          </div>

          {/* Output */}
          <div className="relative">
            {cmdOutput && (
              <button
                onClick={() => setCmdOutput('')}
                className="absolute top-2 right-2 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-400 transition-colors z-10"
              >
                Clear
              </button>
            )}
            <pre className="bg-black/50 border border-gray-800 rounded-lg p-4 text-sm font-mono text-gray-300 min-h-[200px] max-h-[400px] overflow-auto whitespace-pre-wrap">
              {cmdOutput || 'Output will appear here...'}
            </pre>
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
