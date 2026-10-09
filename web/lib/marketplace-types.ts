import type { ArrivalGuide } from "@/lib/arrival-guide";
import type { ArrivalMessageSettings } from "@/lib/arrival-message-template";
import type { ListingContractSettings } from "@/lib/booking-contract-templates";
import type { AgentFaqItem } from "@/lib/listing-agent-info";
import type { ListingPricing, RentalMode } from "@/lib/listing-pricing";
import type { ListingCategory } from "@/lib/mock-data";
import type { ListingDetail } from "@/lib/listing-detail-data";
import type { StayMessagesSettings } from "@/lib/stay-messages-template";
import type { HostTaxSettings } from "@/lib/stay-tax";

export type UserRole = "guest" | "host" | "admin";

export type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  /** Nombre público en anuncios y chat. En reservas y contratos se usa fullName. */
  alias?: string;
  /** Si es true y hay alias, anuncios y chat muestran el alias. */
  showAlias?: boolean;
  /** La identidad ya se comprobó: fullName no se vuelve a editar, aunque cancele la membresía. */
  legalNameLocked?: boolean;
  phone?: string;
  /** Dirección para el contrato (cuenta). */
  addressLine?: string;
  role: UserRole;
  createdAt: string;
  /** Puede usar el panel de asociados (alta de anfitriones con IA). Los admin siempre pueden. */
  associate?: boolean;
  /** Asociado Plus: además puede usar el piloto automático de la extensión. */
  associatePlus?: boolean;
  /** Hash del token que usa la extensión de Chrome del asociado. */
  associateTokenHash?: string;
  /** Cuentas nuevas que el admin le pide al asociado por día. */
  associateDailyGoal?: number;
  /** Contraseña actual del asociado cifrada (AES-GCM) para que el admin la pueda ver; ver associate-password-vault. */
  associatePasswordEnc?: string;
  associatePasswordAt?: string;
  /** Asociado que dio de alta esta cuenta. */
  provisionedBy?: string;
  /** El correo es interno (`@cuentas.cabibee.com`) hasta que el dueño ponga el suyo. */
  placeholderEmail?: boolean;
  /** Al entrar con la contraseña temporal debe poner su correo y una contraseña nueva. */
  mustChangePassword?: boolean;
  /** Cuándo el dueño tomó control de una cuenta creada por un asociado. */
  claimedAt?: string;
  /** Versión de los Términos de uso que aceptó (`TERMS_VERSION`) y cuándo. */
  termsVersion?: string;
  termsAcceptedAt?: string;
  emailVerifiedAt?: string;
  /** Último idioma con el que usó el sitio; los correos salen en este idioma. */
  lang?: "es" | "en";
  /** Idioma en que lee el chat (traductor): lo que le escriben se traduce a éste. Si falta, el del sitio. */
  chatLang?: string;
  emailVerifyTokenHash?: string;
  emailVerifyExpiresAt?: string;
  /** Correo nuevo que pidió; reemplaza a `email` sólo cuando lo confirma desde el enlace. */
  pendingEmail?: string;
  /** Sesiones emitidas antes de esto ya no valen (cambio o recuperación de contraseña). */
  passwordChangedAt?: string;
  passwordResetTokenHash?: string;
  passwordResetExpiresAt?: string;
  /** Último pedido de recuperación, para no mandar un correo tras otro. */
  passwordResetRequestedAt?: string;
  /** País que eligió al pagar: México paga en MXN; Estados Unidos y cualquier otro, en USD. */
  billingCountry?: BillingCountry;
  /** La cuenta no puede usar Cabibee hasta que un administrador la habilite. */
  suspendedAt?: string;
  suspendReason?: string;
  /** Administrador de segundo nivel: solo entra al centro y solo a lo que esté en esta lista. */
  staffPermissions?: string[];
};

export type BillingCountry = "MX" | "US" | "OTHER";

/** Contact & bio shown on listing detail — scoped per host (tenant). */
export type HostProfileRecord = {
  userId: string;
  bio: string;
  avatarUrl?: string;
  whatsapp?: string;
  phone?: string;
  /** Public email for guests (can differ from login email) */
  email?: string;
  instagram?: string;
  website?: string;
  airbnbUrl?: string;
  /** A qué se dedica («Diseñadora», «Estudiante de medicina»). */
  work?: string;
  /** Ciudad donde vive. */
  livesIn?: string;
  languages?: string[];
  interests?: string[];
  /** IVA / impuestos que el anfitrión cobra al huésped. */
  tax?: HostTaxSettings;
};

export type HostListingRecord = {
  id: string;
  hostId: string;
  slug: string;
  title: string;
  description: string;
  categoryKey: ListingCategory;
  spaceType: string;
  city: string;
  zone: string;
  /** Municipio / alcaldía / condado. */
  county: string;
  /** Estado / provincia. Los anuncios viejos lo infieren al cargar (lib/geo-places). */
  state?: string;
  country: string;
  /** Calle, número exterior y código postal. Siempre exacta: el público sólo la ve si `locationPrecision` es exact. */
  addressLine: string;
  /** Ubicación aproximada que dejó un asociado cuando el anuncio original no traía la exacta. Interna. */
  addressApprox?: string;
  /** Número interior, depto, piso o torre. */
  addressUnit?: string;
  /** El anfitrión confirmó que no hay número interior. */
  noAddressUnit?: boolean;
  lat: number;
  lng: number;
  /** approximate (por defecto): el mapa público corre el punto y no muestra la calle. */
  locationPrecision?: "approximate" | "exact";
  /** El anfitrión le asignó uno de sus lugares pagados del motor de reservas. */
  bookingEngineOn?: boolean;
  /** El anfitrión usa aquí uno de sus lugares pagados de «Anuncio destacado». */
  featuredOn?: boolean;
  /** El anuncio está en la herramienta de limpieza. */
  cleaningOn?: boolean;
  guests: number;
  bedrooms: number;
  bathrooms: number;
  /** Si los baños son sólo del huésped o se comparten. Sin esto no se indica. */
  bathroomType?: "private" | "shared";
  /** true: entrada autónoma (caja de llaves, cerradura con código); false: lo recibe el anfitrión. */
  selfCheckIn?: boolean;
  size?: string;
  /** monthly: el anfitrión pone `pricePerMonth` y `pricePerNight` se deriva (mes = 30 noches). */
  rentalMode?: RentalMode;
  pricePerMonth?: number;
  pricePerNight: number;
  cleaningFee: number;
  /** Precio por noche para fechas concretas (YYYY-MM-DD). Si falta la clave, aplica `pricePerNight`. */
  nightlyPriceOverrides?: Record<string, number>;
  /** Fin de semana, descuentos por duración y estancia mínima/máxima. */
  pricing?: ListingPricing;
  arrivalGuide?: ArrivalGuide;
  /** El agente de IA puede dar `arrivalGuide.accessCode` a huéspedes con reserva confirmada. Por defecto true. */
  agentCanShareAccessCode?: boolean;
  /** Mensaje con los datos de llegada que se le manda al huésped de una reserva del motor. */
  arrivalMessage?: ArrivalMessageSettings;
  /** Bienvenida, durante la estancia y salida, por el chat de la reserva. */
  stayMessages?: StayMessagesSettings;
  /** Sólo en las cuentas demo: "pending" hasta que el servidor les pone fotos y audios de muestra. */
  demoStayMedia?: "pending" | "done" | "voice";
  photos: string[];
  amenities: string[];
  rules: ListingDetail["rules"];
  /** Reglas propias del anfitrión, en texto libre (públicas y en el contrato). */
  houseRules?: string;
  /** Preguntas frecuentes para el agente de IA del anfitrión (urbnbeeai). No se muestran en el anuncio. */
  agentFaq?: AgentFaqItem[];
  /** Información general para el agente: estacionamiento, qué hay cerca, trato con el huésped… */
  agentNotes?: string;
  blockedDates: string[];
  /** Platform badges — new host listings start unverified */
  verified: boolean;
  published: boolean;
  /**
   * instant: si Stripe confirma el pago, la reserva queda aceptada sin paso del anfitrión.
   * approval: el anfitrión acepta a mano y entonces el huésped recibe contrato, pago y, si aplica, el crédito.
   */
  bookingApprovalMode: "instant" | "approval";
  /** Si hace falta una consulta de crédito para seguir con la reserva. */
  requireCreditCheck?: boolean;
  /** Quién paga esa consulta. Por defecto el huésped. */
  creditCheckPayer?: "host" | "guest";
  /**
   * false: este anuncio no cobra los impuestos del anfitrión. Con reserva por
   * aprobación es solo el valor inicial: el anfitrión decide al aceptar.
   */
  chargeTax?: boolean;
  /** Plantilla y datos que el anfitrión usa para celebrar el contrato de cada reserva. */
  contract?: ListingContractSettings;
  /** De dónde lo capturó un asociado. Interno: no se muestra al público. */
  source?: ListingSource;
  createdAt: string;
  updatedAt: string;
};

export type ListingSourceKind = "facebook" | "web" | "screenshots";

export type ListingSource = {
  kind: ListingSourceKind;
  url?: string;
  site?: string;
  capturedBy: string;
  capturedAt: string;
};

export type SessionPayload = {
  sub: string;
  email: string;
  role: UserRole;
  exp: number;
};
