-- Aktualizace tabulky harvester pro JSON status
ALTER TABLE harvester 
MODIFY COLUMN status JSON NULL COMMENT 'JSON status from harvester API',
ADD COLUMN last_update TIMESTAMP NULL COMMENT 'Last status update timestamp';