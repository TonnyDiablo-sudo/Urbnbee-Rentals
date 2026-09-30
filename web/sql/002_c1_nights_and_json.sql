-- C1: candado de noches + tablas para el resto de JSON.
-- urb_users / listings / bookings / verification ya existen en 001.

CREATE TABLE IF NOT EXISTS urb_booking_nights (
  listing_id VARCHAR(64) NOT NULL,
  night_date DATE NOT NULL,
  booking_id VARCHAR(64) NOT NULL,
  PRIMARY KEY (listing_id, night_date),
  KEY idx_urb_booking_nights_booking (booking_id),
  CONSTRAINT fk_urb_booking_nights_listing FOREIGN KEY (listing_id) REFERENCES urb_listings (id) ON DELETE CASCADE,
  CONSTRAINT fk_urb_booking_nights_booking FOREIGN KEY (booking_id) REFERENCES urb_bookings (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS urb_host_inbox_messages (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  listing_id VARCHAR(64) NOT NULL,
  host_id VARCHAR(64) NOT NULL,
  guest_session_id VARCHAR(160) NOT NULL,
  sender VARCHAR(16) NOT NULL,
  payload JSON NOT NULL,
  created_at DATETIME(3) NOT NULL,
  KEY idx_urb_inbox_thread (listing_id, guest_session_id),
  KEY idx_urb_inbox_host (host_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS urb_beeagent_host_links (
  host_id VARCHAR(64) NOT NULL PRIMARY KEY,
  beeagent_customer_id BIGINT NOT NULL,
  email VARCHAR(255) NOT NULL,
  linked_at DATETIME(3) NOT NULL,
  UNIQUE KEY uq_urb_beeagent_customer (beeagent_customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS urb_beeagent_pending_codes (
  code VARCHAR(64) NOT NULL PRIMARY KEY,
  host_id VARCHAR(64) NOT NULL,
  expires_at DATETIME(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS urb_json_blobs (
  doc_key VARCHAR(64) NOT NULL PRIMARY KEY,
  payload JSON NOT NULL,
  updated_at DATETIME(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
