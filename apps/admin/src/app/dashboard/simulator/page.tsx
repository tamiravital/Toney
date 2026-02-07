import { FlaskConical } from 'lucide-react';
import { getRuns, getPersonas } from '@/lib/queries/simulator';
import { getAllUsers } from '@/lib/queries/users';
import EmptyState from '@/components/EmptyState';
import RunCard from '@/components/simulator/RunCard';
import LaunchPanel from './LaunchPanel';

export const dynamic = 'force-dynamic';

export default async function SimulatorPage() {
  const [runs, personas, users] = await Promise.all([
    getRuns(30),
    getPersonas(),
    getAllUsers(),
  ]);

  return (
    <div className="max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Conversation Simulator</h1>
        <p className="text-sm text-gray-500 mt-1">
          Test the coaching engine with different personas and topics
        </p>
      </div>

      {/* Launch Panel */}
      <LaunchPanel
        personas={personas}
        users={users.map(u => ({ id: u.id, display_name: u.display_name, tension_type: u.tension_type }))}
      />

      {/* Recent Runs */}
      <div className="mt-10">
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          Recent Runs
          {runs.length > 0 && (
            <span className="text-sm font-normal text-gray-400 ml-2">({runs.length})</span>
          )}
        </h2>

        {runs.length === 0 ? (
          <EmptyState
            title="No simulation runs yet"
            description="Configure a persona and topic above, then run your first simulation."
            icon={FlaskConical}
          />
        ) : (
          <div className="grid gap-3">
            {runs.map(run => (
              <RunCard key={run.id} run={run} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
