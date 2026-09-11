with open('next.config.ts', 'r') as f:
    lines = f.readlines()

# Find the line with 'export default withBotId('
start_idx = -1
for i, line in enumerate(lines):
    if 'export default withBotId(' in line:
        start_idx = i
        break

if start_idx != -1:
    # Keep everything up to the start of the export
    new_lines = lines[:start_idx]
    # Add the corrected export
    new_lines.append('export default withBotId(\n')
    new_lines.append('  withWorkflow(\n')
    new_lines.append('    withSentryConfig(\n')
    new_lines.append('      withSerwist(nextConfig),\n')
    new_lines.append('      {\n')
    new_lines.append('        org: process.env.SENTRY_ORG,\n')
    new_lines.append('        project: process.env.SENTRY_PROJECT,\n')
    new_lines.append('        silent: !process.env.CI,\n')
    new_lines.append('        widenClientFileUpload: true,\n')
    new_lines.append('        sourcemaps: {\n')
    new_lines.append('          deleteSourcemapsAfterUpload: true,\n')
    new_lines.append('        },\n')
    new_lines.append('        tunnelRoute: "/monitoring",\n')
    new_lines.append('      }\n')
    new_lines.append('    )\n')
    new_lines.append('  )\n')
    new_lines.append(');\n')
    
    with open('next.config.ts', 'w') as f:
        f.writelines(new_lines)
    print("next.config.ts fixed successfully")
else:
    print("Could not find export default withBotId")
