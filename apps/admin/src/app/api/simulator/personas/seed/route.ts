import { NextResponse } from 'next/server';
import { createSimProfile, getSimProfiles } from '@/lib/queries/simulator';
import { PRESET_PERSONAS } from '@/lib/simulator/presets';

export async function POST() {
  try {
    // Check which presets already exist (by display_name)
    const existing = await getSimProfiles();
    const existingNames = new Set(existing.map(p => p.display_name));

    const created = [];
    for (const preset of PRESET_PERSONAS) {
      if (!existingNames.has(preset.name)) {
        // Create sim_profile directly — no persona layer
        const simProfile = await createSimProfile({
          display_name: preset.name,
          user_prompt: preset.user_prompt,
          ...preset.profile_config,
        });
        created.push(simProfile);
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
