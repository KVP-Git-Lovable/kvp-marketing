import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

interface AnalysisContext {
  products: any[];
  retailersByCategory: any[];
  territories: any[];
  beats: any[];
  salespersons: any[];
  monthlyTrends: any[];
  activeSchemes: any[];
  productCategories: any[];
}

interface SchemeSuggestion {
  suggested_name: string;
  suggested_description: string;
  suggested_scheme_type: string;
  suggested_discount_percentage: number;
  suggested_discount_amount: number;
  suggested_buy_quantity: number;
  suggested_free_quantity: number;
  suggested_condition_quantity: number;
  suggested_min_order_value: number;
  suggested_start_date: string;
  suggested_end_date: string;
  suggested_product_id?: string;
  suggested_category_id?: string;
  analysis_type: string;
  target_type: string;
  target_ids: string[];
  target_names: string[];
  reasoning: string;
  data_signals: any;
  confidence_score: number;
  expected_benefit: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check if Lovable API key is configured
    if (!lovableApiKey) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(JSON.stringify({ 
        error: 'Lovable AI not configured. LOVABLE_API_KEY should be auto-provisioned.' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { mode = 'analyze' } = await req.json();

    if (mode === 'analyze') {
      console.log('Starting AI scheme analysis...');
      
      // Gather analysis context with timeout handling
      let context: AnalysisContext;
      try {
        console.log('Gathering context...');
        context = await gatherAnalysisContext(supabase);
        console.log('Context gathered:', {
          products: context.products.length,
          retailers: context.retailersByCategory.length,
          territories: context.territories.length,
          beats: context.beats.length
        });
      } catch (contextError) {
        console.error('Error gathering context:', contextError);
        return new Response(JSON.stringify({ 
          error: 'Failed to gather business data',
          details: contextError.message 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Generate suggestions using AI with timeout
      let suggestions: SchemeSuggestion[] = [];
      try {
        console.log('Calling Lovable AI...');
        suggestions = await generateSchemeSuggestions(context, lovableApiKey!);
        console.log('Generated suggestions:', suggestions.length);
      } catch (aiError) {
        console.error('AI generation error:', aiError);
        return new Response(JSON.stringify({ 
          error: 'Failed to generate AI suggestions',
          details: aiError.message 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Store suggestions in database
      if (suggestions.length > 0) {
        const { error } = await supabase
          .from('ai_scheme_suggestions')
          .insert(suggestions.map(s => ({
            ...s,
            status: 'pending',
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          })));

        if (error) {
          console.error('Error storing suggestions:', error);
          return new Response(JSON.stringify({ 
            error: 'Failed to store suggestions',
            details: error.message 
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      return new Response(JSON.stringify({
        success: true,
        suggestions_generated: suggestions.length,
        suggestions
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid mode' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('AI Scheme Engine error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function gatherAnalysisContext(supabase: any): Promise<AnalysisContext> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Run queries in parallel for faster execution
  const [
    productsResult,
    recentOrderItemsResult,
    previousOrderItemsResult,
    retailersResult,
    territoriesResult,
    beatsResult,
    employeesResult,
    activeSchemesResult,
    productCategoriesResult,
    monthlyOrdersResult
  ] = await Promise.all([
    // Get products
    supabase
      .from('products')
      .select('id, name, sku, category_id, rate, is_active')
      .eq('is_active', true)
      .limit(50),
    
    // Get recent order items (last 30 days)
    supabase
      .from('order_items')
      .select('product_id, quantity, orders!inner(order_date, status)')
      .gte('orders.order_date', thirtyDaysAgo)
      .in('orders.status', ['confirmed', 'delivered'])
      .limit(300),
    
    // Get previous order items (30-60 days ago)
    supabase
      .from('order_items')
      .select('product_id, quantity, orders!inner(order_date, status)')
      .gte('orders.order_date', sixtyDaysAgo)
      .lt('orders.order_date', thirtyDaysAgo)
      .in('orders.status', ['confirmed', 'delivered'])
      .limit(300),
    
    // Get retailers
    supabase
      .from('retailers')
      .select('id, shop_name, category, potential, last_order_date, last_order_value, beat_id, territory_id')
      .limit(100),
    
    // Get territories
    supabase
      .from('territories')
      .select('id, name')
      .limit(20),
    
    // Get beats
    supabase
      .from('beats')
      .select('id, beat_name, territory_id')
      .limit(50),
    
    // Get employees
    supabase
      .from('employees')
      .select('id, user_id, employee_code')
      .limit(20),
    
    // Get active schemes
    supabase
      .from('product_schemes')
      .select('id, name, scheme_type, is_active')
      .eq('is_active', true)
      .limit(20),
    
    // Get product categories
    supabase
      .from('product_categories')
      .select('id, name')
      .limit(20),
    
    // Get monthly orders
    supabase
      .from('orders')
      .select('total_amount, order_date')
      .gte('order_date', sixtyDaysAgo)
      .in('status', ['confirmed', 'delivered'])
      .limit(200)
  ]);

  const products = productsResult.data || [];
  const recentOrderItems = recentOrderItemsResult.data || [];
  const previousOrderItems = previousOrderItemsResult.data || [];
  const retailers = retailersResult.data || [];
  const territories = territoriesResult.data || [];
  const beats = beatsResult.data || [];
  const employees = employeesResult.data || [];
  const activeSchemes = activeSchemesResult.data || [];
  const productCategories = productCategoriesResult.data || [];
  const monthlyOrders = monthlyOrdersResult.data || [];

  // Aggregate product order counts
  const recentProductCounts = new Map<string, number>();
  recentOrderItems.forEach((item: any) => {
    const count = recentProductCounts.get(item.product_id) || 0;
    recentProductCounts.set(item.product_id, count + item.quantity);
  });

  const previousProductCounts = new Map<string, number>();
  previousOrderItems.forEach((item: any) => {
    const count = previousProductCounts.get(item.product_id) || 0;
    previousProductCounts.set(item.product_id, count + item.quantity);
  });

  // Enrich products with trend data
  const enrichedProducts = products.map((p: any) => {
    const recentCount = recentProductCounts.get(p.id) || 0;
    const previousCount = previousProductCounts.get(p.id) || 0;
    const trend = previousCount > 0 ? ((recentCount - previousCount) / previousCount) * 100 : 0;
    return {
      ...p,
      recent_order_count: recentCount,
      previous_order_count: previousCount,
      order_trend_percent: Math.round(trend)
    };
  });

  // Aggregate retailers by category
  const categoryStats = new Map<string, { count: number; total_value: number; order_count: number }>();
  retailers.forEach((r: any) => {
    const cat = r.category || 'Unknown';
    const stats = categoryStats.get(cat) || { count: 0, total_value: 0, order_count: 0 };
    stats.count++;
    if (r.last_order_value) {
      stats.total_value += r.last_order_value;
      stats.order_count++;
    }
    categoryStats.set(cat, stats);
  });

  const retailersByCategory = Array.from(categoryStats.entries()).map(([category, stats]) => ({
    category,
    count: stats.count,
    avg_order_value: stats.order_count > 0 ? Math.round(stats.total_value / stats.order_count) : 0,
    ordering_rate: Math.round((stats.order_count / stats.count) * 100)
  }));

  // Get salesperson profiles if we have employees
  let salespersons: any[] = [];
  if (employees.length > 0) {
    const salespersonIds = employees.map((e: any) => e.user_id).filter(Boolean);
    if (salespersonIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', salespersonIds);

      salespersons = employees.map((e: any) => {
        const profile = (profiles || []).find((p: any) => p.id === e.user_id);
        return {
          id: e.user_id,
          name: profile?.full_name || e.employee_code,
          employee_id: e.id
        };
      });
    }
  }

  // Calculate monthly trends
  const currentMonth = new Date().toISOString().slice(0, 7);
  const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 7);

  const monthlyTrends = [
    { month: lastMonth, revenue: 0 },
    { month: currentMonth, revenue: 0 }
  ];

  monthlyOrders.forEach((order: any) => {
    const orderMonth = order.order_date?.slice(0, 7);
    if (orderMonth === lastMonth) {
      monthlyTrends[0].revenue += order.total_amount || 0;
    } else if (orderMonth === currentMonth) {
      monthlyTrends[1].revenue += order.total_amount || 0;
    }
  });

  return {
    products: enrichedProducts,
    retailersByCategory,
    territories,
    beats,
    salespersons,
    monthlyTrends,
    activeSchemes,
    productCategories
  };
}

async function generateSchemeSuggestions(context: AnalysisContext, apiKey: string): Promise<SchemeSuggestion[]> {
  const systemPrompt = `You are an expert sales promotion strategist. Analyze data and suggest 2-3 targeted promotional schemes.

Available scheme types: percentage_discount, flat_discount, buy_x_get_y_free, bundle_combo, tiered_discount, time_based_offer, first_order_discount, category_wide_discount

Analysis types: slow_moving_products, retailer_category, high_potential_acquisition, territory_boost, seasonal

Output ONLY a valid JSON array. Example:
[{
  "suggested_name": "Summer Sale 15% Off",
  "suggested_description": "Boost slow-moving products",
  "suggested_scheme_type": "percentage_discount",
  "suggested_discount_percentage": 15,
  "suggested_discount_amount": 0,
  "suggested_buy_quantity": 0,
  "suggested_free_quantity": 0,
  "suggested_condition_quantity": 0,
  "suggested_min_order_value": 500,
  "suggested_start_date": "2026-01-07",
  "suggested_end_date": "2026-01-21",
  "analysis_type": "slow_moving_products",
  "target_type": "global",
  "target_ids": [],
  "target_names": [],
  "reasoning": "Products showing declining trends need promotional boost",
  "data_signals": {"declining_products": 5},
  "confidence_score": 0.8,
  "expected_benefit": "10-15% increase in slow product sales"
}]`;

  const userPrompt = `Analyze and generate 2-3 scheme suggestions:

PRODUCTS (top 10):
${JSON.stringify(context.products.slice(0, 10).map(p => ({ name: p.name, trend: p.order_trend_percent })), null, 2)}

RETAILER CATEGORIES:
${JSON.stringify(context.retailersByCategory.slice(0, 5), null, 2)}

TERRITORIES: ${context.territories.slice(0, 5).map((t: any) => t.name).join(', ')}

MONTHLY TRENDS: ${JSON.stringify(context.monthlyTrends)}

ACTIVE SCHEMES: ${context.activeSchemes.length} active

Today: ${new Date().toISOString().split('T')[0]}
Suggest validity of 7-14 days.`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60 second timeout

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 1500,
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      if (response.status === 402) {
        throw new Error('AI credits exhausted. Please add funds to your Lovable workspace.');
      }
      throw new Error(`Lovable AI error: ${response.status} - ${errorText.slice(0, 100)}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '[]';
    
    console.log('AI response received, length:', content.length);

    // Parse JSON response
    let suggestions: SchemeSuggestion[] = [];
    try {
      let cleanedContent = content.trim();
      if (cleanedContent.startsWith('```json')) cleanedContent = cleanedContent.slice(7);
      if (cleanedContent.startsWith('```')) cleanedContent = cleanedContent.slice(3);
      if (cleanedContent.endsWith('```')) cleanedContent = cleanedContent.slice(0, -3);
      
      suggestions = JSON.parse(cleanedContent.trim());
      
      // Validate and sanitize
      suggestions = suggestions.filter(s => 
        s.suggested_name && s.suggested_scheme_type && s.analysis_type && s.target_type
      ).map(s => ({
        ...s,
        suggested_discount_percentage: s.suggested_discount_percentage || 0,
        suggested_discount_amount: s.suggested_discount_amount || 0,
        suggested_buy_quantity: s.suggested_buy_quantity || 0,
        suggested_free_quantity: s.suggested_free_quantity || 0,
        suggested_condition_quantity: s.suggested_condition_quantity || 0,
        suggested_min_order_value: s.suggested_min_order_value || 0,
        confidence_score: Math.min(Math.max(s.confidence_score || 0.75, 0), 1),
        target_ids: s.target_ids || [],
        target_names: s.target_names || [],
        data_signals: s.data_signals || {}
      }));
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError, 'Content:', content.slice(0, 200));
      return [];
    }

    return suggestions;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('Lovable AI request timed out');
      throw new Error('AI request timed out - please try again');
    }
    console.error('Error calling Lovable AI:', error);
    throw error;
  }
}
