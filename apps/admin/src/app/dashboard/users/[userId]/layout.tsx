import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { getUserProfile } from '@/lib/queries/users';
import { tensionLabel, formatDate } from '@/lib/format';
import { tensionColor } from '@toney/constants';
import Badge from '@/components/Badge';
import TabNav from '@/components/TabNav';
import { notFound } from 'next/navigation';

export default async function UserDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const profile = await getUserProfile(userId);

  if (!profile) {
    notFound();
  }

  const tColors = tensionColor(profile.tension_type);

  return (
    <div className="max-w-5xl">
      {/* Back link */}
      <Link
        href="/dashboard/users"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        All Users
      </Link>

      {/* User header */}
      <div className="flex items-center gap-4 mb-6">
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt=""
            className="w-14 h-14 rounded-full object-cover"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center text-lg font-medium text-gray-500">
            {(profile.display_name ?? '?')[0]?.toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {profile.display_name || 'Anonymous'}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            {profile.tension_type && (
              <Badge
                label={tensionLabel(profile.tension_type)}
                bg={tColors.light}
                text={tColors.text}
              />
            )}
            <span className="text-sm text-gray-400">
              Joined {formatDate(profile.created_at)}
            </span>
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <TabNav userId={userId} />

      {/* Tab content */}
      {children}
    </div>
  );
}
