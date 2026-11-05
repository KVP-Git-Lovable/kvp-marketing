
UPDATE public.beats
   SET owner_id   = '73044cad-2c19-4a47-89f1-6a755adc3362',
       owner_name = 'Mokshith'
 WHERE created_by = 'd6d364d5-6f19-4da9-bb48-67b04a8065fa'
   AND user_id = '73044cad-2c19-4a47-89f1-6a755adc3362'
   AND (owner_id IS NULL OR owner_name IS NULL);
