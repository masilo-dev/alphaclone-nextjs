export type TaskDependencyEdge = {
  taskId: string;
  dependsOnTaskId: string;
};

export type TaskDependencyValidation =
  | { valid: true }
  | { valid: false; reason: 'SELF_DEPENDENCY' | 'CYCLE'; path: string[] };

function normalizeEdge(edge: TaskDependencyEdge): TaskDependencyEdge {
  return {
    taskId: String(edge.taskId || '').trim(),
    dependsOnTaskId: String(edge.dependsOnTaskId || '').trim(),
  };
}

/**
 * Validates one proposed dependency against the current graph.
 *
 * Semantics: taskId -> dependsOnTaskId means taskId cannot start until
 * dependsOnTaskId is complete. Adding A -> B is invalid when B already
 * reaches A through its own dependency chain.
 */
export function validateTaskDependency(
  existingEdges: TaskDependencyEdge[],
  proposedEdge: TaskDependencyEdge,
): TaskDependencyValidation {
  const proposed = normalizeEdge(proposedEdge);

  if (proposed.taskId === proposed.dependsOnTaskId) {
    return {
      valid: false,
      reason: 'SELF_DEPENDENCY',
      path: [proposed.taskId, proposed.dependsOnTaskId],
    };
  }

  const adjacency = new Map<string, Set<string>>();
  for (const rawEdge of existingEdges) {
    const edge = normalizeEdge(rawEdge);
    if (!edge.taskId || !edge.dependsOnTaskId) continue;
    if (!adjacency.has(edge.taskId)) adjacency.set(edge.taskId, new Set());
    adjacency.get(edge.taskId)!.add(edge.dependsOnTaskId);
  }

  if (!adjacency.has(proposed.taskId)) adjacency.set(proposed.taskId, new Set());
  adjacency.get(proposed.taskId)!.add(proposed.dependsOnTaskId);

  const queue: Array<{ node: string; path: string[] }> = [
    { node: proposed.dependsOnTaskId, path: [proposed.taskId, proposed.dependsOnTaskId] },
  ];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.node === proposed.taskId) {
      return { valid: false, reason: 'CYCLE', path: current.path };
    }
    if (visited.has(current.node)) continue;
    visited.add(current.node);

    for (const dependency of adjacency.get(current.node) || []) {
      queue.push({ node: dependency, path: [...current.path, dependency] });
    }
  }

  return { valid: true };
}

export function hasTaskDependencyCycle(edges: TaskDependencyEdge[]): boolean {
  const adjacency = new Map<string, string[]>();
  for (const rawEdge of edges) {
    const edge = normalizeEdge(rawEdge);
    if (!edge.taskId || !edge.dependsOnTaskId) continue;
    const neighbors = adjacency.get(edge.taskId) || [];
    neighbors.push(edge.dependsOnTaskId);
    adjacency.set(edge.taskId, neighbors);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (node: string): boolean => {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;

    visiting.add(node);
    for (const neighbor of adjacency.get(node) || []) {
      if (visit(neighbor)) return true;
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  };

  for (const node of adjacency.keys()) {
    if (visit(node)) return true;
  }
  return false;
}
