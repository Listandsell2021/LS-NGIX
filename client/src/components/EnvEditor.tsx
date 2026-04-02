import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import api from '../api/client';

interface EnvEditorProps {
  appId: string;
  envVars: { key: string; masked: string }[];
  onUpdate: () => void;
}

export default function EnvEditor({ appId, envVars, onUpdate }: EnvEditorProps) {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [loading, setLoading] = useState(false);

  async function addVar() {
    if (!newKey || !newValue) return;
    setLoading(true);
    try {
      await api.post(`/apps/${appId}/env`, { key: newKey, value: newValue });
      setNewKey('');
      setNewValue('');
      onUpdate();
    } finally {
      setLoading(false);
    }
  }

  async function removeVar(key: string) {
    await api.delete(`/apps/${appId}/env/${key}`);
    onUpdate();
  }

  return (
    <div className="space-y-3">
      {envVars.map((v) => (
        <div key={v.key} className="flex items-center gap-3">
          <span className="font-mono text-sm text-gray-300 w-48">{v.key}</span>
          <span className="font-mono text-sm text-gray-500 flex-1">{v.masked}</span>
          <button
            onClick={() => removeVar(v.key)}
            className="text-red-400 hover:text-red-300"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-3 mt-4">
        <input
          type="text"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value.toUpperCase())}
          placeholder="KEY_NAME"
          className="w-48 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-white font-mono text-sm"
        />
        <input
          type="text"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder="value"
          className="flex-1 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-white font-mono text-sm"
        />
        <button
          onClick={addVar}
          disabled={loading || !newKey || !newValue}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm text-white"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}
