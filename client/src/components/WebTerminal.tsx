import { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { io, Socket } from 'socket.io-client';
import 'xterm/css/xterm.css';

interface WebTerminalProps {
  appSlug: string;
}

export default function WebTerminal({ appSlug }: WebTerminalProps) {
  const termRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!termRef.current) return;

    // Initialize xterm.js
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#0a0a0a',
        foreground: '#e5e5e5',
        cursor: '#e5e5e5',
        selectionBackground: '#334155',
        black: '#0a0a0a',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#e5e5e5',
      },
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(termRef.current);

    // Delay fit to ensure container is rendered
    setTimeout(() => {
      try {
        fitAddon.fit();
      } catch {}
    }, 100);

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Connect to WebSocket
    const socket = io('/ws', {
      transports: ['websocket'],
      withCredentials: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setError('');
      terminal.writeln('\x1b[90m--- Connecting to server terminal ---\x1b[0m');

      socket.emit('terminal-start', {
        appSlug,
        cols: terminal.cols,
        rows: terminal.rows,
      });
    });

    socket.on('terminal-ready', () => {
      terminal.writeln('\x1b[32m--- Terminal connected ---\x1b[0m\r\n');
      terminal.focus();
    });

    socket.on('terminal-output', (data: string) => {
      terminal.write(data);
    });

    socket.on('terminal-exit', ({ code }: { code: number }) => {
      terminal.writeln(`\r\n\x1b[90m--- Terminal exited (code ${code}) ---\x1b[0m`);
      setConnected(false);
    });

    socket.on('disconnect', () => {
      terminal.writeln('\r\n\x1b[31m--- Disconnected ---\x1b[0m');
      setConnected(false);
    });

    socket.on('connect_error', () => {
      setError('Failed to connect to server');
      setConnected(false);
    });

    // Send user input to server
    terminal.onData((data) => {
      socket.emit('terminal-input', { data });
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
        socket.emit('terminal-resize', {
          cols: terminal.cols,
          rows: terminal.rows,
        });
      } catch {}
    });
    resizeObserver.observe(termRef.current);

    // Cleanup
    return () => {
      resizeObserver.disconnect();
      socket.emit('terminal-stop');
      socket.disconnect();
      terminal.dispose();
    };
  }, [appSlug]);

  function reconnect() {
    socketRef.current?.emit('terminal-start', {
      appSlug,
      cols: terminalRef.current?.cols || 80,
      rows: terminalRef.current?.rows || 24,
    });
    setConnected(true);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
          <span className="text-xs text-gray-400">
            {connected ? 'Connected' : 'Disconnected'} &middot; Working directory: /managed-apps/{appSlug}/source
          </span>
        </div>
        {!connected && (
          <button
            onClick={reconnect}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs text-white transition-colors"
          >
            Reconnect
          </button>
        )}
      </div>
      {error && (
        <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-xs">
          {error}
        </div>
      )}
      <div
        ref={termRef}
        className="rounded-lg overflow-hidden border border-gray-800"
        style={{ height: '400px' }}
      />
      <p className="text-xs text-gray-600 mt-2">
        Full shell access to your app's directory. Run npm, git, node, or any command.
      </p>
    </div>
  );
}
