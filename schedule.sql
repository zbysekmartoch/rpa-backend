-- Tabulka pro harvest schedule
CREATE TABLE schedule (
  id INT AUTO_INCREMENT PRIMARY KEY,
  harvester_id INT NOT NULL,
  datasource_id INT NOT NULL,
  cron_expression VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (harvester_id) REFERENCES harvester(id) ON DELETE CASCADE,
  FOREIGN KEY (datasource_id) REFERENCES ds(id) ON DELETE CASCADE,
  
  INDEX idx_harvester (harvester_id),
  INDEX idx_datasource (datasource_id)
);

-- Ukázkové testovací data
INSERT INTO schedule (harvester_id, datasource_id, cron_expression) VALUES
(1, 1, '0 2 * * *'),    -- Každý den ve 2:00
(1, 2, '0 */6 * * *'),  -- Každých 6 hodin
(2, 1, '0 9 * * 1-5');  -- Pracovní dny v 9:00