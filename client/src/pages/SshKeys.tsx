import { useState, useEffect } from 'react';
import { Key, Plus, Trash2, Copy, Check } from 'lucide-react';
import api from '../api/client';

interface SshKeyEntry {
  id: number;
  name: string;
  publicKey: string;
  createdAt: string;
}

export default function SshKeys() {
  const [keys, setKeys] = useState<SshKeyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<{ publicKey: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function fetchKeys() {
    const { data } = await api.get('/ssh-keys');
    setKeys(data);
    setLoading(false);
  }

  useEffect(() => { fetchKeys(); }, []);

  async function generateKey() {
    if (!name) return;
    setCreating(true);
    try {
      const { data } = await api.post('/ssh-keys', { name });
      setNewKey(data);
      setName('');
      fetchKeys();
    } finally {
      setCreating(false);
    }
  }

  async function deleteKey(id: number) {
    if (!confirm('Delete this SSH key?')) return;
    await api.delete(`/ssh-keys/${id}`);
    fetchKeys();
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-3xl">
      <h2 className="text-2xl font-bold mb-2">SSH Deploy Keys</h2>
      <p className="text-gray-400 mb-6">Generate SSH keys to clone private Git repositories. Add the public key to your repo's deploy keys.</p>

      {/* Generate new key */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Generate New Key</h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Key name (e.g. github-myproject)"
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={generateKey}
            disabled={creating || !name}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors"
          >
            <Plus size={16} />
            {creating ? 'Generating...' : 'Generate'}
          </button>
        </div>

        {newKey && (
          <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p className="text-green-400 text-sm font-semibold mb-2">Key generated! Copy this public key and add it to your Git repo's deploy keys:</p>
            <div className="flex gap-2">
              <code className="flex-1 bg-black p-3 rounded text-xs text-green-300 font-mono break-all">{newKey.publicKey}</code>
              <button
                onClick={() => copyToClipboard(newKey.publicKey)}
                className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-300"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">GitHub: Repo Settings → Deploy keys → Add deploy key</p>
          </div>
        )}
      </div>

      {/* Existing keys */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">Existing Keys</h3>
        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : keys.length === 0 ? (
          <p className="text-gray-500">No SSH keys yet. Generate one above.</p>
        ) : (
          <div className="space-y-3">
            {keys.map((k) => (
              <div key={k.id} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <Key size={16} className="text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-white">{k.name}</p>
                    <p className="text-xs text-gray-500 font-mono">{k.publicKey.substring(0, 60)}...</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyToClipboard(k.publicKey)}
                    className="px-2 py-1 text-gray-400 hover:text-white"
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    onClick={() => deleteKey(k.id)}
                    className="px-2 py-1 text-red-400 hover:text-red-300"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
