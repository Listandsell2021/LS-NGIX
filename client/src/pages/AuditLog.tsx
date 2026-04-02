import { useState, useEffect } from 'react';
import api from '../api/client';

interface LogEntry {
  id: number;
  action: string;
  ip: string;
  method: string;
  path: string;
  statusCode: number;
  createdAt: string;
}

export default function AuditLog() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/audit?limit=100').then(({ data }) => {
      setLogs(data.logs);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="text-gray-400">Loading audit logs...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Audit Log</h2>
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-800 text-gray-400">
            <tr>
              <th className="px-4 py-3 text-left">Time</th>
              <th className="px-4 py-3 text-left">Action</th>
              <th className="px-4 py-3 text-left">Method</th>
              <th className="px-4 py-3 text-left">Path</th>
              <th className="px-4 py-3 text-left">IP</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t border-gray-800">
                <td className="px-4 py-3 text-gray-400">{new Date(log.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3 font-mono">{log.action}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    log.method === 'DELETE' ? 'bg-red-500/20 text-red-400' :
                    log.method === 'POST' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>{log.method}</span>
                </td>
                <td className="px-4 py-3 font-mono text-gray-400">{log.path}</td>
                <td className="px-4 py-3 text-gray-500">{log.ip}</td>
                <td className="px-4 py-3">
                  <span className={log.statusCode < 400 ? 'text-green-400' : 'text-red-400'}>{log.statusCode}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
