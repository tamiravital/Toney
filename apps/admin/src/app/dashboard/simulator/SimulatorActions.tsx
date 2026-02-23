'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink, Trash2, Plus, Copy, Pencil, Check, X } from 'lucide-react';

const SIM_SECRET = process.env.NEXT_PUBLIC_SIM_SECRET || '';

function getMobileUrl(): string {
  if (process.env.NEXT_PUBLIC_MOBILE_URL) {
    return process.env.NEXT_PUBLIC_MOBILE_URL;
  }
  return 'http://localhost:3000';
}

function openSimPopup(path: string) {
  window.open(
    `${getMobileUrl()}${path}`,
    '_blank',
    'width=430,height=932,menubar=no,toolbar=no,location=no,status=no'
  );
}

// ============================================================
// Open Button — opens mobile in a phone-sized popup
// ============================================================

export function OpenButton({ profileId }: { profileId: string }) {
  return (
    <button
      onClick={() => openSimPopup(`?sim=${profileId}&simSecret=${SIM_SECRET}`)}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
    >
      <ExternalLink className="h-3.5 w-3.5" />
      Open
    </button>
  );
}

// ============================================================
// Delete Button — deletes a sim profile via API
// ============================================================

export function DeleteButton({ profileId, profileName }: { profileId: string; profileName: string }) {
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (!confirm(`Delete sim profile "${profileName}"? This will remove all associated data.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/simulator/personas/${profileId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      router.refresh();
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Failed to delete profile');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
    >
      <Trash2 className="h-3.5 w-3.5" />
      {deleting ? 'Deleting...' : 'Delete'}
    </button>
  );
}

// ============================================================
// New User Button — opens mobile onboarding in sim mode
// ============================================================

export function NewUserButton() {
  return (
    <button
      onClick={() => openSimPopup(`?sim=new&simSecret=${SIM_SECRET}`)}
      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
    >
      <Plus className="h-4 w-4" />
      New Sim User
    </button>
  );
}

// ============================================================
// Editable Name — click to rename
// ============================================================

export function EditableName({ profileId, initialName }: { profileId: string; initialName: string }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  async function handleSave() {
    if (!name.trim() || name.trim() === initialName) {
      setName(initialName);
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/simulator/personas/${profileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: name.trim() }),
      });
      if (!res.ok) throw new Error('Failed to rename');
      setEditing(false);
      router.refresh();
    } catch {
      setName(initialName);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') { setName(initialName); setEditing(false); }
          }}
          disabled={saving}
          className="text-sm font-semibold text-gray-900 bg-gray-50 border border-gray-300 rounded px-1.5 py-0.5 w-full focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button onClick={handleSave} disabled={saving} className="text-green-600 hover:text-green-700 p-0.5">
          <Check className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => { setName(initialName); setEditing(false); }} className="text-gray-400 hover:text-gray-600 p-0.5">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="group flex items-center gap-1 min-w-0"
    >
      <h3 className="text-sm font-semibold text-gray-900 truncate">
        {initialName || 'Unnamed'}
      </h3>
      <Pencil className="h-3 w-3 text-gray-300 group-hover:text-gray-500 flex-shrink-0" />
    </button>
  );
}

// ============================================================
// Clone User Section — dropdown + clone button
// ============================================================

export function CloneUserSection({ users }: { users: { id: string; display_name: string | null; tension_type: string | null }[] }) {
  const [selectedUserId, setSelectedUserId] = useState('');
  const [cloning, setCloning] = useState(false);
  const router = useRouter();

  async function handleClone() {
    if (!selectedUserId) return;
    const user = users.find(u => u.id === selectedUserId);
    if (!user) return;

    setCloning(true);
    try {
      const res = await fetch('/api/simulator/personas/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          name: user.display_name || 'User',
        }),
      });
      if (!res.ok) throw new Error('Failed to clone');
      router.refresh();
    } catch (err) {
      console.error('Clone failed:', err);
      alert('Failed to clone user');
    } finally {
      setCloning(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <select
        value={selectedUserId}
        onChange={(e) => setSelectedUserId(e.target.value)}
        className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-w-[200px]"
      >
        <option value="">Select a user to clone...</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.display_name || 'Anonymous'} {u.tension_type ? `(${u.tension_type})` : ''}
          </option>
        ))}
      </select>
      <button
        onClick={handleClone}
        disabled={!selectedUserId || cloning}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Copy className="h-4 w-4" />
        {cloning ? 'Cloning...' : 'Clone'}
      </button>
    </div>
  );
}
