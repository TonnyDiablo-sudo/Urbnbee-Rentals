import Link from "next/link";
import type { Listing, ListingCategory } from "@/lib/mock-data";
import { ListingCard } from "@/components/listing-card";
import { ScrollReveal } from "@/components/scroll-reveal";

type Props = {
  category: ListingCategory;
  title: string;
  items: Listing[];
};

export function ListingSection({ category, title, items }: Props) {
  if (!items.length) return null;

  return (
    <section className="border-t py-10" style={{ borderColor: "#ebebeb" }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section heading */}
        <ScrollReveal>
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-[#484848]">{title}</h2>
              <div className="mt-1 h-[3px] w-16" style={{ backgroundColor: "#dcb81e" }} />
            </div>
            <Link
              href={`/alojamientos?tipo=${category}`}
              className="text-sm font-medium transition hover:underline"
              style={{ color: "#dcb81e" }}
            >
              Ver más
            </Link>
          </div>
        </ScrollReveal>

        <div className="grid gap-6 sm:grid-cols-2">
          {items.map((listing, i) => (
            <ScrollReveal key={listing.id} delay={i * 120}>
              <ListingCard listing={listing} />
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
