/**
 * Unified intelligence facade — single entry for module insight cards and copilots.
 */
export { integratedIntelligenceService } from '@/services/intelligence/integratedIntelligenceService';
export type { ModuleAssessment, IntegratedIntelligenceSnapshot } from '@/services/intelligence/integratedIntelligenceService';

export { executeBonnieCopilotTool, runModuleIntelligenceAction } from '@/services/bonnieCopilotService';
