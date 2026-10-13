export function parseWorkflowConfig(text: string): Record<string, unknown> {
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('Enter valid JSON, or choose a template to start with working settings.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Action settings must be a JSON object.');
  return value as Record<string, unknown>;
}
export function workflowConfigError(text: string): string | null {
  try { parseWorkflowConfig(text); return null; } catch (error) { return (error as Error).message; }
}
