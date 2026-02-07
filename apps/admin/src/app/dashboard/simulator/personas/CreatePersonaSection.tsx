'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, ChevronDown } from 'lucide-react';
import PersonaForm from '@/components/simulator/PersonaForm';

export default function CreatePersonaSection() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleSubmit = async (data: {
    name: string;
    profile_config: Record<string, unknown>;
    user_prompt: string;
  }) => {
    const res = await fetch('/api/simulator/personas/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      setOpen(false);
      router.refresh();
    }
  };

  return (
    <div className="border border-gray-200 rounded-xl">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center gap-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        Create New Persona
      </button>
      {open && (
        <div className="px-6 pb-6 border-t border-gray-100">
          <div className="mt-4">
            <PersonaForm onSubmit={handleSubmit} submitLabel="Create Persona" />
          </div>
        </div>
      )}
    </div>
  );
}
