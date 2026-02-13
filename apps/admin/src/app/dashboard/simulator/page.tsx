import { FlaskConical } from 'lucide-react';
import { getSimProfiles } from '@/lib/queries/simulator';
import { getAllUsers } from '@/lib/queries/users';
import { tensionLabel, formatDate } from '@/lib/format';
import { tensionColor } from '@toney/constants';
import type { TensionType } from '@toney/types';
import Badge from '@/components/Badge';
import EmptyState from '@/components/EmptyState';
import { OpenButton, DeleteButton, NewUserButton, CloneUserSection } from './SimulatorActions';

export const dynamic = 'force-dynamic';

export default async function SimulatorPage() {
  const [profiles, users] = await Promise.all([
    getSimProfiles(),
    getAllUsers(),
  ]);

  const userMap = new Map(users.map(u => [u.id, u.display_name || 'Anonymous']));

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Simulator</h1>
          <p className="text-sm text-gray-500 mt-1">
            {profiles.length} sim profile{profiles.length !== 1 ? 's' : ''}
          </p>
        </div>
        <NewUserButton />
      </div>

      {/* Clone User */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-8">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Clone Production User</h2>
        <p className="text-xs text-gray-500 mb-4">
          Deep-copy a real user's profile, briefing, cards, and wins into a sim profile.
        </p>
        <CloneUserSection
          users={users.map(u => ({
            id: u.id,
            display_name: u.display_name ?? null,
            tension_type: u.tension_type ?? null,
          }))}
        />
      </div>

      {/* Profiles Grid */}
      {profiles.length === 0 ? (
        <EmptyState
          title="No sim profiles yet"
          description="Create a new sim user or clone a production user to get started."
          icon={FlaskConical}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {profiles.map((profile) => {
            const tColors = profile.tension_type ? tensionColor(profile.tension_type as TensionType) : null;
            const sourceName = profile.source_user_id ? userMap.get(profile.source_user_id) : null;

            return (
              <div
                key={profile.id}
                className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col gap-3"
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">
                      {profile.display_name || 'Unnamed'}
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatDate(profile.created_at)}
                    </p>
                  </div>
                  {tColors && (
                    <Badge
                      label={tensionLabel(profile.tension_type as TensionType)}
                      bg={tColors.light}
                      text={tColors.text}
                    />
                  )}
                </div>

                {/* Source info */}
                {sourceName && (
                  <p className="text-xs text-gray-500">
                    Cloned from <span className="font-medium text-gray-700">{sourceName}</span>
                  </p>
                )}

                {/* Understanding snippet */}
                {profile.understanding && (
                  <p className="text-xs text-gray-500 line-clamp-2">
                    {profile.understanding.slice(0, 120)}...
                  </p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 mt-auto pt-2">
                  <OpenButton profileId={profile.id} />
                  <DeleteButton profileId={profile.id} profileName={profile.display_name || 'Unnamed'} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
