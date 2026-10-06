import { redirect } from "next/navigation";

/** En la web el anuncio vive en /listings; la app usa /alojamiento. */
export default async function AlojamientoRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/listings/${encodeURIComponent(slug)}`);
}
