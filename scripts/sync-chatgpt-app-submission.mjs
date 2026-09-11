/**
 * Ensure chatgpt-app-submission.json contains every tool exposed in the
 * unified MCP catalog, with OpenAI-required annotations + justifications.
 * Existing entries are preserved; missing tools are added via heuristics.
 */
import fs from "node:fs";
import path from "node:path";
import { getUnifiedMcpTools } from "../src/lib/mcp/listAllTools.ts";
import { inferToolAnnotations } from "../src/lib/mcp/toolAnnotations.ts";

const ROOT = process.cwd();
const TARGET = path.join(ROOT, "chatgpt-app-submission.json");

const READ_ONLY = {
  annotations: {
    readOnlyHint: true,
    openWorldHint: false,
    destructiveHint: false,
  },
  justifications: {
    read_only_justification:
      "Only reads or computes data and does not modify workspace or external state.",
    open_world_justification:
      "Does not write to public internet state or third-party systems.",
    destructive_justification:
      "Does not delete, cancel, overwrite, or revoke anything.",
  },
};

const MUTATING = {
  annotations: {
    readOnlyHint: false,
    openWorldHint: false,
    destructiveHint: false,
  },
  justifications: {
    read_only_justification:
      "Mutates private workspace data, so it is not read-only.",
    open_world_justification:
      "Operates only on private workspace data and does not publish externally.",
    destructive_justification:
      "Does not delete, cancel, overwrite, or revoke anything irreversibly.",
  },
};

const DESTRUCTIVE = {
  annotations: {
    readOnlyHint: false,
    openWorldHint: false,
    destructiveHint: true,
  },
  justifications: {
    read_only_justification:
      "Mutates private workspace data, so it is not read-only.",
    open_world_justification:
      "Operates only on private workspace data and does not publish externally.",
    destructive_justification: "Can delete or archive records; use with care.",
  },
};

const OPEN_WORLD = {
  annotations: {
    readOnlyHint: false,
    openWorldHint: true,
    destructiveHint: false,
  },
  justifications: {
    read_only_justification:
      "Mutates private workspace data, so it is not read-only.",
    open_world_justification:
      "May publish content to connected social platforms or external providers.",
    destructive_justification:
      "Does not delete, cancel, overwrite, or revoke anything irreversibly.",
  },
};

const OPEN_WORLD_DESTRUCTIVE = {
  annotations: {
    readOnlyHint: false,
    openWorldHint: true,
    destructiveHint: true,
  },
  justifications: {
    read_only_justification:
      "Mutates workspace or external state, so it is not read-only.",
    open_world_justification:
      "May affect connected external providers or public-facing state.",
    destructive_justification: "Can delete or revoke external or workspace data.",
  },
};

const UNIVERSAL_ROUTER = {
  annotations: {
    readOnlyHint: false,
    openWorldHint: true,
    destructiveHint: true,
  },
  justifications: {
    read_only_justification:
      "Routes to both read and write tools, so it cannot be classified as read-only.",
    open_world_justification:
      "May route to tools that send email, publish content, or call connected providers.",
    destructive_justification:
      "May route to destructive tools, which remain subject to RBAC and approval policy.",
  },
};

const ROUTER_TOOLS = new Set(["dispatch_tool", "execute_action"]);

function entryFromAnnotations(name, annotations) {
  if (ROUTER_TOOLS.has(name)) return UNIVERSAL_ROUTER;

  const { readOnlyHint, openWorldHint, destructiveHint } = annotations;

  if (openWorldHint && destructiveHint) return OPEN_WORLD_DESTRUCTIVE;
  if (destructiveHint) return DESTRUCTIVE;
  if (openWorldHint) return OPEN_WORLD;
  if (readOnlyHint) return READ_ONLY;
  return MUTATING;
}

const doc = JSON.parse(fs.readFileSync(TARGET, "utf8"));
doc.tools = doc.tools || {};

const tools = await getUnifiedMcpTools({ catalogMode: "full", sanitizeForClient: true });
const catalogNames = tools.map((tool) => tool.name).sort();

let added = 0;
for (const name of catalogNames) {
  if (doc.tools[name]) continue;
  const annotations = inferToolAnnotations(name);
  doc.tools[name] = entryFromAnnotations(name, annotations);
  added += 1;
}

const submissionNames = Object.keys(doc.tools).sort();
const missingFromSubmission = catalogNames.filter((name) => !doc.tools[name]);
const extraInSubmission = submissionNames.filter(
  (name) => !catalogNames.includes(name),
);

fs.writeFileSync(TARGET, `${JSON.stringify(doc, null, 2)}\n`);

console.log(
  JSON.stringify(
    {
      catalog_tools: catalogNames.length,
      submission_tools: submissionNames.length,
      added,
      missing_from_submission: missingFromSubmission.length,
      extra_in_submission: extraInSubmission.length,
      extra_sample: extraInSubmission.slice(0, 10),
    },
    null,
    2,
  ),
);

if (missingFromSubmission.length > 0) {
  process.exitCode = 1;
}
