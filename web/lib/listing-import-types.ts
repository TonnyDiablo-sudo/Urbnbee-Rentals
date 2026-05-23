import type { ListingCategory } from "@/lib/mock-data";

export type ListingImportConfidence = "high" | "low";

export type ListingImportRules = {
  smoking?: boolean;
  pets?: boolean | null;
  parties?: boolean;
  children?: boolean;
};

export type ListingImportLlmPayload = {
  title?: string;
  description?: string;
  categoryKey?: ListingCategory;
  spaceType?: string;
  city?: string;
  zone?: string;
  county?: string;
  country?: string;
  addressLine?: string;
  guests?: number;
  bedrooms?: number;
  bathrooms?: number;
  size?: string;
  pricePerNight?: number;
  cleaningFee?: number;
  amenities?: string[];
  rules?: ListingImportRules;
  fieldConfidence?: Record<string, ListingImportConfidence>;
  warnings?: string[];
};
