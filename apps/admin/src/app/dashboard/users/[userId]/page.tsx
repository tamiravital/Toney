import { redirect } from 'next/navigation';

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  redirect(`/dashboard/users/${userId}/profile`);
}
