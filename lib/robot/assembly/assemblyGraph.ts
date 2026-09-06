import type { RobotDocumentV3 } from "../schema/types.ts";

/** Returns a fixed-connected component in stable document order. Mechanical joints are boundaries. */
export function getRigidComponent(
  document: RobotDocumentV3,
  startInstanceId: string,
  ignoredConnectionId?: string
) {
  if (!document.instances.some((instance) => instance.id === startInstanceId)) {
    throw new Error(`Unknown part instance "${startInstanceId}".`);
  }

  const adjacency = new Map<string, string[]>();
  for (const connection of document.connections) {
    if (connection.id === ignoredConnectionId) continue;
    const a = adjacency.get(connection.a.instanceId) ?? [];
    a.push(connection.b.instanceId);
    adjacency.set(connection.a.instanceId, a);
    const b = adjacency.get(connection.b.instanceId) ?? [];
    b.push(connection.a.instanceId);
    adjacency.set(connection.b.instanceId, b);
  }

  const visited = new Set([startInstanceId]);
  const queue = [startInstanceId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const neighbor of adjacency.get(current) ?? []) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      queue.push(neighbor);
    }
  }

  return document.instances.filter((instance) => visited.has(instance.id)).map((instance) => instance.id);
}
