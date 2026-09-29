export const DEPOSIT_CLAIM_WINDOW_HOURS = 48;

export const DEPOSIT_CUSTODY_NOTE =
  "El depósito se entrega y se devuelve entre anfitrión y huésped. Cabibee no lo retiene ni lo transfiere.";

export type DepositCaseStatus =
  | "declared"
  | "window_open"
  | "claimed"
  | "guest_replied"
  | "released"
  | "closed";

export type BookingDepositRecord = {
  amountMxn: number;
  note: string;
  windowHours: number;
  checkoutDate: string;
  windowEndsAt?: string;
  status: DepositCaseStatus;
  claim?: {
    at: string;
    hostNote: string;
  };
  guestReply?: {
    at: string;
    note: string;
  };
  releasedAt?: string;
  closedAt?: string;
};
