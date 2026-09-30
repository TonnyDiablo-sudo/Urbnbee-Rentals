-- C6: derechos por SKU del anfitrión (motor + verificación).
-- No sustituye urb_host_entitlements (plan_tier viejo); esa tabla no se usa.

CREATE TABLE IF NOT EXISTS urb_host_sku_entitlements (
  host_id VARCHAR(64) NOT NULL,
  sku VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  source VARCHAR(32) NOT NULL,
  stripe_subscription_id VARCHAR(255) NULL,
  current_period_end DATETIME(3) NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (host_id, sku),
  KEY idx_urb_host_sku_entitlements_sub (stripe_subscription_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
