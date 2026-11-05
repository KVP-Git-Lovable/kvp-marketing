// Helpers for resolving which upstream WhatsApp Message node a
// "Message Response" node is evaluating. Centralized here so the canvas
// property panel and the live-counts hook (and, mirrored server-side,
// the process-journeys execution engine) all resolve a target the same
// way: prefer a saved target_node_id if it still exists on the canvas,
// otherwise walk backward over incoming edges to the nearest upstream
// `message` node.

export interface GraphNode {
  id: string;
  type?: string;
  data?: Record<string, unknown>;
}
export interface GraphEdge {
  source: string;
  target: string;
  sourceHandle?: string | null;
}

export function isTemplateStep(node: GraphNode | undefined | null): boolean {
  return !!node && node.type === "message";
}

export function templateLabel(node: GraphNode): string {
  return (node.data?.template_name as string) || "WhatsApp Message";
}

export function findUpstreamTemplate(
  nodeId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
): GraphNode | null {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const visited = new Set<string>([nodeId]);
  const queue: string[] = [nodeId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const incoming = edges.filter((e) => e.target === current);
    for (const edge of incoming) {
      if (visited.has(edge.source)) continue;
      visited.add(edge.source);
      const node = byId.get(edge.source);
      if (isTemplateStep(node)) return node!;
      queue.push(edge.source);
    }
  }
  return null;
}

export function effectiveResponseTarget(
  node: GraphNode,
  nodes: GraphNode[],
  edges: GraphEdge[],
  allowSingle = true,
): { target: GraphNode; auto: boolean } | null {
  const savedId = node.data?.target_node_id as string | undefined;
  if (savedId) {
    const saved = nodes.find((n) => n.id === savedId);
    if (saved) return { target: saved, auto: false };
  }
  const upstream = findUpstreamTemplate(node.id, nodes, edges);
  if (upstream) return { target: upstream, auto: true };
  if (allowSingle) {
    const templateNodes = nodes.filter(isTemplateStep);
    if (templateNodes.length === 1) return { target: templateNodes[0], auto: true };
  }
  return null;
}
