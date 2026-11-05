import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export async function seedLoyaltyData() {
  try {
    // Get a territory and retailers
    const { data: territories } = await supabase
      .from("territories")
      .select("id")
      .limit(1)
      .single();

    if (!territories) {
      throw new Error("No territories found");
    }

    const { data: retailers } = await supabase
      .from("retailers")
      .select("id, user_id, name")
      .eq("territory_id", territories.id)
      .limit(2);

    if (!retailers || retailers.length === 0) {
      throw new Error("No retailers found");
    }

    // Create loyalty program
    const { data: program, error: programError } = await supabase
      .from("retailer_loyalty_programs")
      .insert({
        program_name: "Diwali Dhamaka 2025",
        description: "Special loyalty program - earn points on every order!",
        start_date: "2025-01-01",
        end_date: "2025-12-31",
        territories: [territories.id],
        is_all_territories: false,
        points_to_rupee_conversion: 0.10,
        is_active: true,
      })
      .select()
      .single();

    if (programError) throw programError;

    console.log("✅ Created program:", program.program_name);

    // Create loyalty actions
    const actions = [
      {
        program_id: program.id,
        action_type: "first_order",
        action_name: "First Order Bonus",
        points: 100,
        is_enabled: true,
        metadata: {},
      },
      {
        program_id: program.id,
        action_type: "order_frequency",
        action_name: "Order Frequency Reward",
        points: 20,
        is_enabled: true,
        metadata: { frequency_days: 7 },
      },
      {
        program_id: program.id,
        action_type: "order_value_tiers",
        action_name: "Order Value Tiers",
        points: 0,
        is_enabled: true,
        metadata: {
          tiers: [
            { name: "Bronze", min_value: 5000, points: 20 },
            { name: "Silver", min_value: 10000, points: 50 },
            { name: "Gold", min_value: 25000, points: 150 },
          ],
        },
      },
      {
        program_id: program.id,
        action_type: "new_product_trial",
        action_name: "New Product Trial",
        points: 25,
        is_enabled: true,
        metadata: {},
      },
      {
        program_id: program.id,
        action_type: "bulk_order",
        action_name: "Bulk Order Bonus",
        points: 30,
        is_enabled: true,
        metadata: { min_quantity: 50 },
      },
    ];

    const { error: actionsError } = await supabase
      .from("retailer_loyalty_actions")
      .insert(actions);

    if (actionsError) throw actionsError;

    console.log("✅ Created 5 loyalty actions");

    // Get products for creating orders
    const { data: products } = await supabase
      .from("products")
      .select("id, name, rate, unit")
      .limit(3);

    if (!products || products.length === 0) {
      throw new Error("No products found");
    }

    // Create sample orders and visits for today
    for (const retailer of retailers) {
      // Create visit
      const { data: visit, error: visitError } = await supabase
        .from("visits")
        .insert({
          retailer_id: retailer.id,
          planned_date: new Date().toISOString().split("T")[0],
          status: "completed",
          check_in_time: new Date().toISOString(),
          check_out_time: new Date().toISOString(),
        } as any)
        .select()
        .single();

      if (visitError) throw visitError;

      // Update visit with user_id
      await supabase
        .from("visits")
        .update({ user_id: retailer.user_id } as any)
        .eq("id", visit.id);

      // Create order
      const orderValue = Math.floor(Math.random() * 20000) + 5000; // Random between 5000-25000
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          retailer_id: retailer.id,
          visit_id: visit.id,
          order_date: new Date().toISOString().split("T")[0],
          total_amount: orderValue,
          payment_status: "pending",
        } as any)
        .select()
        .single();

      if (orderError) throw orderError;

      // Update order with user_id
      await supabase
        .from("orders")
        .update({ user_id: retailer.user_id } as any)
        .eq("id", order.id);

      // Create order items
      const orderItems = products.map((product) => ({
        order_id: order.id,
        product_id: product.id.toString(),
        product_name: product.name,
        category: "General",
        unit: product.unit || "Piece",
        quantity: Math.floor(Math.random() * 20) + 5,
        rate: product.rate || 100,
        total: (product.rate || 100) * (Math.floor(Math.random() * 20) + 5),
      }));

      await supabase.from("order_items").insert(orderItems);

      // Award loyalty points
      const { data: firstOrderCheck } = await supabase
        .from("orders")
        .select("id")
        .eq("retailer_id", retailer.id)
        .limit(2);

      const isFirstOrder = firstOrderCheck && firstOrderCheck.length === 1;

      // Simulate point awarding
      const pointsAwarded = [];

      if (isFirstOrder) {
        pointsAwarded.push({
          program_id: program.id,
          retailer_id: retailer.id,
          action_id: actions[0].program_id, // Using program_id as placeholder
          points: 100,
          reference_type: "order",
          reference_id: order.id,
          awarded_by_user_id: retailer.user_id,
          metadata: { reason: "First Order Bonus" },
        });
      }

      // Order value tier points
      if (orderValue >= 10000) {
        pointsAwarded.push({
          program_id: program.id,
          retailer_id: retailer.id,
          action_id: actions[2].program_id,
          points: orderValue >= 25000 ? 150 : 50,
          reference_type: "order",
          reference_id: order.id,
          awarded_by_user_id: retailer.user_id,
          metadata: {
            reason: orderValue >= 25000 ? "Gold Tier" : "Silver Tier",
            order_value: orderValue,
          },
        });
      } else if (orderValue >= 5000) {
        pointsAwarded.push({
          program_id: program.id,
          retailer_id: retailer.id,
          action_id: actions[2].program_id,
          points: 20,
          reference_type: "order",
          reference_id: order.id,
          awarded_by_user_id: retailer.user_id,
          metadata: { reason: "Bronze Tier", order_value: orderValue },
        });
      }

      // New product trial (simulate)
      pointsAwarded.push({
        program_id: program.id,
        retailer_id: retailer.id,
        action_id: actions[3].program_id,
        points: 25,
        reference_type: "order",
        reference_id: order.id,
        awarded_by_user_id: retailer.user_id,
        metadata: { reason: "New Product Trial", product_count: 1 },
      });

      if (pointsAwarded.length > 0) {
        await supabase.from("retailer_loyalty_points").insert(pointsAwarded);
      }

      // Initialize tracking
      await supabase.from("retailer_loyalty_tracking").upsert({
        retailer_id: retailer.id,
        last_order_date: new Date().toISOString().split("T")[0],
        consecutive_order_count: 1,
        total_orders_count: firstOrderCheck?.length || 1,
        new_products_tried: orderItems.map((item) => item.product_id),
      });

      console.log(
        `✅ Created visit, order (₹${orderValue}), and awarded ${pointsAwarded.reduce((sum, p) => sum + p.points, 0)} points to ${retailer.name}`
      );
    }

    toast({
      title: "Sample Data Created Successfully!",
      description: `Created program, actions, ${retailers.length} visits/orders with points awarded`,
    });

    return { success: true, program, retailersCount: retailers.length };
  } catch (error) {
    console.error("Error seeding loyalty data:", error);
    toast({
      title: "Error Creating Sample Data",
      description: error instanceof Error ? error.message : "Unknown error",
      variant: "destructive",
    });
    return { success: false, error };
  }
}
