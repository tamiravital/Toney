import Link from 'next/link';
import { ArrowLeft, UserCircle } from 'lucide-react';
import Badge from '@/components/Badge';
import EmptyState from '@/components/EmptyState';
import { getSimProfiles } from '@/lib/queries/simulator';
import { tensionLabel, formatRelativeTime } from '@/lib/format';
import type { TensionType } from '@toney/types';
import SeedPresetsButton from './SeedPresetsButton';
import CreatePersonaSection from './CreatePersonaSection';
import DeletePersonaButton from './DeletePersonaButton';

export const dynamic = 'force-dynamic';

export default async function PersonasPage() {
  const profiles = await getSimProfiles();

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
            <h1 className="text-xl font-semibold text-gray-900">Profiles</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage sim profiles for simulation testing
            </p>
          </div>
          <SeedPresetsButton hasProfiles={profiles.length > 0} />
        </div>
      </div>

      {/* Create New */}
      <CreatePersonaSection />

      {/* Profile List */}
      <div className="mt-8">
        <h2 className="text-sm font-medium text-gray-700 mb-3">
          Saved Profiles ({profiles.length})
        </h2>

        {profiles.length === 0 ? (
          <EmptyState
            title="No profiles yet"
            description="Seed the preset profiles or create a custom one above."
            icon={UserCircle}
          />
        ) : (
          <div className="space-y-3">
            {profiles.map(profile => (
              <div
                key={profile.id}
                className="border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {profile.display_name || profile.id.slice(0, 8)}
                      </span>
                      {profile.source_user_id && (
                        <Badge label="Cloned" bg="bg-purple-100" text="text-purple-700" />
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span>{tensionLabel(profile.tension_type as TensionType | null)} tension</span>
                      <span>Tone {profile.tone ?? 5}</span>
                      <span>{profile.depth ?? 'balanced'} depth</span>
                      {profile.learning_styles?.length > 0 && (
                        <span>{profile.learning_styles.join(', ')}</span>
                      )}
                    </div>
                    {profile.emotional_why && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-1">
                        {profile.emotional_why}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">
                      {formatRelativeTime(profile.created_at)}
                    </span>
                    <DeletePersonaButton personaId={profile.id} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
