# CRM and project showcase refresh

## Findings

Both public pages previously used the same generic dark ProductSystemVisual layout. Small labels, a large workspace-map sidebar, and inherited workspace/light-marketing color combinations weakened legibility. The visual disabled context-menu downloads and presented sample metrics as a live workspace.

## Change

One shared, native ProductShowcase illustration now serves CRM and project-management. CRM shows three opportunity stages plus a selected client's next action and linked records. Projects shows a named client project, four milestones, progress and connected documents. Both clearly label demonstration data and fictional clients. Desktop columns reflow into readable mobile rows. Existing Lucide icons, Inter/Plus Jakarta Sans and AlphaClone marketing tokens are reused. Color aliases are restored only inside the new frame to avoid self-referential inherited marketing tokens; no global token change.

Both pages offer same-origin downloadable PNG exports of the same markup: public/showcases/alphaclone-crm-showcase.png and alphaclone-projects-showcase.png, each 3072 x 1448. PNG blob hashes were checked against local files after upload. The website renders native HTML instead of loading the PNG, preserving readable responsive text and avoiding an added image request. These are illustrative product graphics, not live account screenshots.

## Validation

TypeScript typecheck passed, targeted source/export-script ESLint passed (the script required --no-ignore because scripts are excluded by repository configuration), 14 existing marketing tests passed and git diff --check passed. Chromium rendering with the established fonts passed 320, 360, 375, 390, 412, 430, 768, 1024 and 1440px for each showcase: no horizontal overflow or clipped text. Download anchors were reached by keyboard. Desktop and mobile exports were visually inspected. All product feature consumers were rendered; lead-management, ai-agents and video-meetings markup is byte-identical before/after. CSS additions exclusively target ac-showcase classes, so authenticated modules and other marketing components are outside the change.

Export regeneration: set SHOWCASE_FONT_DIR to a node_modules directory containing @fontsource/inter and @fontsource/plus-jakarta-sans, and optionally SHOWCASE_CHROMIUM_PATH to a Chromium binary, then run node --import tsx scripts/export-product-showcases.tsx. These fonts are export-tool inputs, not new app dependencies.

Limits: isolated rendering does not certify every live UI or authenticated workflow. No production build or complete application E2E result is claimed. Existing hero-polish validation limits remain documented separately. PR 171 stays a draft and unmerged pending review.
