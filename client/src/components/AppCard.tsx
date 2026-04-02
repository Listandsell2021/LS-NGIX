import { Link } from 'react-router-dom';
import { GitBranch, ExternalLink } from 'lucide-react';
import StatusBadge from './StatusBadge';

interface AppCardProps {
  id: string;
  name: string;
  slug: string;
  gitBranch: string;
  port: number;
  status: string;
}

export default function AppCard({ id, name, slug, gitBranch, port, status }: AppCardProps) {
  return (
    <Link
      to={`/apps/${id}`}
      className="block bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold text-white">{name}</h3>
          <p className="text-sm text-gray-500">{slug}</p>
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="space-y-1 text-sm text-gray-400">
        <div className="flex items-center gap-2">
          <GitBranch size={14} />
          <span>{gitBranch}</span>
        </div>
        <div className="flex items-center gap-2">
          <ExternalLink size={14} />
          <span>Port {port}</span>
        </div>
      </div>
    </Link>
  );
}
