import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Check, Key, Loader2 } from 'lucide-react';
import api from '../api/client';

export default function AppCreate() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    slug: '',
    gitUrl: '',
    gitBranch: 'main',
    installCommand: 'npm install',
    buildCommand: 'npm run build',
    startCommand: 'npm run start:prod',
    port: 3001,
    sshKeyId: null as number | null,
  });

  // Deploy key state
  const [publicKey, setPublicKey] = useState('');
  const [generatingKey, setGeneratingKey] = useState(false);
  const [copied, setCopied] = useState(false);

  function updateField(field: string, value: string | number) {
    setForm((f) => ({ ...f, [field]: value }));
    if (field === 'name') {
      const slug = String(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      setForm((f) => ({ ...f, name: String(value), slug }));
    }
  }

  // Extract repo name from URL for the key label
  function repoNameFromUrl(url: string): string {
    const match = url.match(/[/:]([^/]+\/[^/.]+)(\.git)?$/);
    return match ? match[1].replace('/', '-') : 'deploy-key';
  }

  // Auto-generate deploy key when user enters a repo URL
  async function generateDeployKey() {
    if (!form.gitUrl) return;
    setGeneratingKey(true);
    setError('');
    try {
      const keyName = repoNameFromUrl(form.gitUrl);
      const { data } = await api.post('/ssh-keys', { name: keyName });
      setPublicKey(data.publicKey);
      setForm((f) => ({ ...f, sshKeyId: data.id }));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to generate deploy key');
    } finally {
      setGeneratingKey(false);
    }
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(publicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload: Record<string, unknown> = { ...form, port: Number(form.port) };
      if (!payload.sshKeyId) {
        delete payload.sshKeyId;
      }
      const { data } = await api.post('/apps', payload);
      navigate(`/apps/${data.id}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create app');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold mb-6">Deploy New Application</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* App Name + Slug */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">App Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="My API"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Slug</label>
            <input
              type="text"
              value={form.slug}
              onChange={(e) => updateField('slug', e.target.value)}
              placeholder="my-api"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              required
              pattern="^[a-z0-9][a-z0-9-]*[a-z0-9]$"
            />
          </div>
        </div>

        {/* Repository URL */}
        <div>
          <label className="block text-sm text-gray-300 mb-1">Repository URL</label>
          <input
            type="text"
            value={form.gitUrl}
            onChange={(e) => updateField('gitUrl', e.target.value)}
            placeholder="git@github.com:user/repo.git"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
            required
          />
          <p className="text-xs text-gray-500 mt-1">Both HTTPS and SSH protocols are supported</p>
        </div>

        {/* Deploy Key Section */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Key size={16} className="text-blue-400" />
            <h3 className="text-sm font-semibold text-white">Deploy Key</h3>
            <span className="text-xs text-gray-500">(required for private repos)</span>
          </div>

          {!publicKey ? (
            <div>
              <p className="text-sm text-gray-400 mb-3">
                Generate an SSH deploy key to allow the panel to clone your private repository.
              </p>
              <button
                type="button"
                onClick={generateDeployKey}
                disabled={generatingKey || !form.gitUrl}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors"
              >
                {generatingKey ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Key size={14} />
                    Generate Deploy Key
                  </>
                )}
              </button>
              {!form.gitUrl && (
                <p className="text-xs text-gray-600 mt-2">Enter a repository URL first</p>
              )}
            </div>
          ) : (
            <div>
              <p className="text-sm text-green-400 mb-2">
                Deploy key generated. Copy the public key below and add it to your repository:
              </p>
              <div className="flex gap-2 mb-3">
                <code className="flex-1 bg-black p-3 rounded-lg text-xs text-green-300 font-mono break-all select-all">
                  {publicKey}
                </code>
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 self-start"
                >
                  {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                </button>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 text-xs text-gray-400 space-y-1">
                <p className="font-semibold text-gray-300">How to add:</p>
                <p><span className="text-white">GitHub:</span> Repo → Settings → Deploy keys → Add deploy key → paste → Save</p>
                <p><span className="text-white">GitLab:</span> Repo → Settings → Repository → Deploy keys → Add key</p>
                <p><span className="text-white">Bitbucket:</span> Repo → Settings → Access keys → Add key</p>
              </div>
            </div>
          )}
        </div>

        {/* Branch */}
        <div>
          <label className="block text-sm text-gray-300 mb-1">Branch</label>
          <input
            type="text"
            value={form.gitBranch}
            onChange={(e) => updateField('gitBranch', e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Port */}
        <div>
          <label className="block text-sm text-gray-300 mb-1">Port</label>
          <input
            type="number"
            value={form.port}
            onChange={(e) => updateField('port', e.target.value)}
            min={1024}
            max={65535}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
            required
          />
          <p className="text-xs text-gray-500 mt-1">The port your app listens on (1024-65535)</p>
        </div>

        {/* Advanced Commands */}
        <details className="group">
          <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-300">
            Advanced: Custom Commands
          </summary>
          <div className="mt-3 space-y-3">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Install Command</label>
              <input
                type="text"
                value={form.installCommand}
                onChange={(e) => updateField('installCommand', e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Build Command</label>
              <input
                type="text"
                value={form.buildCommand}
                onChange={(e) => updateField('buildCommand', e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Start Command</label>
              <input
                type="text"
                value={form.startCommand}
                onChange={(e) => updateField('startCommand', e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 font-mono text-sm"
              />
            </div>
          </div>
        </details>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-white font-medium transition-colors"
        >
          {loading ? 'Creating...' : 'Create Application'}
        </button>
      </form>
    </div>
  );
}
