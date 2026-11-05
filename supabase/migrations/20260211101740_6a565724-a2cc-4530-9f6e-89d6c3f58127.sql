-- Fix ALL duplicate invoice numbers (including 2025)
DO $$
DECLARE
  dup RECORD;
  ord RECORD;
  skip_first BOOLEAN;
  new_num INTEGER;
  year_val TEXT;
  prefix TEXT;
  new_invoice TEXT;
BEGIN
  -- Process each year's duplicates separately
  FOR year_val IN SELECT DISTINCT substring(invoice_number from 4 for 4) FROM orders WHERE invoice_number LIKE 'INV%-%'
  LOOP
    prefix := 'INV' || year_val || '-';
    
    -- Get max number for this year
    SELECT COALESCE(MAX(
      NULLIF(regexp_replace(substring(invoice_number from length(prefix) + 1), '[^0-9]', '', 'g'), '')::INTEGER
    ), 0) INTO new_num 
    FROM orders WHERE invoice_number LIKE prefix || '%';
    
    FOR dup IN 
      SELECT invoice_number FROM orders 
      WHERE invoice_number LIKE prefix || '%'
      GROUP BY invoice_number HAVING count(*) > 1
    LOOP
      skip_first := TRUE;
      FOR ord IN 
        SELECT id FROM orders WHERE invoice_number = dup.invoice_number ORDER BY created_at ASC
      LOOP
        IF skip_first THEN
          skip_first := FALSE;
          CONTINUE;
        END IF;
        new_num := new_num + 1;
        new_invoice := prefix || LPAD(new_num::TEXT, 3, '0');
        UPDATE orders SET invoice_number = new_invoice WHERE id = ord.id;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- Now add unique constraint
ALTER TABLE orders ADD CONSTRAINT orders_invoice_number_unique UNIQUE (invoice_number);