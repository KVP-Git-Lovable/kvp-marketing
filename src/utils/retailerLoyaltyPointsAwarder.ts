import { supabase } from "@/integrations/supabase/client";

interface OrderContext {
  orderId: string;
  retailerId: string;
  orderValue: number;
  orderItems: Array<{ product_id: string; quantity: number }>;
  isFirstOrder: boolean;
  fseUserId: string;
  orderDate: Date;
}

interface PaymentContext {
  retailerId: string;
  orderId: string;
  paymentDate: Date;
  dueDate: Date;
  fseUserId: string;
}

export async function awardLoyaltyPointsForOrder(context: OrderContext) {
  try {
    console.log("🎁 Starting loyalty points calculation for order:", context.orderId);
    console.log("📦 Order value:", context.orderValue, "Retailer:", context.retailerId);

    // Get retailer's territory
    const { data: retailer } = await supabase
      .from("retailers")
      .select("territory_id")
      .eq("id", context.retailerId)
      .single();

    const territoryId = retailer?.territory_id;
    console.log("🗺️ Retailer territory:", territoryId || "No territory assigned");

    // Get active programs - include programs that apply to all territories OR specific territory
    const orderDateStr = context.orderDate.toISOString().split("T")[0];
    
    let query = supabase
      .from("retailer_loyalty_programs")
      .select("*")
      .eq("is_active", true)
      .lte("start_date", orderDateStr)
      .gte("end_date", orderDateStr);
    
    // If retailer has a territory, get programs for that territory OR all territories
    // If no territory, get programs that apply to all territories
    if (territoryId) {
      query = query.or(`is_all_territories.eq.true,territories.cs.{${territoryId}}`);
    } else {
      query = query.eq("is_all_territories", true);
    }

    const { data: programs, error: programError } = await query;

    if (programError) {
      console.error("❌ Error fetching loyalty programs:", programError);
      return;
    }

    if (!programs || programs.length === 0) {
      console.log("⚠️ No active loyalty programs found for this retailer");
      return;
    }

    console.log("✅ Found", programs.length, "active loyalty programs:", programs.map(p => p.program_name));

    // Get or create tracking record
    let { data: tracking } = await supabase
      .from("retailer_loyalty_tracking")
      .select("*")
      .eq("retailer_id", context.retailerId)
      .single();

    if (!tracking) {
      const { data: newTracking } = await supabase
        .from("retailer_loyalty_tracking")
        .insert({
          retailer_id: context.retailerId,
          total_orders_count: 0,
          consecutive_order_count: 0,
          new_products_tried: [],
        })
        .select()
        .single();
      tracking = newTracking;
    }

    for (const program of programs) {
      console.log("📋 Processing program:", program.program_name);
      
      // Get all enabled actions for this program
      const { data: actions, error: actionsError } = await supabase
        .from("retailer_loyalty_actions")
        .select("*")
        .eq("program_id", program.id)
        .eq("is_enabled", true);

      if (actionsError) {
        console.error("❌ Error fetching actions:", actionsError);
        continue;
      }

      if (!actions || actions.length === 0) {
        console.log("⚠️ No enabled actions for program:", program.program_name);
        continue;
      }
      
      console.log("🎯 Found", actions.length, "enabled actions:", actions.map(a => `${a.action_name} (${a.action_type})`))

      for (const action of actions) {
        let shouldAward = false;
        let pointsToAward = action.points;
        let metadata: any = {};

        console.log(`🔍 Checking action: ${action.action_name} (${action.action_type})`);
        console.log("   target_config:", JSON.stringify(action.target_config));
        console.log("   metadata:", JSON.stringify(action.metadata));

        switch (action.action_type) {
          case "first_order":
            shouldAward = context.isFirstOrder;
            metadata = { order_number: 1 };
            console.log(`   first_order check: isFirstOrder=${context.isFirstOrder}, shouldAward=${shouldAward}`);
            break;

          case "order_frequency":
            // Check if order is within X days of last order
            const metadata1 = action.metadata as any;
            const frequencyDays = metadata1?.frequency_days || 7;
            if (tracking?.last_order_date) {
              const daysSinceLastOrder = Math.floor(
                (context.orderDate.getTime() - new Date(tracking.last_order_date).getTime()) /
                  (1000 * 60 * 60 * 24)
              );
              shouldAward = daysSinceLastOrder <= frequencyDays;
              metadata = { days_since_last_order: daysSinceLastOrder };
            }
            break;

          case "order_value_tiers":
            // Check order value against tiers in metadata OR simple min/max in target_config
            const metadata2 = action.metadata as any;
            const targetConfig = action.target_config as any;
            const tiers = metadata2?.tiers || [];
            
            console.log(`   order_value_tiers check: orderValue=${context.orderValue}, tiers=${tiers.length}, targetConfig=`, targetConfig);
            
            // Check tiered structure first
            if (tiers.length > 0) {
              for (const tier of tiers) {
                if (context.orderValue >= tier.min_value) {
                  shouldAward = true;
                  pointsToAward = tier.points;
                  metadata = { tier_name: tier.name, order_value: context.orderValue };
                  console.log(`   Matched tier: ${tier.name}, points=${tier.points}`);
                }
              }
            } 
            // Check simple min/max in target_config (e.g., "Value > Rs. 500")
            else if (targetConfig?.min_value !== undefined) {
              const minValue = Number(targetConfig.min_value);
              const maxValue = targetConfig.max_value !== undefined ? Number(targetConfig.max_value) : Infinity;
              console.log(`   Checking range: ${minValue} <= ${context.orderValue} <= ${maxValue}`);
              if (context.orderValue >= minValue && (maxValue === Infinity || context.orderValue <= maxValue)) {
                shouldAward = true;
                pointsToAward = action.points;
                metadata = { 
                  min_value: minValue, 
                  max_value: maxValue !== Infinity ? maxValue : undefined,
                  order_value: context.orderValue 
                };
                console.log(`   ✅ Matched! Awarding ${pointsToAward} points`);
              }
            }
            break;

          case "consecutive_orders":
            // Award on completing streak
            const metadata3 = action.metadata as any;
            const requiredStreak = metadata3?.consecutive_orders_required || 5;
            const currentStreak = (tracking?.consecutive_order_count || 0) + 1;
            shouldAward = currentStreak === requiredStreak;
            metadata = { streak_count: currentStreak };
            break;

          case "new_product_trial":
            // Check if any product in order is new for this retailer
            const triedProducts = tracking?.new_products_tried || [];
            const newProducts = context.orderItems.filter(
              (item) => !triedProducts.includes(item.product_id)
            );
            if (newProducts.length > 0) {
              shouldAward = true;
              pointsToAward = action.points * newProducts.length;
              metadata = {
                new_products_count: newProducts.length,
                product_ids: newProducts.map((p) => p.product_id),
              };
            }
            break;

          case "bulk_order":
            // Check total quantity
            const totalQuantity = context.orderItems.reduce(
              (sum, item) => sum + item.quantity,
              0
            );
            const metadata4 = action.metadata as any;
            const minQuantity = metadata4?.min_quantity || 100;
            shouldAward = totalQuantity >= minQuantity;
            metadata = { total_quantity: totalQuantity };
            break;

          case "monthly_volume":
            // This will be checked separately in a monthly job
            break;
        }

        console.log(`   Result: shouldAward=${shouldAward}, points=${pointsToAward}`);

        if (shouldAward) {
          // Insert loyalty points
          const { data: insertedPoints, error } = await supabase.from("retailer_loyalty_points").insert({
            program_id: program.id,
            retailer_id: context.retailerId,
            action_id: action.id,
            points: pointsToAward,
            reference_type: "order",
            reference_id: context.orderId,
            awarded_by_user_id: context.fseUserId,
            metadata,
          }).select();

          if (error) {
            console.error("❌ Error awarding loyalty points:", error);
          } else {
            console.log(
              `✅ Awarded ${pointsToAward} points for ${action.action_name}`, insertedPoints
            );
          }
        }
      }
    }

    // Update tracking
    const consecutiveCount = calculateConsecutiveOrders(
      tracking?.last_order_date,
      context.orderDate
    );

    const newProductsTried = [
      ...(tracking?.new_products_tried || []),
      ...context.orderItems.map((item) => item.product_id),
    ];

    await supabase
      .from("retailer_loyalty_tracking")
      .update({
        last_order_date: context.orderDate.toISOString().split("T")[0],
        consecutive_order_count: consecutiveCount,
        total_orders_count: (tracking?.total_orders_count || 0) + 1,
        last_points_earned_date: context.orderDate.toISOString().split("T")[0],
        new_products_tried: [...new Set(newProductsTried)],
      })
      .eq("retailer_id", context.retailerId);

    console.log("🎉 Loyalty points calculation completed");
  } catch (error) {
    console.error("❌ Error in loyalty points calculation:", error);
  }
}

export async function awardLoyaltyPointsForPayment(context: PaymentContext) {
  try {
    // Get retailer's territory
    const { data: retailer } = await supabase
      .from("retailers")
      .select("territory_id")
      .eq("id", context.retailerId)
      .single();

    if (!retailer?.territory_id) return;

    // Get active programs
    const { data: programs } = await supabase
      .from("retailer_loyalty_programs")
      .select("*")
      .eq("is_active", true)
      .lte("start_date", context.paymentDate.toISOString().split("T")[0])
      .gte("end_date", context.paymentDate.toISOString().split("T")[0])
      .or(`territories.cs.{${retailer.territory_id}},is_all_territories.eq.true`);

    if (!programs || programs.length === 0) return;

    for (const program of programs) {
      // Get timely payment action
      const { data: actions } = await supabase
        .from("retailer_loyalty_actions")
        .select("*")
        .eq("program_id", program.id)
        .eq("action_type", "timely_payment")
        .eq("is_enabled", true);

      if (!actions || actions.length === 0) continue;

      for (const action of actions) {
        // Check if payment is on time
        const isOnTime = context.paymentDate <= context.dueDate;

        if (isOnTime) {
          await supabase.from("retailer_loyalty_points").insert({
            program_id: program.id,
            retailer_id: context.retailerId,
            action_id: action.id,
            points: action.points,
            reference_type: "payment",
            reference_id: context.orderId,
            awarded_by_user_id: context.fseUserId,
            metadata: {
              payment_date: context.paymentDate.toISOString(),
              due_date: context.dueDate.toISOString(),
            },
          });

          console.log(`✅ Awarded ${action.points} points for timely payment`);
        }
      }
    }
  } catch (error) {
    console.error("❌ Error awarding payment loyalty points:", error);
  }
}

function calculateConsecutiveOrders(
  lastOrderDate: string | null,
  currentOrderDate: Date
): number {
  if (!lastOrderDate) return 1;

  const daysSinceLastOrder = Math.floor(
    (currentOrderDate.getTime() - new Date(lastOrderDate).getTime()) /
      (1000 * 60 * 60 * 24)
  );

  // If within 10 days, count as consecutive, otherwise reset to 1
  return daysSinceLastOrder <= 10 ? 1 : 1;
}
