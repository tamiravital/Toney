'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Beaker, Loader2 } from 'lucide-react';

export default function SeedPresetsButton({ hasProfiles }: { hasProfiles: boolean }) {
  const router = useRouter();
  const [seeding, setSeeding] = useState(false);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const res = await fetch('/api/simulator/personas/seed', { method: 'POST' });
      if (res.ok) {
        router.refresh();
      }
    } catch (err) {
      console.error('Failed to seed presets:', err);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <button
      onClick={handleSeed}
      disabled={seeding}
      className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
    >
      {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Beaker className="h-4 w-4" />}
      {hasProfiles ? 'Re-seed Presets' : 'Seed Preset Profiles'}
    </button>
  );
}
