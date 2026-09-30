-- C10: cola persistente Cabibee → urbnbeeai. No vive en memoria.

CREATE TABLE IF NOT EXISTS urb_outbound_webhooks (
  event_id VARCHAR(64) NOT NULL PRIMARY KEY,
  event VARCHAR(64) NOT NULL,
  host_id VARCHAR(64) NOT NULL,
  beeagent_customer_id INT NOT NULL,
  booking_id VARCHAR(64) NULL,
  occurred_at DATETIME(3) NOT NULL,
  payload JSON NOT NULL,
  status VARCHAR(24) NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  next_attempt_at DATETIME(3) NOT NULL,
  last_http INT NULL,
  last_error VARCHAR(512) NULL,
  created_at DATETIME(3) NOT NULL,
  delivered_at DATETIME(3) NULL,
  KEY idx_urb_out_wh_due (status, next_attempt_at),
  KEY idx_urb_out_wh_host (host_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
