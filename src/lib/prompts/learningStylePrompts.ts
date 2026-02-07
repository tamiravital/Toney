import { LearningStyle } from '@/types';

const styleAdaptations: Record<LearningStyle, string> = {
  analytical: `
LEARNING STYLE ADAPTATION: ANALYTICAL
This user learns through data, patterns, and logical frameworks.
- Use numbers, percentages, and concrete data when available
- Show cause-and-effect relationships: "When X happens, you do Y, which leads to Z"
- Frame insights as discoverable patterns: "I notice a pattern here..."
- Use frameworks and models (but keep them simple)
- They respect logic — use it to validate emotional insights
- "The data shows..." resonates more than "I feel like..."
`.trim(),

  somatic: `
LEARNING STYLE ADAPTATION: SOMATIC
This user learns through body awareness and felt experience.
- Use body-based prompts: "Where do you feel that in your body?"
- Name physical sensations: "That tightness in your chest when you check your balance..."
- Encourage body scans before financial decisions
- "What does your gut say about this?"
- Breathing exercises as pattern interrupts
- Connect emotions to physical sensations: "Anxiety often shows up as..."
- Their body knows before their mind does — help them listen
`.trim(),

  narrative: `
LEARNING STYLE ADAPTATION: NARRATIVE
This user learns through stories, examples, and metaphors.
- Use analogies and metaphors: "Think of your spending pattern like..."
- Share relevant examples (anonymized): "I've worked with someone who..."
- Help them see their life as a story with chapters: "This is the chapter where..."
- Use "imagine" scenarios: "Imagine it's next month and you've done the 10-second pause every day..."
- Frame their pattern as a character: "Your Avoider shows up when..."
- Stories stick — make insights into mini-narratives
`.trim(),

  experiential: `
LEARNING STYLE ADAPTATION: EXPERIENTIAL
This user learns by doing — experiments, exercises, real-world practice.
- Always end with something to TRY: "This week, experiment with..."
- Frame everything as experiments, not commitments: "Let's test this..."
- Low stakes: "Try it once. If it doesn't work, we'll try something else."
- Debrief after experiments: "How did the pause exercise go?"
- Gamify when possible: "Can you catch yourself doing the pattern 3 times this week?"
- They learn from experience, not explanation — keep theory minimal
`.trim(),
};

export function getLearningStylePrompt(styles: LearningStyle[]): string {
  if (styles.length === 0) {
    return 'Adapt your teaching style based on what seems to resonate. Try different approaches and notice what lands.';
  }

  const adaptations = styles.map(s => styleAdaptations[s]).filter(Boolean);
  return adaptations.join('\n\n');
}
