import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

export interface SimContext {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  userId: string;
  isSimMode: boolean;
  /** Maps production table name to sim table name (or identity in prod mode) */
  table: (name: string) => string;
}

/**
 * Resolves auth + table names for both production and sim modes.
 *
 * Production: cookie-based Supabase auth, production table names.
 * Sim mode: SIM_SECRET verification, service role client, sim_ table names.
 *
 * Returns null if auth fails (caller should return 401).
 */
export async function resolveContext(request: NextRequest): Promise<SimContext | null> {
  const simProfileId = request.nextUrl.searchParams.get('sim');

  if (simProfileId) {
    // ── Sim mode ──
    const simSecret = request.nextUrl.searchParams.get('simSecret')
      || request.headers.get('x-sim-secret');

    if (!simSecret || simSecret !== process.env.SIM_SECRET) {
      return null;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[sim] Missing SUPABASE_SERVICE_ROLE_KEY for sim mode');
      return null;
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    return {
      supabase,
      userId: simProfileId,
      isSimMode: true,
      table: (name: string) => `sim_${name}`,
    };
  }

  // ── Production mode ──
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  return {
    supabase,
    userId: user.id,
    isSimMode: false,
    table: (name: string) => name,
  };
}
