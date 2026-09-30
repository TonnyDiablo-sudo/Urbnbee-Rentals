-- C4: credenciales Stripe del anfitrión (cifradas) y log de cobros de estancia.

CREATE TABLE IF NOT EXISTS urb_host_payment_creds (
  host_id VARCHAR(64) NOT NULL PRIMARY KEY,
  ciphertext TEXT NOT NULL,
  secret_last4 VARCHAR(8) NOT NULL,
  last_verified_at DATETIME(3) NULL,
  last_error VARCHAR(512) NULL,
  updated_at DATETIME(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS urb_booking_transactions (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  booking_id VARCHAR(64) NOT NULL,
  host_id VARCHAR(64) NOT NULL,
  charged_via VARCHAR(16) NOT NULL,
  provider_ref VARCHAR(255) NOT NULL,
  amount_cents INT NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'mxn',
  processor_fee_cents INT NULL,
  net_cents INT NULL,
  status VARCHAR(32) NOT NULL,
  payload JSON NULL,
  created_at DATETIME(3) NOT NULL,
  KEY idx_urb_tx_booking (booking_id),
  KEY idx_urb_tx_host (host_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
