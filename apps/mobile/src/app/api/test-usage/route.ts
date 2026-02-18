import { NextRequest, NextResponse } from 'next/server';
import { resolveContext } from '@/lib/supabase/sim';

export async function GET(request: NextRequest) {
  const ctx = await resolveContext(request);
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Try inserting a test row
  const { data, error } = await ctx.supabase
    .from(ctx.table('llm_usage'))
    .insert({
      user_id: ctx.userId,
      session_id: null,
      call_site: 'test_endpoint',
      model: 'test',
      input_tokens: 42,
      output_tokens: 7,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    })
    .select('id')
    .single();

  // Also try reading back
  const { data: rows, error: readErr } = await ctx.supabase
    .from(ctx.table('llm_usage'))
    .select('*')
    .eq('user_id', ctx.userId)
    .limit(5);

  return NextResponse.json({
    userId: ctx.userId,
    table: ctx.table('llm_usage'),
    insertResult: { data, error },
    readResult: { count: rows?.length ?? 0, error: readErr, rows },
  });
}
