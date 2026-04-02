import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
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
  });

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/apps', { ...form, port: Number(form.port) });
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
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">App Name</label>
            <input type="text" value={form.name} onChange={(e) => updateField('name', e.target.value)} placeholder="My API" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" required />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Slug</label>
            <input type="text" value={form.slug} onChange={(e) => updateField('slug', e.target.value)} placeholder="my-api" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" required pattern="^[a-z0-9][a-z0-9-]*[a-z0-9]$" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label className="block text-sm text-gray-300 mb-1">Git Repository URL</label>
            <input type="text" value={form.gitUrl} onChange={(e) => updateField('gitUrl', e.target.value)} placeholder="https://github.com/user/repo.git" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" required />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Branch</label>
            <input type="text" value={form.gitBranch} onChange={(e) => updateField('gitBranch', e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" />
          </div>
        </div>
        <div>
          <label className="block text-sm text-gray-300 mb-1">Port</label>
          <input type="number" value={form.port} onChange={(e) => updateField('port', e.target.value)} min={1024} max={65535} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" required />
          <p className="text-xs text-gray-500 mt-1">The port your app listens on (1024-65535)</p>
        </div>
        <details className="group">
          <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-300">Advanced: Custom Commands</summary>
          <div className="mt-3 space-y-3">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Install Command</label>
              <input type="text" value={form.installCommand} onChange={(e) => updateField('installCommand', e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 font-mono text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Build Command</label>
              <input type="text" value={form.buildCommand} onChange={(e) => updateField('buildCommand', e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 font-mono text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Start Command</label>
              <input type="text" value={form.startCommand} onChange={(e) => updateField('startCommand', e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 font-mono text-sm" />
            </div>
          </div>
        </details>
        <button type="submit" disabled={loading} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-white font-medium transition-colors">
          {loading ? 'Creating...' : 'Create Application'}
        </button>
      </form>
    </div>
  );
}
