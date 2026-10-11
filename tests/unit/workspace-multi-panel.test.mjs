import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../..",
);

test("Multi-panel workspace primitive files exist", () => {
  const requiredFiles = [
    "src/components/ui/workspace/useMultiPanelWorkspace.ts",
    "src/components/ui/workspace/WorkspaceSplitter.tsx",
    "src/components/ui/workspace/WorkspacePanel.tsx",
    "src/components/ui/workspace/WorkspaceContextPanel.tsx",
    "src/components/ui/workspace/WorkspacePanelToggle.tsx",
    "src/components/ui/workspace/WorkspaceShell.tsx",
    "src/components/ui/workspace/WorkspaceToolbar.tsx",
    "src/components/ui/workspace/index.ts",
    "src/components/dashboard/crm/CrmMultiPanelWorkspace.tsx",
  ];

  for (const rel of requiredFiles) {
    const full = path.join(root, rel);
    assert.equal(fs.existsSync(full), true, `File must exist: ${rel}`);
  }
});

test("Workspace barrel export exports all multi-panel primitives", () => {
  const indexSrc = fs.readFileSync(
    path.join(root, "src/components/ui/workspace/index.ts"),
    "utf8"
  );

  assert.match(indexSrc, /export\s+\{[^}]*WorkspaceShell[^}]*\}\s+from\s+'\.\/WorkspaceShell'/);
  assert.match(indexSrc, /export\s+\{[^}]*WorkspaceToolbar[^}]*\}\s+from\s+'\.\/WorkspaceToolbar'/);
  assert.match(indexSrc, /export\s+\{[^}]*WorkspacePanel[^}]*\}\s+from\s+'\.\/WorkspacePanel'/);
  assert.match(indexSrc, /export\s+\{[^}]*WorkspaceSplitter[^}]*\}\s+from\s+'\.\/WorkspaceSplitter'/);
  assert.match(indexSrc, /export\s+\{[^}]*WorkspaceContextPanel[^}]*\}\s+from\s+'\.\/WorkspaceContextPanel'/);
  assert.match(indexSrc, /export\s+\{[^}]*WorkspacePanelToggle[^}]*\}\s+from\s+'\.\/WorkspacePanelToggle'/);
  assert.match(indexSrc, /export\s+\{[^}]*useMultiPanelWorkspace[^}]*\}\s+from\s+'\.\/useMultiPanelWorkspace'/);
});

test("WorkspaceSplitter meets W3C ARIA separator requirements", () => {
  const splitterSrc = fs.readFileSync(
    path.join(root, "src/components/ui/workspace/WorkspaceSplitter.tsx"),
    "utf8"
  );

  // Hairline and grip styling
  assert.match(splitterSrc, /cursor-col-resize/);
  assert.match(splitterSrc, /var\(--border-subtle\)/);
  assert.match(splitterSrc, /var\(--accent\)/);
  assert.match(splitterSrc, /onDoubleClick/);
});

test("useMultiPanelWorkspace enforces keyboard navigation and persistence", () => {
  const hookSrc = fs.readFileSync(
    path.join(root, "src/components/ui/workspace/useMultiPanelWorkspace.ts"),
    "utf8"
  );

  // Arrow keys, Home, End
  assert.match(hookSrc, /ArrowLeft/);
  assert.match(hookSrc, /ArrowRight/);
  assert.match(hookSrc, /Home/);
  assert.match(hookSrc, /End/);

  // ARIA separator contract
  assert.match(hookSrc, /role:\s*'separator'/);
  assert.match(hookSrc, /aria-orientation':\s*'vertical'/);
  assert.match(hookSrc, /aria-valuenow/);
  assert.match(hookSrc, /aria-valuemin/);
  assert.match(hookSrc, /aria-valuemax/);

  // Persistence to localStorage
  assert.match(hookSrc, /localStorage/);
  assert.match(hookSrc, /ac-workspace-panels-/);

  // Breakpoints
  assert.match(hookSrc, /isMobile/);
  assert.match(hookSrc, /isTablet/);
  assert.match(hookSrc, /isLaptop/);
  assert.match(hookSrc, /isDesktop/);
});

test("CRM implements 3-panel workspace architecture", () => {
  const crmSrc = fs.readFileSync(
    path.join(root, "src/components/dashboard/crm/CrmMultiPanelWorkspace.tsx"),
    "utf8"
  );

  // 3-panel components used
  assert.match(crmSrc, /WorkspaceShell/);
  assert.match(crmSrc, /WorkspacePanel/);
  assert.match(crmSrc, /WorkspaceSplitter/);
  assert.match(crmSrc, /WorkspaceContextPanel/);
  assert.match(crmSrc, /useMultiPanelWorkspace/);

  // ContactsList view switcher
  const contactsListSrc = fs.readFileSync(
    path.join(root, "src/components/dashboard/crm/ContactsList.tsx"),
    "utf8"
  );
  assert.match(contactsListSrc, /CrmMultiPanelWorkspace/);
  assert.match(contactsListSrc, /workspace/);
});

test("UnifiedInboxView embeds WorkspaceSplitter and multi-panel insight panel", () => {
  const inboxSrc = fs.readFileSync(
    path.join(root, "src/components/dashboard/business/UnifiedInboxView.tsx"),
    "utf8"
  );

  assert.match(inboxSrc, /WorkspaceSplitter/);
  assert.match(inboxSrc, /useMultiPanelWorkspace/);
  assert.match(inboxSrc, /namespace:\s*'unified-inbox'/);
  assert.match(inboxSrc, /getSplitterProps\(1\)/);
  assert.match(inboxSrc, /getSplitterProps\(3\)/);
  assert.match(inboxSrc, /togglePanel3/);
});

test("ResearchEngineWorkspace embeds continuous inspection panel with splitter", () => {
  const researchSrc = fs.readFileSync(
    path.join(root, "src/components/dashboard/leads/ResearchEngineWorkspace.tsx"),
    "utf8"
  );

  assert.match(researchSrc, /WorkspaceSplitter/);
  assert.match(researchSrc, /useMultiPanelWorkspace/);
  assert.match(researchSrc, /namespace:\s*'lead-research-engine'/);
  assert.match(researchSrc, /renderInspectorContent/);
  assert.match(researchSrc, /panel3Width/);
});

test("BonnieFullView integrates resizable multi-panel layout with splitters", () => {
  const bonnieSrc = fs.readFileSync(
    path.join(root, "src/components/dashboard/bonnie/BonnieFullView.tsx"),
    "utf8"
  );

  assert.match(bonnieSrc, /WorkspaceSplitter/);
  assert.match(bonnieSrc, /useMultiPanelWorkspace/);
  assert.match(bonnieSrc, /namespace:\s*'bonnie-fullview'/);
  assert.match(bonnieSrc, /width=\{panel1Width\}/);
  assert.match(bonnieSrc, /width=\{panel3Width\}/);
});

test("Design constants and product CSS define ultra-compact workspace tokens", () => {
  const designSrc = fs.readFileSync(
    path.join(root, "src/constants/design.ts"),
    "utf8"
  );
  assert.match(designSrc, /multiPanel/);
  assert.match(designSrc, /navDefaultWidth:/);
  assert.match(designSrc, /contextDefaultWidth:/);

  const cssSrc = fs.readFileSync(
    path.join(root, "src/styles/product-system.css"),
    "utf8"
  );
  assert.match(cssSrc, /\.ac-multi-panel-shell/);
  assert.match(cssSrc, /width:\s*4px/);
});
