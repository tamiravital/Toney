'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Loader2 } from 'lucide-react';

export default function DeletePersonaButton({ personaId }: { personaId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Delete this persona? All associated runs will also be deleted.')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/simulator/personas/${personaId}`, { method: 'DELETE' });
      if (res.ok) {
        router.refresh();
      }
    } catch (err) {
      console.error('Failed to delete persona:', err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
      title="Delete persona"
    >
      {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
    </button>
  );
}
