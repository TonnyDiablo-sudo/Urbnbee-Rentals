/** Entrada y salida con ubicación: se prende cuando las tiendas de apps autoricen el permiso de ubicación. */
export function attendanceEnabled(): boolean {
  return process.env.CLEANING_ATTENDANCE_ENABLED === "1";
}
