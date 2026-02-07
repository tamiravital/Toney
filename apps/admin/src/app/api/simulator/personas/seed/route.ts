import { NextResponse } from 'next/server';
import { createPersona, getPersonas } from '@/lib/queries/simulator';
import { PRESET_PERSONAS } from '@/lib/simulator/presets';

export async function POST() {
  try {
    // Check which presets already exist
    const existing = await getPersonas();
    const existingNames = new Set(existing.map(p => p.name));

    const created = [];
    for (const preset of PRESET_PERSONAS) {
      if (!existingNames.has(preset.name)) {
        const persona = await createPersona({
          name: preset.name,
          profile_config: preset.profile_config,
          user_prompt: preset.user_prompt,
        });
        created.push(persona);
      }
    }

    return NextResponse.json({
      seeded: created.length,
      skipped: PRESET_PERSONAS.length - created.length,
    });
  } catch (error) {
    console.error('Seed presets error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
