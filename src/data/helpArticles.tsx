import { MapPin, Clock, ClipboardList, Info, Lightbulb, Sparkles, BarChart3, ShoppingCart, Users, Calendar, Award, Briefcase, Star, Settings, Shield, CheckCircle2 } from "lucide-react";

// Screenshot imports (My Visit)
import imgMyVisitOverview from "@/assets/help/my-visit-overview.png";
import imgBeatPlanning from "@/assets/help/beat-planning.png";
import imgCheckIn from "@/assets/help/check-in-screen.png";
import imgOrderEntry from "@/assets/help/order-entry.png";
import imgTodaySummary from "@/assets/help/today-summary.png";
import imgVisitStatuses from "@/assets/help/visit-statuses.png";

export interface ArticleSection {
  title: string;
  icon?: React.ReactNode;
  content: string[];
  tips?: string[];
  steps?: string[];
  screenshot?: { src: string; alt: string; caption?: string };
}

export interface ArticleData {
  id: string;
  title: string;
  category: string;
  readTime: string;
  lastUpdated: string;
  summary: string;
  sections: ArticleSection[];
  nextArticle?: { id: string; title: string };
  prevArticle?: { id: string; title: string };
}

export const articlesDB: Record<string, ArticleData> = {
  // ===================== MY VISIT =====================
  "my-visit-overview": {
    id: "my-visit-overview",
    title: "Overview – How My Visit Works",
    category: "My Visit",
    readTime: "3 min read",
    lastUpdated: "March 2026",
    summary: "My Visit is your daily command center for field sales. It combines beat planning, GPS-verified check-ins, order placement, and real-time progress tracking into one seamless workflow.",
    sections: [
      {
        title: "What is My Visit?",
        icon: <MapPin className="w-4 h-4" />,
        content: [
          "My Visit is the core module that manages your entire day in the field. From the moment you start your day to the last check-out, everything is tracked here.",
          "It shows your planned retailers for the day based on your beat schedule, lets you check in at each stop with GPS verification, and allows you to place orders directly during the visit."
        ],
        screenshot: { src: imgMyVisitOverview, alt: "My Visit daily screen showing retailer cards with status badges", caption: "My Visit – Your daily retailer visit list with live status tracking" },
      },
      {
        title: "Key Features at a Glance",
        icon: <ClipboardList className="w-4 h-4" />,
        content: [],
        steps: [
          "Beat-based daily schedule – See which retailers to visit today",
          "GPS-verified check-in & check-out – Accurate location tracking",
          "In-visit order entry – Place orders right from the visit screen",
          "Visit status tracking – Planned, In Progress, Productive, Unproductive",
          "Today's summary dashboard – Real-time progress with order totals",
          "Auto Plan (AI) – Let AI suggest the optimal visit sequence",
          "Multiple orders per visit – Place separate orders in the same retailer visit",
        ],
      },
      {
        title: "Typical Daily Workflow",
        icon: <Clock className="w-4 h-4" />,
        content: ["Here's how a typical day looks using My Visit:"],
        steps: [
          "Mark attendance (Start My Day) from the Home screen",
          "Open My Visit to see today's planned beat and retailers",
          "Navigate to the first retailer and tap 'Check-In'",
          "GPS location is automatically captured and verified",
          "Take orders using the Order Entry form",
          "Tap 'Check-Out' after completing the visit",
          "Move to the next retailer and repeat",
          "View Today's Summary to see your progress and total orders",
          "End your day from the Home screen when done",
        ],
      },
      {
        title: "Navigation",
        icon: <Info className="w-4 h-4" />,
        content: ["You can access My Visit from the Home screen's 'Today's Visit' card, or from the bottom navigation bar. The visit screen has multiple views:"],
        steps: [
          "Beat View – Shows all retailers in today's beat plan",
          "All Retailers – Browse the complete retailer list",
          "Timeline – Visual timeline of your day's check-ins",
          "Summary – Quick stats on visits, orders, and progress",
        ],
      },
    ],
    nextArticle: { id: "my-visit-beat-planning", title: "Beat Planning & Day Schedule" },
  },
  "my-visit-beat-planning": {
    id: "my-visit-beat-planning",
    title: "Beat Planning & Day Schedule",
    category: "My Visit",
    readTime: "2 min read",
    lastUpdated: "March 2026",
    summary: "Learn how beats organize your daily route and how to view, switch, or create beat plans for efficient territory coverage.",
    sections: [
      {
        title: "What is a Beat?",
        content: [
          "A beat is a predefined route or area containing a group of retailers. Each day of the week can have a different beat assigned, ensuring complete territory coverage over time.",
          "Your beat for the day determines which retailers appear on your My Visit screen."
        ],
        screenshot: { src: imgBeatPlanning, alt: "Beat schedule showing weekly plan with retailer counts", caption: "Weekly beat schedule – Each day has an assigned beat with retailers" },
      },
      {
        title: "Viewing Your Beat Plan",
        content: [],
        steps: [
          "Open My Visit – The current beat name is displayed at the top",
          "Tap the beat name to see beat details including retailer count and distance",
          "Use 'All Beat' tab to see the full week's beat schedule",
        ],
      },
      {
        title: "Adding Retailers to Today's Plan",
        content: ["If you need to visit a retailer not in the current beat, you can add them directly:"],
        steps: [
          "Tap 'All Retailers' tab in the visit screen",
          "Search for the retailer by name or phone",
          "Tap to add them to today's plan",
          "They will appear in your visit list for the day",
        ],
        tips: ["Added retailers don't change your permanent beat plan – they are one-time additions for today only."],
      },
    ],
    prevArticle: { id: "my-visit-overview", title: "Overview – How My Visit Works" },
    nextArticle: { id: "my-visit-check-in-out", title: "Check-In & Check-Out (GPS Verified)" },
  },
  "my-visit-check-in-out": {
    id: "my-visit-check-in-out",
    title: "Check-In & Check-Out (GPS Verified)",
    category: "My Visit",
    readTime: "2 min read",
    lastUpdated: "March 2026",
    summary: "Understand how GPS-verified check-in and check-out works, and what happens when GPS is unavailable.",
    sections: [
      {
        title: "How Check-In Works",
        content: ["When you arrive at a retailer location, tap the 'Check-In' button on the retailer's visit card. The app will:"],
        screenshot: { src: imgCheckIn, alt: "GPS check-in screen with location verified", caption: "GPS-verified check-in – Location is auto-captured and verified" },
        steps: [
          "Request your current GPS location",
          "Verify you are within range of the retailer's registered address",
          "Record the check-in time and coordinates",
          "Change the visit status to 'In Progress'",
        ],
      },
      {
        title: "How Check-Out Works",
        content: ["After completing your visit activities (orders, branding, etc.), tap 'Check-Out'. The app records:"],
        steps: [
          "Check-out time and GPS coordinates",
          "Total time spent at the retailer",
          "Visit outcome – Productive (order placed) or Unproductive (no order)",
        ],
        tips: [
          "Always check out before leaving. If you forget, the system may auto-checkout after a timeout.",
          "Ensure GPS/Location services are turned on for accurate tracking.",
        ],
      },
      {
        title: "What if GPS is Unavailable?",
        content: ["If your device can't get a GPS fix, the app will still allow check-in but may flag it for manager review. Check-ins without GPS verification are marked differently in reports."],
      },
    ],
    prevArticle: { id: "my-visit-beat-planning", title: "Beat Planning & Day Schedule" },
    nextArticle: { id: "my-visit-order-entry", title: "Placing Orders During a Visit" },
  },
  "my-visit-order-entry": {
    id: "my-visit-order-entry",
    title: "Placing Orders During a Visit",
    category: "My Visit",
    readTime: "2 min read",
    lastUpdated: "March 2026",
    summary: "Step-by-step guide to placing orders while visiting a retailer, including product search, cart management, and applicable schemes.",
    sections: [
      {
        title: "Starting an Order",
        content: ["Once you've checked in to a retailer, you can start placing an order:"],
        screenshot: { src: imgOrderEntry, alt: "Order entry screen with product catalog and cart", caption: "Order Entry – Browse products, add quantities, and see cart totals" },
        steps: [
          "Tap the 'Order Entry' button on the visit screen",
          "Browse products by category or search by name",
          "Enter quantity for each product",
          "The app auto-calculates totals based on price lists",
        ],
      },
      {
        title: "Using the Cart",
        content: ["As you add products, they accumulate in your cart:"],
        steps: [
          "Tap 'View Cart' to see all added items",
          "Adjust quantities or remove items as needed",
          "Review applicable schemes and discounts",
          "Tap 'Place Order' to confirm and submit",
        ],
        tips: [
          "You can place multiple separate orders in the same visit – each appears as a separate card.",
          "The cart persists even if you navigate away temporarily.",
        ],
      },
      {
        title: "Schemes & Discounts",
        content: ["Active schemes are automatically shown during order entry. Look for the 'Schemes' button or badge to see what offers apply to the current retailer or products."],
      },
    ],
    prevArticle: { id: "my-visit-check-in-out", title: "Check-In & Check-Out (GPS Verified)" },
    nextArticle: { id: "my-visit-visit-status", title: "Visit Statuses Explained" },
  },
  "my-visit-visit-status": {
    id: "my-visit-visit-status",
    title: "Visit Statuses Explained",
    category: "My Visit",
    readTime: "2 min read",
    lastUpdated: "March 2026",
    summary: "What each visit status means and how it gets assigned automatically.",
    sections: [
      {
        title: "Status Types",
        content: [],
        screenshot: { src: imgVisitStatuses, alt: "Visit status cards showing Planned, In Progress, Productive, Unproductive", caption: "Visit statuses – Each visit is auto-classified based on activity" },
        steps: [
          "Planned – Visit is scheduled but not started. Default state for the day.",
          "In Progress – You have checked in but not yet checked out.",
          "Productive – Visit completed with at least one order placed.",
          "Unproductive – Visit completed but no order was placed.",
          "Store Closed – Retailer was closed when you arrived.",
          "Cancelled – Visit was cancelled before or during execution.",
        ],
      },
      {
        title: "How Status is Assigned",
        content: [
          "Statuses are mostly automatic. When you check in, it moves to 'In Progress'. When you check out, the system checks if an order was placed – if yes, it's 'Productive'; otherwise 'Unproductive'.",
          "You can manually mark a visit as 'Store Closed' or 'Cancelled' from the visit options menu."
        ],
        tips: ["Productive visits contribute to your daily performance metrics and leaderboard points."],
      },
    ],
    prevArticle: { id: "my-visit-order-entry", title: "Placing Orders During a Visit" },
    nextArticle: { id: "my-visit-auto-plan", title: "Using Auto Plan (AI-Powered)" },
  },
  "my-visit-auto-plan": {
    id: "my-visit-auto-plan",
    title: "Using Auto Plan (AI-Powered)",
    category: "My Visit",
    readTime: "2 min read",
    lastUpdated: "March 2026",
    summary: "Let AI optimize your visit sequence for maximum efficiency and coverage.",
    sections: [
      {
        title: "What is Auto Plan?",
        icon: <Sparkles className="w-4 h-4" />,
        content: ["Auto Plan is an AI-powered feature that suggests the optimal order in which to visit your retailers for the day. It considers factors like:"],
        steps: [
          "Geographic proximity – minimize travel distance",
          "Retailer priority – high-value retailers first",
          "Visit history – retailers overdue for a visit",
          "Time windows – best times to visit certain stores",
        ],
      },
      {
        title: "How to Use It",
        content: [],
        steps: [
          "Go to My Visit and tap the 'Auto Plan' button",
          "The AI analyzes your beat and suggests an optimized sequence",
          "Review the suggested plan and tap 'Accept' to apply",
          "Your visit list will be reordered accordingly",
        ],
        tips: [
          "Auto Plan works best when retailer GPS coordinates are accurate.",
          "You can always manually reorder after applying Auto Plan.",
        ],
      },
    ],
    prevArticle: { id: "my-visit-visit-status", title: "Visit Statuses Explained" },
    nextArticle: { id: "my-visit-today-summary", title: "Today's Summary & Progress" },
  },
  "my-visit-today-summary": {
    id: "my-visit-today-summary",
    title: "Today's Summary & Progress",
    category: "My Visit",
    readTime: "2 min read",
    lastUpdated: "March 2026",
    summary: "Track your daily progress with real-time stats on visits, orders, and productivity.",
    sections: [
      {
        title: "Accessing Today's Summary",
        icon: <BarChart3 className="w-4 h-4" />,
        content: ["Today's Summary is accessible from the Home screen and gives you a real-time snapshot of your day:"],
        screenshot: { src: imgTodaySummary, alt: "Today's summary dashboard with visit and order stats", caption: "Today's Summary – Real-time stats on visits, orders, and productivity" },
        steps: [
          "Total planned visits vs completed visits",
          "Number of productive and unproductive visits",
          "Total order value for the day",
          "Orders placed count",
          "New retailers added (if any)",
        ],
      },
      {
        title: "Progress Indicators",
        content: [
          "The progress bar on the Home screen shows your visit completion rate. It updates automatically as you check in and out of retailers.",
          "A green progress bar means you're on track; amber means you're falling behind the planned count."
        ],
        tips: [
          "Check the summary periodically to stay on target.",
          "The summary data syncs even in low-connectivity areas once you're back online.",
        ],
      },
    ],
    prevArticle: { id: "my-visit-auto-plan", title: "Using Auto Plan (AI-Powered)" },
    nextArticle: { id: "my-visit-tips", title: "Tips & Best Practices" },
  },
  "my-visit-tips": {
    id: "my-visit-tips",
    title: "Tips & Best Practices",
    category: "My Visit",
    readTime: "2 min read",
    lastUpdated: "March 2026",
    summary: "Pro tips to get the most out of the My Visit module.",
    sections: [
      {
        title: "Before You Start Your Day",
        icon: <Lightbulb className="w-4 h-4" />,
        content: [],
        steps: [
          "Check your beat plan the evening before to know your route",
          "Ensure your phone's GPS is enabled and battery is charged",
          "Download any pending offline data if you'll be in low-connectivity areas",
        ],
      },
      {
        title: "During Your Visits",
        content: [],
        steps: [
          "Always check in before entering the store for accurate time tracking",
          "Use the retailer intelligence cards to prepare your pitch before entering",
          "Place orders while inside the store to avoid missing items",
          "Check out immediately after leaving – don't batch check-outs",
        ],
      },
      {
        title: "End of Day",
        content: [],
        steps: [
          "Review Today's Summary to ensure all visits are accounted for",
          "Mark any remaining planned visits as 'Store Closed' or 'Cancelled' with reasons",
          "End your day from the attendance module to stop GPS tracking",
        ],
        tips: [
          "Consistent check-in/out helps your manager understand your field patterns and provide better support.",
          "Productive visit ratio is a key metric in your performance dashboard.",
        ],
      },
    ],
    prevArticle: { id: "my-visit-today-summary", title: "Today's Summary & Progress" },
  },

  // ===================== ATTENDANCE =====================
  "attendance-overview": {
    id: "attendance-overview",
    title: "How Attendance Works",
    category: "Attendance",
    readTime: "3 min read",
    lastUpdated: "March 2026",
    summary: "Attendance tracking records your daily presence, working hours, and leave history. It's the foundation of your field activity log.",
    sections: [
      {
        title: "What is the Attendance Module?",
        icon: <Calendar className="w-4 h-4" />,
        content: [
          "The Attendance module tracks when you start and end your workday. It uses GPS to verify your location when marking attendance and records total hours worked.",
          "Your attendance record is linked to visits, market hours, and leave applications – giving your manager a complete picture of your field activity.",
        ],
      },
      {
        title: "Key Features",
        content: [],
        steps: [
          "Start My Day / End My Day – One-tap attendance marking with GPS",
          "Monthly calendar view – See your present, absent, leave, and holiday days",
          "Market hours tracking – Auto-calculated from visit check-ins",
          "Leave management – Apply for leaves directly from the app",
          "Regularization – Request corrections for missed attendance entries",
        ],
      },
      {
        title: "Attendance Statuses",
        content: ["Each day in your calendar can have one of these statuses:"],
        steps: [
          "Present – Day started and ended successfully",
          "Absent – No attendance marked for a working day",
          "Leave – Approved leave for the day",
          "Half Day – Worked for a partial day",
          "Holiday – Company-declared holiday",
        ],
        tips: ["Your monthly summary shows total present days, absent days, leaves, and average hours – review it regularly."],
      },
    ],
    nextArticle: { id: "attendance-start-end", title: "Starting & Ending Your Day" },
  },
  "attendance-start-end": {
    id: "attendance-start-end",
    title: "Starting & Ending Your Day",
    category: "Attendance",
    readTime: "2 min read",
    lastUpdated: "March 2026",
    summary: "How to mark your daily attendance using the Start My Day and End My Day buttons.",
    sections: [
      {
        title: "Starting Your Day",
        icon: <Clock className="w-4 h-4" />,
        content: ["When you're ready to begin work, mark your attendance from the Home screen:"],
        steps: [
          "Open the app and go to the Home screen",
          "Tap 'Start My Day' on the attendance card",
          "Allow location permission if prompted",
          "Your GPS location and time are recorded",
          "GPS tracking begins for market hours calculation",
        ],
      },
      {
        title: "Ending Your Day",
        content: ["When you've finished all visits and are ready to wrap up:"],
        steps: [
          "Go to the Home screen",
          "Tap 'End My Day' on the attendance card",
          "Confirm the action when prompted",
          "Your check-out time, location, and total hours are recorded",
          "GPS tracking stops",
        ],
        tips: [
          "Always end your day from the app – don't just close it. This ensures accurate hour tracking.",
          "If you forget to end your day, your manager can see it as an open attendance record.",
        ],
      },
      {
        title: "Face Verification",
        content: [
          "Some organizations enable face verification for attendance. If enabled, you'll be asked to take a selfie during Start/End day. The app matches your face against your profile photo to prevent proxy attendance.",
        ],
      },
    ],
    prevArticle: { id: "attendance-overview", title: "How Attendance Works" },
    nextArticle: { id: "attendance-market-hours", title: "Market Hours Tracking" },
  },
  "attendance-market-hours": {
    id: "attendance-market-hours",
    title: "Market Hours Tracking",
    category: "Attendance",
    readTime: "2 min read",
    lastUpdated: "March 2026",
    summary: "Market hours measure the actual time you spend in the field visiting retailers.",
    sections: [
      {
        title: "What Are Market Hours?",
        icon: <Clock className="w-4 h-4" />,
        content: [
          "Market hours are automatically calculated from your visit check-in and check-out times. They represent the actual time you spend at retailer locations, excluding travel time between visits.",
          "This metric helps managers understand how much productive field time each salesperson spends daily.",
        ],
      },
      {
        title: "How It's Calculated",
        content: [],
        steps: [
          "Each visit check-in starts a timer for that retailer",
          "Check-out stops the timer and records time spent",
          "All visit durations for the day are summed up",
          "The total is displayed as 'Today's Market Hours'",
        ],
        tips: [
          "Market hours are different from total working hours. Working hours = End Day time – Start Day time. Market hours = sum of time at retailers only.",
          "Aim to maximize your market hours ratio for better productivity scores.",
        ],
      },
    ],
    prevArticle: { id: "attendance-start-end", title: "Starting & Ending Your Day" },
    nextArticle: { id: "attendance-leaves", title: "Applying for Leave" },
  },
  "attendance-leaves": {
    id: "attendance-leaves",
    title: "Applying for Leave",
    category: "Attendance",
    readTime: "2 min read",
    lastUpdated: "March 2026",
    summary: "How to apply for leave, check leave balances, and track approval status.",
    sections: [
      {
        title: "Submitting a Leave Request",
        content: ["You can apply for leave directly from the Attendance module:"],
        steps: [
          "Go to Attendance and tap 'Leave' tab",
          "Tap 'Apply for Leave'",
          "Select leave type (Casual, Sick, Earned, etc.)",
          "Choose duration – Full Day, Half Day, or Multi-day",
          "Select the date range",
          "Add remarks or reason (optional)",
          "Submit the request for manager approval",
        ],
      },
      {
        title: "Leave Statuses",
        content: ["Your leave request goes through an approval flow:"],
        steps: [
          "Pending – Request submitted, awaiting manager review",
          "Approved – Manager has approved your leave",
          "Rejected – Manager declined the request (with reason)",
        ],
        tips: [
          "Apply for planned leaves at least 2-3 days in advance for smoother approval.",
          "Sick leaves can be applied retroactively if you weren't able to apply on the day.",
        ],
      },
    ],
    prevArticle: { id: "attendance-market-hours", title: "Market Hours Tracking" },
    nextArticle: { id: "attendance-regularization", title: "Attendance Regularization" },
  },
  "attendance-regularization": {
    id: "attendance-regularization",
    title: "Attendance Regularization",
    category: "Attendance",
    readTime: "2 min read",
    lastUpdated: "March 2026",
    summary: "Request corrections when you forget to mark attendance or face technical issues.",
    sections: [
      {
        title: "What is Regularization?",
        content: [
          "Regularization lets you request a correction for attendance on days when you forgot to mark attendance, had GPS issues, or faced app problems.",
          "Your manager reviews these requests and can approve or reject them.",
        ],
      },
      {
        title: "How to Request Regularization",
        content: [],
        steps: [
          "Go to Attendance and find the day you need to correct",
          "Tap on the day to open details",
          "Select 'Request Regularization'",
          "Provide the correct check-in/check-out times",
          "Add a reason for the correction",
          "Submit for manager approval",
        ],
        tips: [
          "Regularization requests should be submitted within 3 days of the missed attendance for best results.",
          "Frequent regularizations may be flagged in your attendance report.",
        ],
      },
    ],
    prevArticle: { id: "attendance-leaves", title: "Applying for Leave" },
  },

  // ===================== ORDERS & CART =====================
  "orders-overview": {
    id: "orders-overview",
    title: "Order Entry Overview",
    category: "Orders & Cart",
    readTime: "3 min read",
    lastUpdated: "March 2026",
    summary: "Understand the complete order entry process – from browsing the product catalog to placing confirmed orders.",
    sections: [
      {
        title: "How Order Entry Works",
        icon: <ShoppingCart className="w-4 h-4" />,
        content: [
          "Order Entry is the primary way to place secondary orders for retailers. You can access it during a visit (after check-in) or from the retailer's detail page.",
          "The system supports product browsing by category, quick search, grid and table views, and automatic price calculation based on the retailer's price list.",
        ],
      },
      {
        title: "Accessing Order Entry",
        content: [],
        steps: [
          "Check in to a retailer during your visit",
          "Tap 'Order Entry' or 'Start Call' on the visit screen",
          "Browse the product catalog – filter by category or search",
          "Add products with quantities to build your order",
          "Review in the cart and place the order",
        ],
      },
      {
        title: "Smart Basket (AI)",
        icon: <Sparkles className="w-4 h-4" />,
        content: [
          "The Smart Basket feature uses AI to suggest products based on the retailer's purchase history. It pre-fills likely items and quantities, saving time and ensuring you don't miss frequently ordered products.",
        ],
        tips: [
          "Smart Basket suggestions improve over time as more order history accumulates.",
          "You can always modify suggested quantities before placing the order.",
        ],
      },
      {
        title: "Phone Order Entry",
        content: [
          "For orders received via phone, use the Phone Order Entry feature. It lets you create an order for a retailer without needing to physically visit them. This is useful for repeat orders or urgent requests.",
        ],
      },
    ],
    nextArticle: { id: "orders-cart", title: "Using the Cart" },
  },
  "orders-cart": {
    id: "orders-cart",
    title: "Using the Cart",
    category: "Orders & Cart",
    readTime: "2 min read",
    lastUpdated: "March 2026",
    summary: "How to manage items in your cart, adjust quantities, and finalize orders.",
    sections: [
      {
        title: "Cart Overview",
        content: [
          "The cart is where all your selected products accumulate before you confirm the order. You can add items from the catalog and review everything in one place.",
        ],
      },
      {
        title: "Managing Cart Items",
        content: [],
        steps: [
          "Tap 'View Cart' from the order entry screen to see all items",
          "Adjust quantities using the + and – buttons",
          "Remove items by setting quantity to zero or tapping delete",
          "The cart auto-calculates line totals and grand total",
          "Applicable schemes are shown with discounts applied",
        ],
      },
      {
        title: "Placing the Order",
        content: ["Once your cart is ready:"],
        steps: [
          "Review all items and totals",
          "Verify any applied schemes or discounts",
          "Tap 'Place Order' to submit",
          "The order is saved and linked to your visit record",
          "An order confirmation appears with the order number",
        ],
        tips: [
          "You can place multiple orders for the same retailer in one visit – each is tracked separately.",
          "Closing stock and return stock can also be recorded during order entry.",
        ],
      },
    ],
    prevArticle: { id: "orders-overview", title: "Order Entry Overview" },
    nextArticle: { id: "orders-schemes", title: "Applying Schemes & Offers" },
  },
  "orders-schemes": {
    id: "orders-schemes",
    title: "Applying Schemes & Offers",
    category: "Orders & Cart",
    readTime: "2 min read",
    lastUpdated: "March 2026",
    summary: "Learn how promotional schemes and discount offers work during order entry.",
    sections: [
      {
        title: "Types of Schemes",
        content: ["The app supports several types of promotional schemes:"],
        steps: [
          "Buy X Get Y Free – Purchase a quantity and get additional units free",
          "Percentage Discount – Get a percentage off on specific products or categories",
          "Flat Discount – Fixed amount off on qualifying orders",
          "Tiered Schemes – Different benefits at different quantity levels",
          "Minimum Order Value – Discounts that apply when order exceeds a threshold",
        ],
      },
      {
        title: "How Schemes Are Applied",
        content: [
          "Schemes are automatically detected and applied based on the products and quantities in your cart. Look for the scheme badge on products or the 'Schemes' section in the cart.",
          "You can also tap 'Check Schemes' to see all active schemes for the current retailer before placing the order.",
        ],
        tips: [
          "Some schemes are retailer-specific or category-specific – the app automatically filters relevant ones.",
          "Push recommended schemes to maximize your sales numbers.",
        ],
      },
    ],
    prevArticle: { id: "orders-cart", title: "Using the Cart" },
    nextArticle: { id: "orders-history", title: "Viewing Past Orders" },
  },
  "orders-history": {
    id: "orders-history",
    title: "Viewing Past Orders",
    category: "Orders & Cart",
    readTime: "2 min read",
    lastUpdated: "March 2026",
    summary: "How to access order history, filter by date or retailer, and view order details.",
    sections: [
      {
        title: "Accessing Order History",
        content: ["You can view past orders in multiple ways:"],
        steps: [
          "From the Visit screen – Tap 'View Orders' on any retailer's visit card",
          "From Today's Summary – See all orders placed today",
          "From Retailer Details – View the complete order history for a specific retailer",
        ],
      },
      {
        title: "Order Details",
        content: ["Each order record shows:"],
        steps: [
          "Order number and date",
          "Retailer name",
          "List of products with quantities and rates",
          "Applied schemes and discounts",
          "Total order value",
          "Order status",
        ],
        tips: [
          "Use the order history to quickly understand a retailer's buying pattern before your next visit.",
          "You can generate and share invoices directly from the order details screen.",
        ],
      },
    ],
    prevArticle: { id: "orders-schemes", title: "Applying Schemes & Offers" },
  },

  // ===================== RETAILERS & BEATS =====================
  "retailers-add": {
    id: "retailers-add",
    title: "Adding a New Retailer",
    category: "Retailers & Beats",
    readTime: "3 min read",
    lastUpdated: "March 2026",
    summary: "Step-by-step guide to onboarding a new retailer into the system with all required details.",
    sections: [
      {
        title: "Quick Scan – AI-Powered Onboarding",
        icon: <Sparkles className="w-4 h-4" />,
        content: [
          "The fastest way to add a retailer is using Quick Scan. Take a photo of the shop board and the AI will automatically extract the store name, GST number, and other details.",
        ],
        steps: [
          "Tap 'Add Retailer' from the Home screen or Visit screen",
          "Tap 'Quick Scan' at the top",
          "Take a clear photo of the shop board / signage",
          "The AI reads the text and auto-fills the retailer name and details",
          "Review and correct any details before saving",
        ],
      },
      {
        title: "Manual Entry",
        content: ["If Quick Scan isn't available or the board isn't readable, you can enter details manually:"],
        steps: [
          "Enter retailer name",
          "Add phone number and GST number (optional)",
          "Enter address or use GPS to auto-fill location",
          "Select the beat to assign the retailer to",
          "Choose retailer category and type",
          "Take a photo of the storefront",
          "Tap 'Save Retailer' to complete",
        ],
      },
      {
        title: "Required vs Optional Fields",
        content: ["Retailer name, beat assignment, and GPS location are required. Phone, GST, photo, and notes are optional but recommended for a complete profile."],
        tips: [
          "Adding a GPS location is critical – it enables accurate check-in verification for future visits.",
          "The storefront photo helps managers verify the retailer during reviews.",
        ],
      },
    ],
    nextArticle: { id: "retailers-manage", title: "Managing Retailer Details" },
  },
  "retailers-manage": {
    id: "retailers-manage",
    title: "Managing Retailer Details",
    category: "Retailers & Beats",
    readTime: "2 min read",
    lastUpdated: "March 2026",
    summary: "How to view, edit, and manage retailer profiles including contact info, visit history, and business data.",
    sections: [
      {
        title: "Viewing Retailer Profile",
        icon: <Users className="w-4 h-4" />,
        content: ["Each retailer has a detailed profile accessible from the visit screen or the All Retailers list:"],
        steps: [
          "Business information – Name, phone, GST, address",
          "Quick Intelligence – Monthly revenue, order frequency, popular categories",
          "Visit history – Past visits with dates and outcomes",
          "Order history – All past orders with details",
          "Payment status – Outstanding balances if any",
        ],
      },
      {
        title: "Editing Retailer Details",
        content: [
          "You can update retailer information anytime by opening the retailer profile and tapping 'Edit'. Changes are saved immediately and synced to the server.",
        ],
        tips: [
          "Keep retailer phone numbers updated – this is essential for phone orders and communication.",
          "Updating the GPS location helps improve check-in accuracy for the retailer.",
        ],
      },
    ],
    prevArticle: { id: "retailers-add", title: "Adding a New Retailer" },
    nextArticle: { id: "retailers-beats", title: "Understanding Beats" },
  },
  "retailers-beats": {
    id: "retailers-beats",
    title: "Understanding Beats",
    category: "Retailers & Beats",
    readTime: "2 min read",
    lastUpdated: "March 2026",
    summary: "Beats organize retailers into geographic routes for efficient territory coverage.",
    sections: [
      {
        title: "What is a Beat?",
        content: [
          "A beat is a geographic grouping of retailers that you visit together on a particular day. Beats are the building blocks of your weekly journey plan.",
          "Each beat typically corresponds to a market area, locality, or route. Beats are assigned to specific days of the week to ensure complete territory coverage.",
        ],
      },
      {
        title: "Managing Your Beats",
        content: ["Access your beats from 'My Beats' in the navigation:"],
        steps: [
          "View all assigned beats with retailer counts",
          "See which day each beat is scheduled for",
          "View beat details including distance and estimated time",
          "Check beat allowance (travel and daily allowance)",
        ],
      },
      {
        title: "Beat Planning",
        content: [
          "Beat plans are typically set by your manager or admin. You can view your weekly beat schedule to plan ahead. Some organizations allow salespersons to create or modify their own beat plans.",
        ],
        tips: [
          "Review your next day's beat plan each evening to prepare your route.",
          "If a beat has too many or too few retailers, discuss optimization with your manager.",
        ],
      },
    ],
    prevArticle: { id: "retailers-manage", title: "Managing Retailer Details" },
    nextArticle: { id: "retailers-territories", title: "Territories Overview" },
  },
  "retailers-territories": {
    id: "retailers-territories",
    title: "Territories Overview",
    category: "Retailers & Beats",
    readTime: "2 min read",
    lastUpdated: "March 2026",
    summary: "Territories are larger regions that contain multiple beats and define your overall coverage area.",
    sections: [
      {
        title: "What is a Territory?",
        content: [
          "A territory is a higher-level geographic region that groups multiple beats together. It represents your overall coverage area and is typically aligned with a city, district, or zone.",
          "Territories help managers allocate resources and track performance at a regional level.",
        ],
      },
      {
        title: "Viewing Your Territories",
        content: ["Access Territories from the navigation menu:"],
        steps: [
          "See all territories assigned to you",
          "View beats within each territory",
          "Check retailer counts and coverage metrics",
          "View territory-level performance data",
        ],
      },
      {
        title: "Territory & Distributor Mapping",
        content: [
          "Territories can be linked to distributors. This mapping determines which distributor supplies products to retailers in a particular territory. Understanding this link helps you process orders correctly.",
        ],
        tips: ["If you notice retailers mapped to the wrong territory, inform your admin for correction."],
      },
    ],
    prevArticle: { id: "retailers-beats", title: "Understanding Beats" },
  },

  // ===================== PERFORMANCE & TARGETS =====================
  "performance-dashboard": {
    id: "performance-dashboard",
    title: "Performance Dashboard",
    category: "Performance & Targets",
    readTime: "3 min read",
    lastUpdated: "March 2026",
    summary: "Your performance dashboard shows key metrics including visit productivity, order values, and target achievement.",
    sections: [
      {
        title: "Dashboard Overview",
        icon: <BarChart3 className="w-4 h-4" />,
        content: [
          "The Performance Dashboard gives you a comprehensive view of your field sales performance. It aggregates data from visits, orders, attendance, and targets into actionable insights.",
        ],
      },
      {
        title: "Key Metrics",
        content: ["The dashboard tracks these important KPIs:"],
        steps: [
          "Total visits – Planned vs completed visits",
          "Productive call ratio – Percentage of visits where orders were placed",
          "Total order value – Revenue generated from orders",
          "New retailers added – Expansion of your retailer base",
          "Average order value – Order value divided by productive visits",
          "Market hours – Total time spent in the field at retailers",
          "Target achievement – Progress towards quantity and revenue targets",
        ],
      },
      {
        title: "Time Period Filters",
        content: ["You can view performance data across different time periods:"],
        steps: [
          "Today – Current day's stats",
          "This Week – Rolling 7-day performance",
          "This Month – Month-to-date metrics",
          "This Quarter – Quarterly performance",
          "Custom Range – Select specific date ranges",
        ],
        tips: [
          "Compare your current month with last month to spot trends.",
          "The AI Target Advisor uses this data to give you personalized recommendations.",
        ],
      },
    ],
    nextArticle: { id: "performance-targets", title: "Setting & Tracking Targets" },
  },
  "performance-targets": {
    id: "performance-targets",
    title: "Setting & Tracking Targets",
    category: "Performance & Targets",
    readTime: "3 min read",
    lastUpdated: "March 2026",
    summary: "Understand how targets are set, distributed down the hierarchy, and tracked against actuals.",
    sections: [
      {
        title: "How Targets Work",
        content: [
          "Targets are set by management and distributed down the organizational hierarchy. Your manager assigns your monthly or quarterly targets for metrics like quantity, revenue, and visit count.",
          "The target system supports Financial Year (FY) planning with customizable periods.",
        ],
      },
      {
        title: "Target Types",
        content: ["You may have targets for:"],
        steps: [
          "Quantity – Number of units to sell",
          "Revenue – Total order value to achieve",
          "Visits – Number of productive visits",
        ],
      },
      {
        title: "Tracking Progress",
        content: ["Your target vs actual progress is visible in multiple places:"],
        steps: [
          "Home screen – Target card with progress bar and gap/overachievement",
          "My Target page – Detailed FY breakdown with monthly splits",
          "Performance Dashboard – Target achievement trends",
          "AI Target Advisor – Personalized tips to close the gap",
        ],
        tips: [
          "The 'Daily Average' feature shows you how much you need per day to hit your monthly target.",
          "If your target shows 'Gap: ₹X to go', focus on high-value retailers to close the gap faster.",
        ],
      },
    ],
    prevArticle: { id: "performance-dashboard", title: "Performance Dashboard" },
    nextArticle: { id: "performance-reports", title: "Viewing Reports" },
  },
  "performance-reports": {
    id: "performance-reports",
    title: "Viewing Reports",
    category: "Performance & Targets",
    readTime: "2 min read",
    lastUpdated: "March 2026",
    summary: "Access and understand the various performance and analytics reports available.",
    sections: [
      {
        title: "Available Reports",
        content: ["The app provides several report types:"],
        steps: [
          "Visit Reports – Daily/weekly/monthly visit summaries",
          "Order Reports – Order values, product-wise breakdowns",
          "Attendance Reports – Presence, hours, and leave records",
          "Beat Coverage Reports – Which beats and retailers were covered",
          "Target Achievement Reports – Target vs actual comparisons",
        ],
      },
      {
        title: "Analytics Page",
        icon: <BarChart3 className="w-4 h-4" />,
        content: [
          "The Analytics page provides visual charts and graphs for deeper insights. You can see trends over time, compare periods, and identify patterns in your field activity.",
        ],
        steps: [
          "Access Analytics from the navigation menu",
          "Select the metric you want to analyze",
          "Use time period filters to narrow the data",
          "View charts, graphs, and data tables",
        ],
        tips: [
          "Review your analytics weekly to spot opportunities for improvement.",
          "The AI Insights section highlights patterns you might miss – check it regularly.",
        ],
      },
    ],
    prevArticle: { id: "performance-targets", title: "Setting & Tracking Targets" },
  },

  // ===================== GAMIFICATION & REWARDS =====================
  "gamification-leaderboard": {
    id: "gamification-leaderboard",
    title: "Leaderboard & Rankings",
    category: "Gamification & Rewards",
    readTime: "2 min read",
    lastUpdated: "March 2026",
    summary: "See how you rank against peers on the sales leaderboard and understand the ranking criteria.",
    sections: [
      {
        title: "How the Leaderboard Works",
        icon: <Award className="w-4 h-4" />,
        content: [
          "The leaderboard ranks all field sales reps based on their performance points. Points are earned through productive visits, orders, target achievement, and special activities.",
          "Rankings are updated in real-time and can be viewed by day, week, month, or quarter.",
        ],
      },
      {
        title: "Ranking Factors",
        content: ["Your leaderboard position is determined by:"],
        steps: [
          "Productive visits – More productive visits = more points",
          "Order value – Higher order values earn more points",
          "Target achievement – Hitting or exceeding targets earns bonus points",
          "Consistency – Regular attendance and coverage contribute to rank",
          "New retailers – Adding new retailers earns extra points",
        ],
      },
      {
        title: "Viewing the Leaderboard",
        content: [],
        steps: [
          "Access from 'Leaderboard' on the Home screen or Gamification page",
          "See your rank among peers",
          "View top performers and their stats",
          "Filter by time period for different views",
        ],
        tips: [
          "Focus on consistent performance rather than one-day spikes for a better overall rank.",
          "The leaderboard motivates healthy competition – celebrate your team's wins!",
        ],
      },
    ],
    nextArticle: { id: "gamification-badges", title: "Earning Badges" },
  },
  "gamification-badges": {
    id: "gamification-badges",
    title: "Earning Badges",
    category: "Gamification & Rewards",
    readTime: "2 min read",
    lastUpdated: "March 2026",
    summary: "Badges recognize your achievements and milestones. Learn how to earn them and what they mean.",
    sections: [
      {
        title: "What Are Badges?",
        content: [
          "Badges are virtual rewards that recognize specific achievements in your field sales journey. They appear on your profile and contribute to your overall gamification score.",
        ],
      },
      {
        title: "Types of Badges",
        content: ["You can earn badges for various accomplishments:"],
        steps: [
          "Visit Milestones – Complete 50, 100, 500 visits",
          "Order Champions – Place orders above certain thresholds",
          "Streak Badges – Maintain consecutive productive days",
          "Coverage Badges – Visit all retailers in a beat",
          "Target Badges – Achieve 100% or more of monthly target",
          "Learning Badges – Complete training modules and quizzes",
        ],
      },
      {
        title: "Viewing Your Badges",
        content: [
          "All earned badges appear on your Gamification profile. Locked badges show the criteria needed to unlock them, giving you clear goals to work towards.",
        ],
        tips: [
          "Badges are permanent once earned – they stay on your profile forever.",
          "Some badges have tiers (Bronze, Silver, Gold) for increasing difficulty levels.",
        ],
      },
    ],
    prevArticle: { id: "gamification-leaderboard", title: "Leaderboard & Rankings" },
    nextArticle: { id: "gamification-points", title: "Points System" },
  },
  "gamification-points": {
    id: "gamification-points",
    title: "Points System",
    category: "Gamification & Rewards",
    readTime: "2 min read",
    lastUpdated: "March 2026",
    summary: "How points are earned, calculated, and used across the gamification system.",
    sections: [
      {
        title: "Earning Points",
        content: ["Points are the currency of the gamification system. You earn them through daily activities:"],
        steps: [
          "Productive visit – Points for each visit where an order is placed",
          "Order value – Bonus points for high-value orders",
          "Attendance – Points for marking attendance on time",
          "New retailer – Points for adding new retailers",
          "Target achievement – Points for reaching target milestones",
          "Quiz completion – Points for completing learning quizzes",
        ],
      },
      {
        title: "Points Breakdown",
        content: [
          "The exact points for each activity are configured by your admin. You can see the points breakdown on the Gamification page to understand how each activity contributes.",
        ],
      },
      {
        title: "Using Points",
        content: [
          "Points contribute to your leaderboard ranking and may unlock rewards or recognition from your organization. Some companies tie points to incentive programs or awards.",
        ],
        tips: [
          "Points earned today show up on the Home screen – track your daily earning.",
          "The 'Points Earned' field on the My Visit summary shows visit-related points.",
        ],
      },
    ],
    prevArticle: { id: "gamification-badges", title: "Earning Badges" },
  },

  // ===================== EXPENSES =====================
  "expenses-submit": {
    id: "expenses-submit",
    title: "Submitting Expenses",
    category: "Expenses",
    readTime: "2 min read",
    lastUpdated: "March 2026",
    summary: "How to submit daily expenses for travel, meals, and other field activities.",
    sections: [
      {
        title: "Types of Expenses",
        icon: <Briefcase className="w-4 h-4" />,
        content: ["The Expenses module supports two main categories:"],
        steps: [
          "Beat Allowances – Automatic daily and travel allowances based on your beat assignment",
          "Additional Expenses – Manual expense entries for items like meals, parking, materials, etc.",
        ],
      },
      {
        title: "Submitting Additional Expenses",
        content: ["To submit a non-beat expense:"],
        steps: [
          "Go to Expenses from the navigation menu",
          "Tap 'Add Expense' or the '+' button",
          "Select the expense category (Travel, Food, Lodging, Miscellaneous)",
          "Enter the amount",
          "Add a description (optional)",
          "Upload a photo of the bill/receipt",
          "Submit for approval",
        ],
      },
      {
        title: "Bill Upload",
        content: [
          "Uploading bills is recommended for all expenses. Take a clear photo of the receipt immediately after the expense to avoid losing it. The app stores the bill image securely.",
        ],
        tips: [
          "Submit expenses on the same day whenever possible – it's easier to track and approve.",
          "Keep original receipts until the expense is approved and processed.",
        ],
      },
    ],
    nextArticle: { id: "expenses-tracking", title: "Tracking Expense Status" },
  },
  "expenses-tracking": {
    id: "expenses-tracking",
    title: "Tracking Expense Status",
    category: "Expenses",
    readTime: "2 min read",
    lastUpdated: "March 2026",
    summary: "Monitor the approval status of your submitted expenses and view expense history.",
    sections: [
      {
        title: "Expense Statuses",
        content: ["Each submitted expense goes through these stages:"],
        steps: [
          "Pending – Submitted and waiting for manager review",
          "Approved – Manager has approved the expense",
          "Rejected – Manager declined (with reason)",
          "Processed – Expense has been processed for reimbursement",
        ],
      },
      {
        title: "Viewing Expense History",
        content: ["The Expenses page shows your complete expense history:"],
        steps: [
          "View all submitted expenses with status badges",
          "Filter by date, category, or status",
          "See monthly summaries of total expenses",
          "View beat allowance vs additional expenses breakdown",
        ],
        tips: [
          "Regularly check your expense status to follow up on pending items.",
          "If an expense is rejected, read the rejection reason and resubmit if applicable.",
        ],
      },
    ],
    prevArticle: { id: "expenses-submit", title: "Submitting Expenses" },
    nextArticle: { id: "expenses-beat-allowance", title: "Beat Allowances" },
  },
  "expenses-beat-allowance": {
    id: "expenses-beat-allowance",
    title: "Beat Allowances",
    category: "Expenses",
    readTime: "2 min read",
    lastUpdated: "March 2026",
    summary: "Understand how beat-based daily and travel allowances are automatically calculated.",
    sections: [
      {
        title: "What Are Beat Allowances?",
        content: [
          "Beat allowances are pre-configured amounts assigned to each beat. When you work on a particular beat, the corresponding allowances are automatically applied to your expense account.",
          "There are two types of beat allowances:",
        ],
        steps: [
          "Daily Allowance (DA) – A fixed daily amount for the beat",
          "Travel Allowance (TA) – An amount based on the estimated travel distance for the beat",
        ],
      },
      {
        title: "How Allowances Are Calculated",
        content: [
          "Beat allowances are set by the admin based on factors like distance, average travel time, and cost of living for the beat area. They are automatically credited when you mark attendance and are assigned to a beat for the day.",
        ],
      },
      {
        title: "Viewing Your Allowances",
        content: [],
        steps: [
          "Go to Expenses from the navigation menu",
          "View 'Beat Allowances' section",
          "See DA and TA for each beat",
          "View monthly totals of beat-based allowances",
        ],
        tips: [
          "If you work on multiple beats in a day, the allowance for the primary beat is typically applied.",
          "Discuss any discrepancies in beat allowances with your manager.",
        ],
      },
    ],
    prevArticle: { id: "expenses-tracking", title: "Tracking Expense Status" },
  },

  // ===================== BRANDING & MERCHANDISING =====================
  "branding-requests": {
    id: "branding-requests",
    title: "Creating Branding Requests",
    category: "Branding & Merchandising",
    readTime: "3 min read",
    lastUpdated: "March 2026",
    summary: "How to create and submit branding requests for retailer locations during your visits.",
    sections: [
      {
        title: "What Are Branding Requests?",
        icon: <Star className="w-4 h-4" />,
        content: [
          "Branding requests let you initiate outdoor branding or merchandising activities at retailer locations. This includes wall paintings, flex boards, banners, product displays, and other in-store or outdoor branding elements.",
        ],
      },
      {
        title: "Creating a Request",
        content: ["To create a branding request during a visit:"],
        steps: [
          "Check in to the retailer",
          "Tap 'Branding Request' from the visit options",
          "Enter the branding title and description",
          "Select the asset types needed (wall paint, flex, board, etc.)",
          "Measure the wall or area using the Wall Scanner feature",
          "Take measurement photos for reference",
          "Submit the request for manager approval",
        ],
      },
      {
        title: "Request Workflow",
        content: ["After submission, the request goes through these stages:"],
        steps: [
          "Submitted – Request created and awaiting manager review",
          "Approved – Manager has approved the branding activity",
          "Vendor Assigned – A vendor is assigned for execution",
          "In Progress – Branding work is being done",
          "Completed – Work is finished and verified",
        ],
        tips: [
          "Clear measurement photos speed up the approval process.",
          "Include the pincode for accurate vendor assignment in the area.",
        ],
      },
    ],
    nextArticle: { id: "branding-wall-scanner", title: "Wall Measurement Scanner" },
  },
  "branding-wall-scanner": {
    id: "branding-wall-scanner",
    title: "Wall Measurement Scanner",
    category: "Branding & Merchandising",
    readTime: "2 min read",
    lastUpdated: "March 2026",
    summary: "Use the built-in scanner to measure wall dimensions for branding installations.",
    sections: [
      {
        title: "Using the Wall Scanner",
        content: [
          "The Wall Measurement Scanner helps you measure wall or board dimensions for branding activities. It provides an easy way to record size specifications for vendor quoting.",
        ],
        steps: [
          "Open a branding request (new or existing)",
          "Tap 'Wall Scanner' or 'Measure' option",
          "Point your camera at the wall or surface",
          "Enter the width and height measurements",
          "Take a reference photo of the wall",
          "The dimensions are saved to the branding request",
        ],
      },
      {
        title: "Measurement Tips",
        content: [],
        tips: [
          "Use a measuring tape for accurate dimensions whenever possible.",
          "Take photos from straight-on for the best reference quality.",
          "Include nearby landmarks in photos to help vendors understand the location.",
          "Record dimensions in feet or meters consistently as per your organization's standard.",
        ],
      },
    ],
    prevArticle: { id: "branding-requests", title: "Creating Branding Requests" },
    nextArticle: { id: "branding-vendor", title: "Vendor Management" },
  },
  "branding-vendor": {
    id: "branding-vendor",
    title: "Vendor Management",
    category: "Branding & Merchandising",
    readTime: "2 min read",
    lastUpdated: "March 2026",
    summary: "How vendors are assigned to branding requests and how to track their progress.",
    sections: [
      {
        title: "Vendor Assignment",
        content: [
          "After a branding request is approved, a vendor is assigned to execute the work. Vendors are typically local contractors who handle wall paintings, flex printing, board installations, etc.",
          "The assignment is done by managers or the procurement team based on the request location and vendor availability.",
        ],
      },
      {
        title: "Tracking Vendor Progress",
        content: ["Once a vendor is assigned, you can track the progress:"],
        steps: [
          "View vendor details and contact information",
          "Check the due date for completion",
          "Monitor the vendor's confirmation status",
          "View vendor budget vs approved budget",
          "See implementation photos uploaded by the vendor",
        ],
      },
      {
        title: "Post-Implementation",
        content: [
          "After the vendor completes the branding work, you may be asked to verify the implementation during your next visit to the retailer. Take verification photos and provide feedback on the quality.",
        ],
        tips: [
          "Rate the vendor after work completion – this helps improve future vendor selection.",
          "Report any issues with the branding quality through the request comments.",
        ],
      },
    ],
    prevArticle: { id: "branding-wall-scanner", title: "Wall Measurement Scanner" },
  },

  // ===================== ADMIN PANEL =====================
  "admin-users": {
    id: "admin-users",
    title: "Managing Users & Roles",
    category: "Admin Panel",
    readTime: "3 min read",
    lastUpdated: "March 2026",
    summary: "How to manage users, assign roles, and set up the organizational hierarchy in the admin panel.",
    sections: [
      {
        title: "User Management Overview",
        icon: <Settings className="w-4 h-4" />,
        content: [
          "The Admin Panel allows administrators to manage all users in the system. You can add new users, edit profiles, assign roles, and manage the reporting hierarchy.",
        ],
      },
      {
        title: "Adding a New User",
        content: [],
        steps: [
          "Go to Admin Panel > User Management",
          "Tap 'Add User'",
          "Enter user details – Name, Email, Phone",
          "Assign a role (Salesperson, Manager, Admin, etc.)",
          "Set the reporting manager",
          "Assign territories and beats",
          "Save the user profile",
        ],
      },
      {
        title: "Role Hierarchy",
        content: ["The system supports a multi-level hierarchy:"],
        steps: [
          "L1 – Top-level management (Directors, VPs)",
          "L2 – Regional/Area managers",
          "L3 – Field sales representatives",
          "Admin – System administrators with full access",
        ],
        tips: [
          "Roles determine what data a user can see and what actions they can perform.",
          "Always set the correct reporting manager – this affects target distribution and approval flows.",
        ],
      },
    ],
    nextArticle: { id: "admin-products", title: "Product Management" },
  },
  "admin-products": {
    id: "admin-products",
    title: "Product Management",
    category: "Admin Panel",
    readTime: "2 min read",
    lastUpdated: "March 2026",
    summary: "How to manage the product catalog including adding products, categories, and pricing.",
    sections: [
      {
        title: "Product Catalog",
        content: [
          "The Product Management section lets admins manage the complete product catalog. Products are organized by categories and can have multiple SKUs with different pack sizes and pricing.",
        ],
      },
      {
        title: "Adding Products",
        content: [],
        steps: [
          "Go to Admin Panel > Product Management",
          "Tap 'Add Product'",
          "Enter product name, SKU code, and description",
          "Assign to a category",
          "Set the base price (MRP and selling price)",
          "Add pack size and unit details",
          "Upload a product image (optional)",
          "Save the product",
        ],
      },
      {
        title: "Managing Categories",
        content: [
          "Categories help organize products for easy browsing during order entry. You can create, edit, and reorder categories to match your product lineup.",
        ],
        tips: [
          "Keep the product catalog updated – outdated products confuse field reps.",
          "Use consistent naming conventions for easy search during order entry.",
        ],
      },
    ],
    prevArticle: { id: "admin-users", title: "Managing Users & Roles" },
    nextArticle: { id: "admin-schemes", title: "Scheme Management" },
  },
  "admin-schemes": {
    id: "admin-schemes",
    title: "Scheme Management",
    category: "Admin Panel",
    readTime: "2 min read",
    lastUpdated: "March 2026",
    summary: "Create and manage promotional schemes that field reps can apply during order entry.",
    sections: [
      {
        title: "Creating Schemes",
        content: ["Admins can create various types of promotional schemes:"],
        steps: [
          "Go to Admin Panel > Scheme Management",
          "Tap 'Add Scheme'",
          "Choose scheme type (Buy X Get Y, Discount, Tiered, etc.)",
          "Set scheme parameters (quantities, percentages, dates)",
          "Assign target scope – All retailers, specific categories, or specific retailers",
          "Set start and end dates",
          "Activate the scheme",
        ],
      },
      {
        title: "AI-Suggested Schemes",
        icon: <Sparkles className="w-4 h-4" />,
        content: [
          "The system can suggest schemes based on sales data analysis. AI analyzes product performance, retailer buying patterns, and seasonal trends to recommend effective promotional strategies.",
          "Admins can review, modify, and approve AI-suggested schemes before they go live.",
        ],
      },
      {
        title: "Managing Active Schemes",
        content: [
          "View all active, upcoming, and expired schemes from the Scheme Management dashboard. You can edit, extend, or deactivate schemes as needed.",
        ],
        tips: [
          "Set clear start/end dates to avoid confusion in the field.",
          "Communicate new schemes to field reps before activation for maximum impact.",
        ],
      },
    ],
    prevArticle: { id: "admin-products", title: "Product Management" },
    nextArticle: { id: "admin-controls", title: "Admin Controls & Settings" },
  },
  "admin-controls": {
    id: "admin-controls",
    title: "Admin Controls & Settings",
    category: "Admin Panel",
    readTime: "2 min read",
    lastUpdated: "March 2026",
    summary: "Configure system-wide settings including GPS policies, approval workflows, and feature toggles.",
    sections: [
      {
        title: "System Configuration",
        icon: <Shield className="w-4 h-4" />,
        content: [
          "Admin Controls let you configure system-wide settings that affect how the app works for all users. These settings are centralized for easy management.",
        ],
      },
      {
        title: "Available Controls",
        content: ["Key settings you can manage:"],
        steps: [
          "GPS Settings – Check-in radius, tracking frequency, accuracy requirements",
          "Attendance Rules – Working hours, overtime rules, auto-checkout timer",
          "Approval Workflows – Configure multi-level approval for leaves, expenses, branding",
          "Feature Toggles – Enable/disable features like face verification, voice orders, AI features",
          "Notification Settings – Configure push notifications and alert preferences",
          "Data Retention – Set data archival and cleanup policies",
        ],
      },
      {
        title: "Approval Configuration",
        content: [
          "The approval system supports multi-level workflows. You can configure how many approval levels are needed for different entity types (leaves, expenses, branding requests), who approves at each level, and whether levels can be skipped.",
        ],
        tips: [
          "Test configuration changes in a controlled setting before rolling out to all users.",
          "Document any changes to admin controls for team reference.",
        ],
      },
    ],
    prevArticle: { id: "admin-schemes", title: "Scheme Management" },
  },
};
