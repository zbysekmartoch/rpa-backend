-- Tabulka pro harvestery
CREATE TABLE harvester (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  status ENUM('on', 'off') DEFAULT 'off',
  host VARCHAR(255) NOT NULL,
  upload DECIMAL(10,2) NULL COMMENT 'Upload speed in Mbps',
  download DECIMAL(10,2) NULL COMMENT 'Download speed in Mbps', 
  ping DECIMAL(10,2) NULL COMMENT 'Ping in ms',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);