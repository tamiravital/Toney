import Link from 'next/link';
import { getAllUsers } from '@/lib/queries/users';
import { tensionLabel, stageLabel, toneLabel, formatDate, formatRelativeTime } from '@/lib/format';
import { tensionColor, stageColor } from '@toney/constants';
import Badge from '@/components/Badge';
import SearchInput from '@/components/SearchInput';
import EmptyState from '@/components/EmptyState';
import { Users } from 'lucide-react';

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const allUsers = await getAllUsers();

  // Client-side search filter
  const users = q
    ? allUsers.filter((u) =>
        (u.display_name ?? '').toLowerCase().includes(q.toLowerCase())
      )
    : allUsers;

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-1">{allUsers.length} total users</p>
        </div>
        <SearchInput placeholder="Search by name..." />
      </div>

      {users.length === 0 ? (
        <EmptyState
          title={q ? 'No users match your search' : 'No users yet'}
          description={q ? `No results for "${q}"` : 'Users will appear here once they sign up'}
          icon={Users}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">User</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Tension</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Tone</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Sessions</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Messages</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Joined</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Last Active</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const tColors = tensionColor(user.tension_type);
                return (
                  <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <Link
                        href={`/dashboard/users/${user.id}`}
                        className="flex items-center gap-3"
                      >
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-500">
                            {(user.display_name ?? '?')[0]?.toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-gray-900 hover:text-indigo-600 transition-colors">
                            {user.display_name || 'Anonymous'}
                          </div>
                          {!user.onboarding_completed && (
                            <span className="text-[10px] text-amber-600">Not onboarded</span>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      {user.tension_type ? (
                        <Badge
                          label={tensionLabel(user.tension_type)}
                          bg={tColors.light}
                          text={tColors.text}
                        />
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {toneLabel(user.tone)}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {user.session_count}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {user.total_messages}
                    </td>
                    <td className="py-3 px-4 text-gray-500">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="py-3 px-4 text-gray-500">
                      {formatRelativeTime(user.last_active)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
