import { Heart } from 'lucide-react';
import LoginForm from '@/components/LoginForm';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-100 mb-4">
            <Heart className="h-6 w-6 text-indigo-600" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Toney Admin</h1>
          <p className="text-sm text-gray-500 mt-1">Coaching dashboard</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
