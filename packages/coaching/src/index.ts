export { buildSystemPromptFromBriefing, buildSessionOpeningBlock } from './prompts/systemPromptBuilder';
export { prepareSession } from './strategist';
export type { PrepareSessionInput, SessionPreparation } from './strategist';
export { reflectOnSession } from './strategist';
export type { ReflectionInput, SessionReflection } from './strategist';
export { buildKnowledgeUpdates, mergeGrowthEdges } from './strategist';
export type { KnowledgeUpdate } from './strategist';
export { detectSessionBoundary } from './session';
export type { SessionBoundary } from './session';
export { generateSessionNotes } from './session-notes';
export type { SessionNotesInput } from './session-notes';
// Pipelines — full session lifecycle orchestration (no DB, no framework)
export { openSessionPipeline, planSessionStep } from './pipelines';
export type { OpenSessionInput, OpenSessionOutput, PlanSessionOutput } from './pipelines';
export { closeSessionPipeline } from './pipelines';
export type { CloseSessionInput, CloseSessionOutput } from './pipelines';
