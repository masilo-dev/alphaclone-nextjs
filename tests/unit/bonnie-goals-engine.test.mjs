import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("goals panel and hook exist", () => {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
  assert.equal(
    fs.existsSync(path.join(root, "src/components/dashboard/bonnie/workspace/BonnieGoalsPanel.tsx")),
    true,
  );
  assert.equal(fs.existsSync(path.join(root, "src/hooks/useBonnieGoals.ts")), true);
  assert.equal(fs.existsSync(path.join(root, "src/app/api/bonnie/goals/route.ts")), true);
  assert.equal(fs.existsSync(path.join(root, "src/app/api/cron/bonnie-goals-chase/route.ts")), true);
  assert.equal(fs.existsSync(path.join(root, "src/lib/bonnie/os/goalEngine.ts")), true);
  assert.equal(
    fs.existsSync(path.join(root, "supabase/migrations/20260724160000_bonnie_agentic_goals.sql")),
    true,
  );
});

test("railway crons register goal chase", () => {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
  const crons = JSON.parse(fs.readFileSync(path.join(root, "railway.crons.json"), "utf8"));
  const paths = crons.crons.map((c) => c.path);
  assert.ok(paths.includes("/api/cron/bonnie-goals-chase"));
  assert.ok(paths.includes("/api/cron/bonnie-continuous"));
});
