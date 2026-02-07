import { redirect } from 'next/navigation';
import { verifyAuth } from '@/lib/auth';

export default async function RootPage() {
  const isAuthed = await verifyAuth();

  if (isAuthed) {
    redirect('/dashboard');
  } else {
    redirect('/login');
  }
}
