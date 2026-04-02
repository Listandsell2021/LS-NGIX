const statusStyles: Record<string, string> = {
  running: 'bg-green-500/20 text-green-400',
  stopped: 'bg-gray-500/20 text-gray-400',
  building: 'bg-yellow-500/20 text-yellow-400',
  errored: 'bg-red-500/20 text-red-400',
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        statusStyles[status] || statusStyles.stopped
      }`}
    >
      {status}
    </span>
  );
}
