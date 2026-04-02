import { useEffect, useRef } from 'react';

interface TerminalOutputProps {
  lines: string;
}

export default function TerminalOutput({ lines }: TerminalOutputProps) {
  const ref = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [lines]);

  return (
    <pre
      ref={ref}
      className="bg-black rounded-lg p-4 text-sm font-mono text-green-400 overflow-auto max-h-96 whitespace-pre-wrap"
    >
      {lines || 'No output yet...'}
    </pre>
  );
}
