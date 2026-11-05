 import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
 
 const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
 };
 
 interface PincodeRecord {
   officename: string;
   territory_po: string | null;
   pincode: string;
   district: string | null;
   statename: string | null;
   latitude: number | null;
   longitude: number | null;
 }
 
 const parseCoordinate = (val: string | number | null | undefined): number | null => {
   if (val === null || val === undefined || val === '' || val === 'NA' || val === 'na') {
     return null;
   }
   const parsed = typeof val === 'number' ? val : parseFloat(String(val));
   return isNaN(parsed) ? null : parsed;
 };
 
 Deno.serve(async (req) => {
   // Handle CORS preflight requests
   if (req.method === 'OPTIONS') {
     return new Response('ok', { headers: corsHeaders });
   }
 
   try {
     const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
     const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
     const supabase = createClient(supabaseUrl, supabaseServiceKey);
 
     // Get authorization header to verify user
     const authHeader = req.headers.get('Authorization');
     if (!authHeader) {
       return new Response(
         JSON.stringify({ error: 'Missing authorization header' }),
         { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     // Verify user is admin
     const token = authHeader.replace('Bearer ', '');
     const { data: userData, error: userError } = await supabase.auth.getUser(token);
     if (userError || !userData.user) {
       return new Response(
         JSON.stringify({ error: 'Invalid authorization' }),
         { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     // Check permission via profile_object_permissions
     const { data: profileData } = await supabase
       .from('user_profiles')
       .select('profile_id')
       .eq('user_id', userData.user.id)
       .single();
 
     let hasPermission = false;
     if (profileData?.profile_id) {
       const { data: perms } = await supabase
         .from('profile_object_permissions')
         .select('can_create')
         .eq('profile_id', profileData.profile_id)
         .eq('object_name', 'admin_territory_pincode')
         .eq('can_create', true)
         .limit(1);
       hasPermission = (perms && perms.length > 0) || false;
     }
 
     if (!hasPermission) {
       return new Response(
         JSON.stringify({ error: 'You do not have permission to import pincodes' }),
         { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     const { records, clearExisting } = await req.json();
 
     if (!records || !Array.isArray(records)) {
       return new Response(
         JSON.stringify({ error: 'Invalid records data' }),
         { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     console.log(`Processing ${records.length} pincode records...`);
 
     // Clear existing data if requested (first batch)
     if (clearExisting) {
       console.log('Clearing existing pincode_master data...');
       const { error: deleteError } = await supabase
         .from('pincode_master')
         .delete()
         .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
       
       if (deleteError) {
         console.error('Error clearing existing data:', deleteError);
         return new Response(
           JSON.stringify({ error: `Failed to clear existing data: ${deleteError.message}` }),
           { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
         );
       }
     }
 
     // Transform and validate records
     const transformedRecords: PincodeRecord[] = records.map((row: Record<string, unknown>) => ({
       officename: String(row.officename || row.Officename || '').trim(),
       territory_po: row.Territory_PO || row.territory_po ? String(row.Territory_PO || row.territory_po).trim() : null,
       pincode: String(row.pincode || row.Pincode || '').trim(),
       district: row.district || row.District ? String(row.district || row.District).trim() : null,
       statename: row.statename || row.Statename || row.State ? String(row.statename || row.Statename || row.State).trim() : null,
       latitude: parseCoordinate(row.latitude as string | number | null),
       longitude: parseCoordinate(row.longitude as string | number | null),
     }));
 
     // Filter out invalid records (must have officename and pincode)
     const validRecords = transformedRecords.filter(r => r.officename && r.pincode);
 
     if (validRecords.length === 0) {
       return new Response(
         JSON.stringify({ error: 'No valid records to insert', processed: 0 }),
         { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     // Batch insert for performance (500 at a time)
     const BATCH_SIZE = 500;
     let insertedCount = 0;
     const errors: string[] = [];
 
     for (let i = 0; i < validRecords.length; i += BATCH_SIZE) {
       const batch = validRecords.slice(i, i + BATCH_SIZE);
       const { error: insertError } = await supabase
         .from('pincode_master')
         .insert(batch);
 
       if (insertError) {
         console.error(`Batch ${i / BATCH_SIZE + 1} error:`, insertError);
         errors.push(`Batch ${i / BATCH_SIZE + 1}: ${insertError.message}`);
       } else {
         insertedCount += batch.length;
       }
     }
 
     console.log(`Successfully inserted ${insertedCount} of ${validRecords.length} records`);
 
     return new Response(
       JSON.stringify({
         success: true,
         processed: validRecords.length,
         inserted: insertedCount,
         skipped: records.length - validRecords.length,
         errors: errors.length > 0 ? errors : undefined,
       }),
       { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
 
   } catch (error) {
     console.error('Error processing pincode import:', error);
     return new Response(
       JSON.stringify({ error: error.message || 'Internal server error' }),
       { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
   }
 });