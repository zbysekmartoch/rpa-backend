-- Example post-import SQL queries
-- This file contains SQL commands that will be executed after the import is complete
-- Separate multiple queries with semicolons

-- Example: Update statistics or create aggregated views
-- UPDATE imp_product SET processed = 1 WHERE processed IS NULL;

-- Example: Create indexes for better performance
-- CREATE INDEX IF NOT EXISTS idx_product_date ON imp_product(date);
-- CREATE INDEX IF NOT EXISTS idx_price_date ON imp_price(date);

-- Example: Clean up duplicate entries
-- DELETE t1 FROM imp_product t1
-- INNER JOIN imp_product t2
-- WHERE t1.id > t2.id
-- AND t1.id = t2.id
-- AND t1.date = t2.date;

-- Add your custom post-import queries here
