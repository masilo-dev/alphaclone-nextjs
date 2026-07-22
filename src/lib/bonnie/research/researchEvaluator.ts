import {
  BONNIE_RESEARCH_CATALOG,
  type ResearchBriefing,
  type ResearchFinding,
  type ResearchRecommendation,
  type ResearchTarget,
} from './researchCatalog';

function scoreTarget(target: ResearchTarget): ResearchFinding {
  const recommendation: ResearchRecommendation = target.defaultRecommendation;
  const integrationDifficulty =
    recommendation === 'adopt' || recommendation === 'integrate'
      ? target.priority === 1
        ? 'medium'
        : 'low'
      : recommendation === 'replace'
        ? 'high'
        : 'low';

  const businessValue =
    target.priority === 1 ? 'high' : target.priority === 2 ? 'medium' : 'low';

  const advantages = [
    target.purpose,
    target.whyItMatters,
  ];

  const risks = [
    recommendation === 'skip'
      ? 'Low fit for AlphaClone current architecture'
      : 'Avoid cloning — extract patterns only',
    'License and maintenance must be re-checked before production adoption',
  ];

  const nextAction =
    recommendation === 'adopt'
      ? `Deepen ${target.name} usage where AlphaClone already depends on this class of system.`
      : recommendation === 'integrate'
        ? `Prototype a thin adapter that borrows ${target.name} ideas into Bonnie without rewriting the OS.`
        : recommendation === 'watch'
          ? `Track ${target.name} releases weekly; re-score when APIs stabilize.`
          : recommendation === 'replace'
            ? `Prepare a migration plan before replacing the current AlphaClone component with ${target.name}.`
            : `Do not integrate ${target.name} unless a concrete tenant gap appears.`;

  return {
    targetId: target.id,
    name: target.name,
    category: target.category,
    recommendation,
    summary: `${target.name}: ${target.alphacloneFit}`,
    advantages,
    risks,
    integrationDifficulty,
    businessValue,
    nextAction,
  };
}

/** Build an auditable Bonnie research briefing from the curated catalog. */
export function buildBonnieResearchBriefing(): ResearchBriefing {
  const findings = [...BONNIE_RESEARCH_CATALOG]
    .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name))
    .map(scoreTarget);

  const priorities = findings
    .filter((f) => f.recommendation === 'adopt' || f.recommendation === 'integrate')
    .slice(0, 6)
    .map((f) => `${f.name}: ${f.nextAction}`);

  return {
    generatedAt: new Date().toISOString(),
    findings,
    priorities,
    architecturePrinciples: [
      'Research first. Compare second. Design third. Implement last.',
      'Never clone another project — extract ideas and improve them for AlphaClone.',
      'Bonnie is the OS underneath every module, not a bolted-on chatbot.',
      'Every agent action must be auditable: goal, tools, evidence, cost, business impact.',
      'Prefer modular adapters so components can evolve without rewriting the platform.',
      'If something better exists, recommend it before implementation.',
    ],
  };
}

export function formatResearchBriefingForBonnie(briefing: ResearchBriefing): string {
  const lines = [
    'BONNIE RESEARCH BRIEFING',
    `Generated: ${briefing.generatedAt}`,
    '',
    'Architecture principles:',
    ...briefing.architecturePrinciples.map((p) => `- ${p}`),
    '',
    'Priority recommendations:',
    ...briefing.priorities.map((p, i) => `${i + 1}. ${p}`),
    '',
    'Catalog findings:',
    ...briefing.findings.map(
      (f) =>
        `- [${f.recommendation.toUpperCase()}] ${f.name} (${f.category}) — ${f.summary} | value=${f.businessValue} difficulty=${f.integrationDifficulty}`
    ),
  ];
  return lines.join('\n');
}
