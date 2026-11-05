// Query classification for AI assistant routing

export type QueryCategory = 
  | 'data_fetch'      // Needs database lookup
  | 'navigation'      // How to do something in app
  | 'general_help'    // General questions
  | 'quick_info'      // Simple cached responses
  | 'analytics'       // Complex analysis

export interface ClassifiedQuery {
  category: QueryCategory;
  subcategory: string;
  confidence: number;
  suggestedTool?: string;
}

const QUERY_PATTERNS: Record<QueryCategory, { patterns: RegExp[]; subcategories: Record<string, RegExp[]> }> = {
  data_fetch: {
    patterns: [
      /my visits|today'?s? visits|scheduled visits/i,
      /sales|orders|revenue|collection/i,
      /retailers?|customers?/i,
      /stock|inventory|products?/i,
      /payments?|pending|outstanding|overdue/i,
      /attendance|check.?in|check.?out/i,
      /beat|route|plan/i,
    ],
    subcategories: {
      visits: [/visits?|schedule|today|plan/i],
      sales: [/sales|orders?|revenue|performance/i],
      retailers: [/retailers?|customers?|shops?/i],
      inventory: [/stock|inventory|products?|items?/i],
      payments: [/payments?|pending|outstanding|dues?|collect/i],
      attendance: [/attendance|check.?in|check.?out|hours?/i],
    }
  },
  navigation: {
    patterns: [
      /how (do|can|to)|where (is|can|do)/i,
      /show me how|guide|steps?|process/i,
      /navigate|go to|find|access/i,
      /add|create|new|edit|update|delete/i,
    ],
    subcategories: {
      add_retailer: [/add.*(retailer|customer|shop)/i],
      add_visit: [/add.*(visit|schedule)/i],
      add_order: [/add.*(order|sale)/i],
      view_reports: [/view.*(report|analytics|dashboard)/i],
      settings: [/settings?|config|profile/i],
    }
  },
  general_help: {
    patterns: [
      /what (is|are|does)|explain|help|support/i,
      /can you|could you|please/i,
      /tell me about|describe/i,
    ],
    subcategories: {
      app_features: [/feature|capability|function/i],
      troubleshoot: [/problem|issue|error|not working/i],
      general: [/.*/i],
    }
  },
  quick_info: {
    patterns: [
      /^(hi|hello|hey|thanks|thank you|ok|okay)$/i,
      /good (morning|afternoon|evening)/i,
    ],
    subcategories: {
      greeting: [/hi|hello|hey|morning|afternoon|evening/i],
      acknowledgment: [/thanks|thank|ok|okay|got it/i],
    }
  },
  analytics: {
    patterns: [
      /compare|trend|growth|analysis|analyze/i,
      /month over month|year over year|vs|versus/i,
      /top performing|best|worst|lowest|highest/i,
      /percentage|ratio|rate/i,
    ],
    subcategories: {
      comparison: [/compare|vs|versus/i],
      trends: [/trend|growth|decline|pattern/i],
      rankings: [/top|best|worst|ranking/i],
    }
  }
};

export function classifyQuery(query: string): ClassifiedQuery {
  const normalizedQuery = query.toLowerCase().trim();
  
  // Check each category
  for (const [category, config] of Object.entries(QUERY_PATTERNS)) {
    for (const pattern of config.patterns) {
      if (pattern.test(normalizedQuery)) {
        // Find subcategory
        let subcategory = 'general';
        for (const [subcat, subPatterns] of Object.entries(config.subcategories)) {
          if (subPatterns.some(p => p.test(normalizedQuery))) {
            subcategory = subcat;
            break;
          }
        }
        
        // Map to suggested tool
        const suggestedTool = getSuggestedTool(category as QueryCategory, subcategory);
        
        return {
          category: category as QueryCategory,
          subcategory,
          confidence: 0.8,
          suggestedTool
        };
      }
    }
  }
  
  // Default to general help
  return {
    category: 'general_help',
    subcategory: 'general',
    confidence: 0.5
  };
}

function getSuggestedTool(category: QueryCategory, subcategory: string): string | undefined {
  const toolMap: Record<string, string> = {
    'data_fetch:visits': 'get_visit_summary',
    'data_fetch:sales': 'get_sales_report',
    'data_fetch:retailers': 'get_retailer_analytics',
    'data_fetch:inventory': 'get_inventory_status',
    'data_fetch:payments': 'get_pending_collections',
    'data_fetch:attendance': 'get_attendance',
    'analytics:comparison': 'get_sales_comparison',
    'analytics:trends': 'get_performance_trends',
    'analytics:rankings': 'get_top_performers',
  };
  
  return toolMap[`${category}:${subcategory}`];
}

// Navigation hints for common tasks
export const NAVIGATION_HINTS: Record<string, { path: string; steps: string[] }> = {
  add_retailer: {
    path: '/add-retailer',
    steps: [
      'Go to My Retailers from the menu',
      'Click the + Add Retailer button',
      'Fill in retailer details (name, phone, address)',
      'Save the retailer'
    ]
  },
  add_visit: {
    path: '/visits',
    steps: [
      'Go to My Visits from the menu',
      'Click Plan Visit or use Beat Planning',
      'Select retailers to visit',
      'Set the date and save'
    ]
  },
  add_order: {
    path: '/order-entry',
    steps: [
      'Start a visit with a retailer',
      'Click Order Entry',
      'Add products and quantities',
      'Submit the order'
    ]
  },
  view_reports: {
    path: '/analytics',
    steps: [
      'Go to Analytics from the menu',
      'Select the report type',
      'Choose date range',
      'View or export the report'
    ]
  }
};
