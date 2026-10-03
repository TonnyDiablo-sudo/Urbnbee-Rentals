import type { TermsDoc } from "@/lib/terms";

export function TermsDocument({ doc, accepted }: { doc: TermsDoc; accepted?: string | null }) {
  return (
    <article className="text-[#222]">
      <h1 className="text-2xl font-bold sm:text-3xl">{doc.title}</h1>
      <p className="mt-1 text-sm text-[#717171]">{doc.updated}</p>
      {accepted && (
        <p className="mt-3 rounded-xl bg-[#f0f7f0] px-3.5 py-2.5 text-sm text-[#1f5f2a]">✓ {accepted}</p>
      )}
      <p className="mt-5 text-[15px] leading-relaxed text-[#444]">{doc.intro}</p>
      <div className="mt-6 space-y-6">
        {doc.sections.map((s) => (
          <section key={s.title}>
            <h2 className="text-[17px] font-semibold">{s.title}</h2>
            {s.paragraphs.map((p, i) => (
              <p key={i} className="mt-2 text-[15px] leading-relaxed text-[#444]">
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>
    </article>
  );
}
