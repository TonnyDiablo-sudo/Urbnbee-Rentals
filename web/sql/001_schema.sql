-- Urbnbee core schema (Phase B, URBNBEE_INFRASTRUCTURE_BRIEF).
-- IDs alineados con la app: usr_*, lst_*, bkg_* (VARCHAR PK).

CREATE TABLE IF NOT EXISTS urb_users (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(64) NULL,
  role ENUM('guest','host','admin') NOT NULL,
  created_at DATETIME(3) NOT NULL,
  UNIQUE KEY uq_urb_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS urb_host_profiles (
  user_id VARCHAR(64) NOT NULL PRIMARY KEY,
  payload JSON NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  CONSTRAINT fk_urb_host_profiles_user FOREIGN KEY (user_id) REFERENCES urb_users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS urb_host_entitlements (
  user_id VARCHAR(64) NOT NULL PRIMARY KEY,
  plan_tier VARCHAR(32) NOT NULL DEFAULT 'free',
  max_bookable_listings INT NOT NULL DEFAULT 0,
  booking_engine_enabled TINYINT(1) NOT NULL DEFAULT 0,
  bee_agent_addon VARCHAR(32) NULL,
  stripe_subscription_id VARCHAR(255) NULL,
  updated_at DATETIME(3) NOT NULL,
  CONSTRAINT fk_urb_host_entitlements_user FOREIGN KEY (user_id) REFERENCES urb_users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS urb_listings (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  host_id VARCHAR(64) NOT NULL,
  slug VARCHAR(160) NOT NULL,
  published TINYINT(1) NOT NULL DEFAULT 0,
  verified TINYINT(1) NOT NULL DEFAULT 0,
  payload JSON NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  UNIQUE KEY uq_urb_listings_slug (slug),
  KEY idx_urb_listings_host (host_id),
  CONSTRAINT fk_urb_listings_host FOREIGN KEY (host_id) REFERENCES urb_users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS urb_bookings (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  listing_id VARCHAR(64) NOT NULL,
  token VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL,
  payload JSON NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  UNIQUE KEY uq_urb_bookings_token (token),
  KEY idx_urb_bookings_listing (listing_id),
  CONSTRAINT fk_urb_bookings_listing FOREIGN KEY (listing_id) REFERENCES urb_listings (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS urb_guest_verification (
  user_id VARCHAR(64) NOT NULL PRIMARY KEY,
  payload JSON NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  CONSTRAINT fk_urb_guest_verification_user FOREIGN KEY (user_id) REFERENCES urb_users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS urb_webhook_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  provider VARCHAR(32) NOT NULL,
  event_id VARCHAR(255) NOT NULL,
  payload JSON NULL,
  processed_at DATETIME(3) NULL,
  UNIQUE KEY uq_urb_webhook_provider_event (provider, event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
