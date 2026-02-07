import Link from 'next/link';
import { ArrowLeft, Beaker, UserCircle, Trash2 } from 'lucide-react';
import Badge from '@/components/Badge';
import EmptyState from '@/components/EmptyState';
import { getPersonas } from '@/lib/queries/simulator';
import { tensionLabel, formatRelativeTime } from '@/lib/format';
import type { Profile } from '@toney/types';
import SeedPresetsButton from './SeedPresetsButton';
import CreatePersonaSection from './CreatePersonaSection';
import DeletePersonaButton from './DeletePersonaButton';

export const dynamic = 'force-dynamic';

export default async function PersonasPage() {
  const personas = await getPersonas();

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <Link
          href="/dashboard/simulator"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Simulator
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Personas</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage coaching personas for simulation testing
            </p>
          </div>
          <SeedPresetsButton hasPersonas={personas.length > 0} />
        </div>
      </div>

      {/* Create New */}
      <CreatePersonaSection />

      {/* Persona List */}
      <div className="mt-8">
        <h2 className="text-sm font-medium text-gray-700 mb-3">
          Saved Personas ({personas.length})
        </h2>

        {personas.length === 0 ? (
          <EmptyState
            title="No personas yet"
            description="Seed the preset personas or create a custom one above."
            icon={UserCircle}
          />
        ) : (
          <div className="space-y-3">
            {personas.map(persona => {
              const config = persona.profile_config as Partial<Profile>;
              return (
                <div
                  key={persona.id}
                  className="border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{persona.name}</span>
                        {persona.source_user_id && (
                          <Badge label="Cloned" bg="bg-purple-100" text="text-purple-700" />
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span>{tensionLabel(config.tension_type)} tension</span>
                        <span>Tone {config.tone ?? 5}</span>
                        <span>{config.depth ?? 'balanced'} depth</span>
                        {config.learning_styles && (
                          <span>{config.learning_styles.join(', ')}</span>
                        )}
                      </div>
                      {config.emotional_why && (
                        <p className="text-xs text-gray-400 mt-1 line-clamp-1">
                          {config.emotional_why}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">
                        {formatRelativeTime(persona.created_at)}
                      </span>
                      <DeletePersonaButton personaId={persona.id} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
