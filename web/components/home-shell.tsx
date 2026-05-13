"use client";

import { useRef } from "react";
import type { Listing } from "@/lib/mock-data";
import type { ListingCategory } from "@/lib/mock-data";
import { CategoryGrid } from "@/components/category-grid";
import { HeroSlider } from "@/components/hero-slider";
import { ListingSection } from "@/components/listing-section";
import { ScrollReveal } from "@/components/scroll-reveal";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ValueProps } from "@/components/value-props";
import { BookingTokenLookup } from "@/components/booking-token-lookup";

type Sections = Record<ListingCategory, Listing[]>;

export function HomeShell({ sections }: { sections: Sections }) {
  const heroSentinelRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <SiteHeader heroSentinelRef={heroSentinelRef} />
      <main className="flex-1">
        <HeroSlider sentinelRef={heroSentinelRef} />
        <ValueProps />
        <div className="bg-white">
          <BookingTokenLookup />
        </div>
        <CategoryGrid />

        <ScrollReveal>
          <div className="bg-white px-4 pb-4 pt-14 text-center sm:px-6 lg:px-8">
            <h2 className="text-3xl font-normal text-[#000000]">Escoge tu espacio ideal</h2>
            <div className="mx-auto mt-2 h-1" style={{ width: "200px", backgroundColor: "#dcb81e" }} />
          </div>
        </ScrollReveal>

        <div className="bg-white pb-14">
          <ListingSection category="habitaciones" title="Habitaciones" items={sections.habitaciones} />
          <ListingSection category="casas" title="Casas" items={sections.casas} />
          <ListingSection category="departamentos" title="Departamentos" items={sections.departamentos} />
          <ListingSection category="cabanas" title="Cabañas" items={sections.cabanas} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
