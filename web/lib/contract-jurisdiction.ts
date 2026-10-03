import { isMexico } from "@/lib/geo-places";

export type ContractClause = { title: string; text: string };

export type ContractJurisdiction = {
  /** "Tulum, Quintana Roo, México" */
  label: string;
  governingLaw: string;
  courts: string;
  /** Cláusulas propias del lugar (registros, impuestos, naturaleza del contrato). */
  localClauses: ContractClause[];
};

type Place = { country?: string; state?: string; city?: string; municipality?: string };

function clean(v: string | undefined): string {
  return (v ?? "").trim();
}

function isCdmx(state: string): boolean {
  return /^(cdmx|ciudad de m[eé]xico|distrito federal|d\.?\s?f\.?)$/i.test(state);
}

function isUsa(country: string): boolean {
  return /^(us|usa|eua|ee\.?\s?uu\.?|estados unidos|united states)/i.test(country);
}

/** Avisos de corta estancia por estado (México). Sin cifras: las tasas y requisitos cambian seguido. */
const MX_STATE_NOTES: Record<string, string> = {
  "Ciudad de México":
    "En la Ciudad de México, el anfitrión declara que el alojamiento está inscrito en el padrón o registro de anfitriones que exige la Secretaría de Turismo local y que entera el impuesto local por servicios de hospedaje, además de respetar los límites de ocupación y días de renta que fije la normativa vigente.",
  "Quintana Roo":
    "En Quintana Roo, el anfitrión declara que el alojamiento cuenta con su inscripción en el Registro Estatal de Turismo, las licencias municipales que correspondan y que entera el impuesto estatal sobre la prestación de servicios de hospedaje.",
  Jalisco:
    "En Jalisco, el anfitrión declara que cumple con los registros estatales de prestadores de servicios turísticos, los permisos municipales aplicables y el impuesto estatal sobre hospedaje.",
  "Baja California Sur":
    "En Baja California Sur, el anfitrión declara que cuenta con los registros turísticos estatales y municipales aplicables y que entera el impuesto sobre hospedaje correspondiente.",
  Nayarit:
    "En Nayarit, el anfitrión declara que cuenta con los registros turísticos y permisos municipales aplicables y que entera el impuesto sobre hospedaje correspondiente.",
  Yucatán:
    "En Yucatán, el anfitrión declara que cuenta con los registros turísticos estatales aplicables y que entera el impuesto sobre hospedaje correspondiente.",
  Oaxaca:
    "En Oaxaca, el anfitrión declara que cuenta con los registros turísticos y permisos municipales aplicables y que entera el impuesto sobre hospedaje correspondiente.",
  Guerrero:
    "En Guerrero, el anfitrión declara que cuenta con los registros turísticos y permisos municipales aplicables y que entera el impuesto sobre hospedaje correspondiente.",
  "Nuevo León":
    "En Nuevo León, el anfitrión declara que cumple con los registros, permisos municipales y el impuesto sobre hospedaje que le correspondan.",
};

function mexico(state: string, city: string, municipality: string, longStay: boolean): ContractJurisdiction {
  const cdmx = isCdmx(state);
  const stateName = cdmx ? "Ciudad de México" : state;
  const where = cdmx
    ? [municipality || city, "Ciudad de México"].filter(Boolean).join(", ")
    : [city || municipality, stateName].filter(Boolean).join(", ");
  const code = cdmx
    ? "el Código Civil para el Distrito Federal, vigente en la Ciudad de México"
    : stateName
      ? `el Código Civil vigente en el estado de ${stateName}`
      : "el código civil del estado donde se ubica el inmueble";
  const courtsPlace = cdmx ? "la Ciudad de México" : [city || municipality, stateName].filter(Boolean).join(", ");

  const localClauses: ContractClause[] = [
    {
      title: "NATURALEZA DEL CONTRATO",
      text: longStay
        ? "Las partes celebran un contrato de hospedaje temporal con fines de alojamiento, no un arrendamiento de casa habitación por tiempo indefinido. Si por la duración de la estancia la ley local le diera el trato de arrendamiento, se aplicarán sólo las disposiciones que no admitan pacto en contrario y las demás cláusulas seguirán vigentes."
        : "Las partes celebran un contrato de hospedaje temporal, regido por las disposiciones del contrato de hospedaje (en el Código Civil Federal, artículos 2666 a 2669, y sus equivalentes locales). No es un arrendamiento: el huésped no adquiere la posesión del inmueble más allá de las fechas pactadas.",
    },
    {
      title: "REGISTROS, PERMISOS E IMPUESTOS",
      text: [
        "El anfitrión declara que tiene derecho a ofrecer el inmueble en hospedaje (como propietario o con autorización del propietario y, en su caso, del régimen de condominio), que cuenta con los registros que le apliquen conforme a la Ley General de Turismo (incluido el Registro Nacional de Turismo cuando corresponda) y que es el único responsable de sus obligaciones fiscales, incluidos el ISR, el IVA y los impuestos locales sobre hospedaje.",
        MX_STATE_NOTES[stateName] ?? "",
      ]
        .filter(Boolean)
        .join(" "),
    },
    {
      title: "PROTECCIÓN AL CONSUMIDOR Y DATOS PERSONALES",
      text: "Cuando el anfitrión preste el hospedaje de forma habitual, el huésped conserva los derechos que le otorga la Ley Federal de Protección al Consumidor. Cada parte usará los datos personales de la otra sólo para cumplir este contrato y conforme a la legislación mexicana de protección de datos personales.",
    },
    {
      title: "FIRMA ELECTRÓNICA",
      text: "Las partes aceptan que su consentimiento expresado por medios electrónicos tiene la misma validez que la firma autógrafa, conforme a los artículos 1803 y 1834 bis del Código Civil Federal, sus equivalentes locales y los artículos 89 y siguientes del Código de Comercio.",
    },
  ];

  return {
    label: [where, "México"].filter(Boolean).join(", "),
    governingLaw: `Este contrato se rige por ${code} y, en lo no previsto, por el Código Civil Federal.`,
    courts: courtsPlace
      ? `Para cualquier controversia, las partes se someten a los tribunales competentes de ${courtsPlace}, renunciando a cualquier otro fuero que pudiera corresponderles por su domicilio presente o futuro. Antes de acudir a tribunales intentarán resolverlo de buena fe y, si el huésped actúa como consumidor, podrá acudir a la PROFECO.`
      : "Para cualquier controversia, las partes se someten a los tribunales competentes del lugar donde se ubica el inmueble.",
    localClauses,
  };
}

function usa(state: string, city: string, longStay: boolean): ContractJurisdiction {
  const where = [city, state].filter(Boolean).join(", ");
  return {
    label: [where, "Estados Unidos"].filter(Boolean).join(", "),
    governingLaw: `Este contrato se rige por las leyes del estado de ${state || "donde se ubica el inmueble"} y por las ordenanzas locales aplicables.`,
    courts: `Para cualquier controversia, las partes se someten a los tribunales competentes del condado donde se ubica el inmueble${where ? ` (${where})` : ""}.`,
    localClauses: [
      {
        title: "NATURALEZA DEL CONTRATO",
        text: longStay
          ? "Las partes celebran un hospedaje temporal. En varios estados una ocupación de 30 días o más puede crear derechos de inquilino; si la ley local lo dispone, se aplicarán esas disposiciones imperativas y las demás cláusulas seguirán vigentes."
          : "Las partes celebran un hospedaje temporal (transient occupancy). No es un contrato de arrendamiento y no crea una relación de arrendador e inquilino.",
      },
      {
        title: "PERMISOS E IMPUESTOS",
        text: "El anfitrión declara que cuenta con las licencias o permisos de renta de corta estancia que exija la ciudad o el condado, que respeta el reglamento de la asociación de propietarios si existe y que es responsable de cobrar y enterar los impuestos de ocupación transitoria aplicables.",
      },
      {
        title: "FIRMA ELECTRÓNICA",
        text: "Las partes aceptan que su firma electrónica tiene la misma validez que una firma autógrafa, conforme a la ley federal ESIGN y la ley estatal de transacciones electrónicas aplicable.",
      },
    ],
  };
}

function generic(country: string, state: string, city: string, longStay: boolean): ContractJurisdiction {
  const where = [city, state, country].filter(Boolean).join(", ");
  return {
    label: where || "Lugar del inmueble",
    governingLaw: `Este contrato se rige por la legislación vigente en ${where || "el lugar donde se ubica el inmueble"}.`,
    courts: "Para cualquier controversia, las partes se someten a los tribunales competentes del lugar donde se ubica el inmueble.",
    localClauses: [
      {
        title: "NATURALEZA DEL CONTRATO",
        text: longStay
          ? "Las partes celebran un hospedaje temporal con fines de alojamiento. Si por la duración de la estancia la ley local le diera el trato de arrendamiento, se aplicarán sólo sus disposiciones imperativas."
          : "Las partes celebran un hospedaje temporal, no un arrendamiento. El huésped no adquiere derechos sobre el inmueble más allá de las fechas pactadas.",
      },
      {
        title: "PERMISOS E IMPUESTOS",
        text: "El anfitrión declara que tiene derecho a ofrecer el inmueble en hospedaje, que cuenta con los registros y permisos que exija la normativa local y que es responsable de los impuestos que le correspondan.",
      },
      {
        title: "FIRMA ELECTRÓNICA",
        text: "Las partes aceptan que su consentimiento expresado por medios electrónicos tiene la misma validez que la firma autógrafa, en la medida que lo permita la ley aplicable.",
      },
    ],
  };
}

/** Ley aplicable, tribunales y cláusulas locales según dónde está el inmueble. */
export function contractJurisdiction(place: Place, opts?: { nights?: number }): ContractJurisdiction {
  const country = clean(place.country) || "México";
  const state = clean(place.state);
  const city = clean(place.city);
  const municipality = clean(place.municipality);
  const longStay = (opts?.nights ?? 0) >= 30;
  if (isMexico(country)) return mexico(state, city, municipality, longStay);
  if (isUsa(country)) return usa(state, city, longStay);
  return generic(country, state, city, longStay);
}

/** Cláusulas comunes a cualquier lugar. Ninguna menciona a la plataforma por nombre. */
export function commonContractClauses(maxGuests: number): ContractClause[] {
  return [
    {
      title: "OBLIGACIONES DEL ANFITRIÓN",
      text: "Entregar el inmueble en la fecha pactada, limpio, en condiciones de higiene y seguridad, con los servicios y amenidades anunciados; respetar la privacidad del huésped y entrar sólo por emergencia o con aviso previo; atender las fallas que impidan el uso normal del alojamiento.",
    },
    {
      title: "OBLIGACIONES DEL HUÉSPED",
      text: `Usar el inmueble sólo para hospedaje; no exceder la ocupación máxima de ${maxGuests} persona${maxGuests === 1 ? "" : "s"}; respetar las reglas del alojamiento y, en su caso, del condominio; no subarrendar ni ceder la estancia; responder por los daños que causen él o sus acompañantes, salvo el desgaste normal; y desocupar en la fecha y hora de salida.`,
    },
  ];
}

export const THIRD_PARTY_CLAUSE: ContractClause = {
  title: "CONTRATO ENTRE PARTICULARES",
  text: "Este contrato se celebra exclusivamente entre el anfitrión y el huésped. La herramienta tecnológica usada para generar, firmar y resguardar este documento y, en su caso, para procesar pagos, no es parte de este contrato, no presta el servicio de hospedaje, no es propietaria, administradora ni intermediaria del inmueble y no asume obligación alguna derivada de él. Cualquier reclamación sobre el hospedaje, el depósito o los daños se resuelve únicamente entre las partes.",
};

export const SEVERABILITY_CLAUSE: ContractClause = {
  title: "DISPOSICIONES FINALES",
  text: "Si alguna cláusula resultara inválida, las demás seguirán vigentes. Las cláusulas adicionales del anfitrión no pueden contradecir la ley aplicable ni las cláusulas anteriores. Este documento, junto con el anuncio del alojamiento, contiene el acuerdo completo de las partes.",
};
