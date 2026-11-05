import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { effectiveResponseTarget, type GraphEdge, type GraphNode } from "@/lib/journeyResponseTargets";

export interface LiveCounts {
  yes: number;
  no: number;
}

// Polls journey_message_log for every Message Response node's resolved
// target and buckets delivery/read/failure status into yes/no counts
// matching that node's own condition, so the canvas can show a live
// badge without waiting for the next full analytics refresh.
export function useMessageResponseLiveCounts(
  journeyId: string | undefined,
  nodes: GraphNode[],
  edges: GraphEdge[],
) {
  const responseNodes = nodes.filter((n) => n.type === "message_response");
  const targetByNodeId: Record<string, string> = {};
  for (const n of responseNodes) {
    const eff = effectiveResponseTarget(n, nodes, edges);
    if (eff) targetByNodeId[n.id] = eff.target.id;
  }
  const targetIds = Array.from(new Set(Object.values(targetByNodeId)));

  return useQuery({
    queryKey: ["mr-live-counts", journeyId, targetIds.join(",")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journey_message_log")
        .select("node_id, status, enrollment_id")
        .eq("journey_id", journeyId!)
        .in("node_id", targetIds);
      if (error) throw error;

      const byTarget: Record<string, { sent: Set<string>; delivered: Set<string>; read: Set<string>; failed: Set<string> }> = {};
      for (const row of data || []) {
        const key = row.enrollment_id as string;
        const bucket = byTarget[row.node_id as string] ||= { sent: new Set(), delivered: new Set(), read: new Set(), failed: new Set() };
        if (row.status === "failed" || row.status === "rate_limited") bucket.failed.add(key);
        else {
          bucket.sent.add(key);
          if (row.status === "delivered" || row.status === "read") bucket.delivered.add(key);
          if (row.status === "read") bucket.read.add(key);
        }
      }

      const result: Record<string, LiveCounts> = {};
      for (const node of responseNodes) {
        const targetId = targetByNodeId[node.id];
        const bucket = targetId ? byTarget[targetId] : undefined;
        if (!bucket) continue;
        const sent = bucket.sent.size, delivered = bucket.delivered.size, read = bucket.read.size, failed = bucket.failed.size;
        const condition = (node.data?.condition as string) || "read";
        switch (condition) {
          case "read": result[node.id] = { yes: read, no: delivered - read }; break;
          case "not_read": result[node.id] = { yes: delivered - read, no: read }; break;
          case "delivered": result[node.id] = { yes: delivered, no: sent - delivered }; break;
          case "not_delivered": result[node.id] = { yes: sent - delivered, no: delivered }; break;
          case "failed":
          case "undelivered": result[node.id] = { yes: failed, no: delivered }; break;
          default: break; // replied / not_replied: no live badge (same gap as the reference implementation)
        }
      }
      return result;
    },
    enabled: !!journeyId && targetIds.length > 0,
    refetchInterval: 30000,
  });
}
