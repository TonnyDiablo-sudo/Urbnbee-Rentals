export function SiteFooter() {
  return (
    <footer className="bg-white border-t py-12" style={{ borderColor: "#ebebeb" }}>
      <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
        <p className="text-sm leading-relaxed text-[#3a3a3a]">
          La información en este directorio ha sido proporcionada por los anfitriones o
          recopilada de fuentes públicas con autorización. Si eres el propietario de un
          alojamiento y deseas modificar o eliminar tu perfil, contáctanos.{" "}
          Urbnbee se compromete a ofrecer un alto nivel de experiencia, servicio al cliente
          y atención al detalle en el mercado de reservas de alojamiento.
        </p>
        <div className="flex flex-col gap-6 sm:flex-row sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#484848]">Contacto</h3>
            <a
              href="mailto:hola@urbnbee.com"
              className="mt-1 block text-sm transition hover:text-[#c9a71a]"
              style={{ color: "#dcb81e" }}
            >
              hola@urbnbee.com
            </a>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#484848]">Síguenos:</h3>
            <p className="mt-1 text-sm text-[#3a3a3a]">Redes sociales próximamente</p>
          </div>
        </div>
        <p className="text-xs text-[#3a3a3a]">
          Todos los derechos reservados: Urbnbee® {new Date().getFullYear()}.
        </p>
      </div>
    </footer>
  );
}
