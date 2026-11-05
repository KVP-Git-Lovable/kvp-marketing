export type JourneyNodeType = "entry" | "message" | "delay" | "decision" | "message_response" | "exit";

export interface EntryNodeData {
  category?: string;
  territory_id?: string;
  beat_id?: string;
}
export interface MessageNodeData {
  template_id: string;
  template_name?: string;
  cta_url?: string;
}
export interface DelayNodeData {
  duration: number;
  unit: "hours" | "days";
}
export interface DecisionNodeData {
  condition: "sent_ok";
}
export type MessageResponseCondition =
  | "delivered" | "not_delivered"
  | "read" | "not_read"
  | "replied" | "not_replied"
  | "failed" | "undelivered";
export interface MessageResponseNodeData {
  target_node_id?: string;
  target_node_label?: string;
  condition?: MessageResponseCondition;
  wait_value?: number;
  wait_unit?: "minutes" | "hours" | "days";
  early_exit?: boolean;
}
export interface ExitNodeData {
  label?: string;
}

export type JourneyNodeData =
  | EntryNodeData
  | MessageNodeData
  | DelayNodeData
  | DecisionNodeData
  | MessageResponseNodeData
  | ExitNodeData;
