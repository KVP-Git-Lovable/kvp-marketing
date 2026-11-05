import {
  AlertTriangle, ArrowRight, Award, Ban, BarChart3, Boxes, Calendar, Camera,
  CheckCircle2, ClipboardList, Clock, Coins, FileText, Flag, Gift, Handshake,
  IndianRupee, Info, Lock, MapPin, Package, Percent, PhoneCall, Receipt, Repeat,
  Route, ShoppingCart, Sparkles, Star, Store, Target, ThumbsUp, TrendingUp,
  Truck, UserPlus, Users, XCircle, Zap, type LucideIcon,
} from "lucide-react";

/**
 * The icons an admin can attach to an Overview line.
 *
 * Deliberately a curated list, not all ~1,500 lucide icons and not free text:
 * the admin picks from a grid of things that actually happen on a beat, so the
 * page cannot end up with a broken glyph and nobody has to know icon names.
 * Adding one here is a one-line change and it appears in the picker at once.
 */
export const OVERVIEW_ICONS: { name: string; label: string; Icon: LucideIcon }[] = [
  // Field work
  { name: "Store", label: "Retailer", Icon: Store },
  { name: "UserPlus", label: "New retailer", Icon: UserPlus },
  { name: "MapPin", label: "Visit", Icon: MapPin },
  { name: "Route", label: "Beat / route", Icon: Route },
  { name: "Camera", label: "Photo", Icon: Camera },
  { name: "PhoneCall", label: "Call", Icon: PhoneCall },
  { name: "Handshake", label: "Meeting", Icon: Handshake },
  // Selling
  { name: "ShoppingCart", label: "Order", Icon: ShoppingCart },
  { name: "Receipt", label: "Invoice", Icon: Receipt },
  { name: "Package", label: "Product", Icon: Package },
  { name: "Boxes", label: "Stock", Icon: Boxes },
  { name: "Truck", label: "Delivery", Icon: Truck },
  { name: "IndianRupee", label: "Value", Icon: IndianRupee },
  { name: "Percent", label: "Percentage", Icon: Percent },
  // Goals and reward
  { name: "Target", label: "Target", Icon: Target },
  { name: "TrendingUp", label: "Growth", Icon: TrendingUp },
  { name: "Star", label: "Points", Icon: Star },
  { name: "Coins", label: "Cash reward", Icon: Coins },
  { name: "Gift", label: "Bonus", Icon: Gift },
  { name: "Award", label: "Achievement", Icon: Award },
  { name: "BarChart3", label: "Leaderboard", Icon: BarChart3 },
  { name: "Flag", label: "Milestone", Icon: Flag },
  // Process
  { name: "ArrowRight", label: "Next step", Icon: ArrowRight },
  { name: "ClipboardList", label: "Form / details", Icon: ClipboardList },
  { name: "FileText", label: "Document", Icon: FileText },
  { name: "CheckCircle2", label: "Counts", Icon: CheckCircle2 },
  { name: "ThumbsUp", label: "Approved", Icon: ThumbsUp },
  { name: "Users", label: "Team", Icon: Users },
  { name: "Sparkles", label: "Highlight", Icon: Sparkles },
  { name: "Zap", label: "Instant", Icon: Zap },
  // Timing
  { name: "Calendar", label: "Date / period", Icon: Calendar },
  { name: "Clock", label: "Timing", Icon: Clock },
  { name: "Repeat", label: "Repeats", Icon: Repeat },
  // Limits
  { name: "XCircle", label: "Doesn't count", Icon: XCircle },
  { name: "Ban", label: "Not allowed", Icon: Ban },
  { name: "Lock", label: "Locked", Icon: Lock },
  { name: "AlertTriangle", label: "Careful", Icon: AlertTriangle },
  { name: "Info", label: "Information", Icon: Info },
];

const BY_NAME = new Map(OVERVIEW_ICONS.map((i) => [i.name, i.Icon]));

/** Never returns undefined, so a renamed or hand-edited icon degrades to Info. */
export function overviewIcon(name?: string): LucideIcon {
  return (name && BY_NAME.get(name)) || Info;
}
