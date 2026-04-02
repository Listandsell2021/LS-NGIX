import { useState, useEffect, useCallback } from 'react';
import {
  Folder,
  File,
  ChevronRight,
  ArrowLeft,
  Save,
  X,
  Plus,
  Trash2,
  FolderPlus,
  RefreshCw,
} from 'lucide-react';
import api from '../api/client';

interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  modifiedAt: string;
}

interface FileManagerProps {
  appId: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    json: 'json', md: 'markdown', yml: 'yaml', yaml: 'yaml',
    html: 'html', css: 'css', scss: 'scss', sh: 'bash',
    env: 'shell', gitignore: 'text', dockerfile: 'docker',
    sql: 'sql', py: 'python', rb: 'ruby', go: 'go', rs: 'rust',
  };
  return map[ext] || 'text';
}

export default function FileManager({ appId }: FileManagerProps) {
  const [currentPath, setCurrentPath] = useState('');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Editor state
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [isBinary, setIsBinary] = useState(false);

  // New file/folder
  const [showNewInput, setShowNewInput] = useState<'file' | 'folder' | null>(null);
  const [newName, setNewName] = useState('');

  const fetchFiles = useCallback(async (path: string) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/apps/${appId}/files/list`, {
        params: { path },
      });
      setEntries(data.entries);
      setCurrentPath(path);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load files');
    } finally {
      setLoading(false);
    }
  }, [appId]);

  useEffect(() => {
    fetchFiles('');
  }, [fetchFiles]);

  async function openFile(entry: FileEntry) {
    if (entry.type === 'directory') {
      setEditingFile(null);
      fetchFiles(entry.path);
      return;
    }

    setError('');
    try {
      const { data } = await api.get(`/apps/${appId}/files/read`, {
        params: { path: entry.path },
      });

      if (data.binary) {
        setIsBinary(true);
        setFileContent('');
        setEditingFile(entry.path);
        return;
      }

      setIsBinary(false);
      setFileContent(data.content);
      setOriginalContent(data.content);
      setEditingFile(entry.path);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to read file');
    }
  }

  async function saveFile() {
    if (!editingFile) return;
    setSaving(true);
    setError('');
    try {
      await api.post(`/apps/${appId}/files/write`, {
        path: editingFile,
        content: fileContent,
      });
      setOriginalContent(fileContent);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save file');
    } finally {
      setSaving(false);
    }
  }

  function goUp() {
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const parentPath = parts.join('/');
    setEditingFile(null);
    fetchFiles(parentPath);
  }

  async function createNew() {
    if (!newName) return;
    const newPath = currentPath ? `${currentPath}/${newName}` : newName;
    setError('');

    try {
      if (showNewInput === 'folder') {
        await api.post(`/apps/${appId}/files/create-folder`, { path: newPath });
      } else {
        await api.post(`/apps/${appId}/files/write`, { path: newPath, content: '' });
      }
      setNewName('');
      setShowNewInput(null);
      fetchFiles(currentPath);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create');
    }
  }

  async function deleteEntry(entry: FileEntry) {
    if (!confirm(`Delete "${entry.name}"? ${entry.type === 'directory' ? 'This will delete all contents.' : ''}`)) return;
    setError('');
    try {
      await api.delete(`/apps/${appId}/files/delete`, {
        params: { path: entry.path },
      });
      if (editingFile === entry.path) setEditingFile(null);
      fetchFiles(currentPath);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete');
    }
  }

  const hasChanges = editingFile && fileContent !== originalContent;
  const breadcrumbs = currentPath ? currentPath.split('/') : [];

  return (
    <div>
      {error && (
        <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-4" style={{ height: '500px' }}>
        {/* File Tree */}
        <div className="w-80 bg-gray-800/50 border border-gray-700 rounded-lg flex flex-col overflow-hidden shrink-0">
          {/* Breadcrumb / Path Bar */}
          <div className="p-3 border-b border-gray-700 bg-gray-800">
            <div className="flex items-center gap-1 text-xs text-gray-400 overflow-x-auto">
              <button
                onClick={() => { setEditingFile(null); fetchFiles(''); }}
                className="hover:text-white shrink-0"
              >
                root
              </button>
              {breadcrumbs.map((part, i) => (
                <span key={i} className="flex items-center gap-1 shrink-0">
                  <ChevronRight size={10} />
                  <button
                    onClick={() => {
                      setEditingFile(null);
                      fetchFiles(breadcrumbs.slice(0, i + 1).join('/'));
                    }}
                    className="hover:text-white"
                  >
                    {part}
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-1 p-2 border-b border-gray-700">
            {currentPath && (
              <button onClick={goUp} className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white" title="Go up">
                <ArrowLeft size={14} />
              </button>
            )}
            <button onClick={() => fetchFiles(currentPath)} className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white" title="Refresh">
              <RefreshCw size={14} />
            </button>
            <div className="flex-1" />
            <button onClick={() => setShowNewInput('file')} className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white" title="New file">
              <Plus size={14} />
            </button>
            <button onClick={() => setShowNewInput('folder')} className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white" title="New folder">
              <FolderPlus size={14} />
            </button>
          </div>

          {/* New file/folder input */}
          {showNewInput && (
            <div className="flex items-center gap-1 p-2 border-b border-gray-700 bg-gray-800/50">
              {showNewInput === 'folder' ? <Folder size={14} className="text-blue-400 shrink-0" /> : <File size={14} className="text-gray-400 shrink-0" />}
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') createNew();
                  if (e.key === 'Escape') { setShowNewInput(null); setNewName(''); }
                }}
                placeholder={showNewInput === 'folder' ? 'folder-name' : 'filename.ts'}
                className="flex-1 bg-transparent text-white text-xs outline-none"
                autoFocus
              />
              <button onClick={() => { setShowNewInput(null); setNewName(''); }} className="text-gray-500 hover:text-gray-300">
                <X size={12} />
              </button>
            </div>
          )}

          {/* File List */}
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="p-4 text-gray-500 text-sm">Loading...</div>
            ) : entries.length === 0 ? (
              <div className="p-4 text-gray-600 text-sm">Empty directory</div>
            ) : (
              entries.map((entry) => (
                <div
                  key={entry.path}
                  className={`group flex items-center gap-2 px-3 py-1.5 cursor-pointer text-sm transition-colors ${
                    editingFile === entry.path ? 'bg-blue-600/20 text-white' : 'text-gray-300 hover:bg-gray-700/50'
                  }`}
                >
                  <div
                    className="flex items-center gap-2 flex-1 min-w-0"
                    onClick={() => openFile(entry)}
                  >
                    {entry.type === 'directory' ? (
                      <Folder size={14} className="text-blue-400 shrink-0" />
                    ) : (
                      <File size={14} className="text-gray-500 shrink-0" />
                    )}
                    <span className="truncate">{entry.name}</span>
                    {entry.type === 'file' && (
                      <span className="text-xs text-gray-600 shrink-0">{formatSize(entry.size)}</span>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteEntry(entry); }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-300 transition-opacity"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 bg-gray-800/50 border border-gray-700 rounded-lg flex flex-col overflow-hidden">
          {editingFile ? (
            <>
              {/* Editor Header */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-800">
                <div className="flex items-center gap-2 text-sm">
                  <File size={14} className="text-gray-400" />
                  <span className="text-white font-mono text-xs">{editingFile}</span>
                  {hasChanges && <span className="w-2 h-2 bg-yellow-400 rounded-full" title="Unsaved changes" />}
                  <span className="text-xs text-gray-600">{getLanguage(editingFile)}</span>
                </div>
                <div className="flex items-center gap-2">
                  {!isBinary && (
                    <button
                      onClick={saveFile}
                      disabled={saving || !hasChanges}
                      className="flex items-center gap-1.5 px-3 py-1 bg-green-600 hover:bg-green-700 disabled:opacity-30 rounded text-xs text-white transition-colors"
                    >
                      <Save size={12} />
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  )}
                  <button
                    onClick={() => setEditingFile(null)}
                    className="p-1 text-gray-400 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Editor Content */}
              {isBinary ? (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <File size={32} className="mx-auto mb-2" />
                    <p className="text-sm">Binary file — cannot be edited here</p>
                    <p className="text-xs text-gray-600 mt-1">Use the Terminal tab to view or modify</p>
                  </div>
                </div>
              ) : (
                <textarea
                  value={fileContent}
                  onChange={(e) => setFileContent(e.target.value)}
                  className="flex-1 bg-[#0a0a0a] text-gray-100 font-mono text-sm p-4 resize-none outline-none leading-relaxed"
                  spellCheck={false}
                  onKeyDown={(e) => {
                    // Ctrl/Cmd+S to save
                    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                      e.preventDefault();
                      saveFile();
                    }
                    // Tab inserts 2 spaces
                    if (e.key === 'Tab') {
                      e.preventDefault();
                      const start = e.currentTarget.selectionStart;
                      const end = e.currentTarget.selectionEnd;
                      const value = e.currentTarget.value;
                      setFileContent(value.substring(0, start) + '  ' + value.substring(end));
                      setTimeout(() => {
                        e.currentTarget.selectionStart = e.currentTarget.selectionEnd = start + 2;
                      }, 0);
                    }
                  }}
                />
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-600">
              <div className="text-center">
                <File size={32} className="mx-auto mb-2" />
                <p className="text-sm">Select a file to view and edit</p>
                <p className="text-xs mt-1">Ctrl+S / Cmd+S to save</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
