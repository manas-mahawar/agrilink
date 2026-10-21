import { Notice } from '@/components/ui/primitives';

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <article className="container-page max-w-3xl pb-20 pt-14">
      <span className="eyebrow">Legal</span>
      <h1 className="mt-2 text-[clamp(2rem,3.6vw,2.8rem)] font-extrabold text-forest-deep">{title}</h1>
      <p className="mt-2 text-sm text-muted">Last updated {updated}</p>
      <Notice tone="warn" className="mt-6" title="Draft for the pilot">
        This text describes how the site actually works today. It has not been reviewed by a lawyer and must be finalised before a public launch.
      </Notice>
      <div className="prose-legal mt-8 flex flex-col gap-4 text-[15px] leading-relaxed text-ink-soft [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-extrabold [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
        {children}
      </div>
    </article>
  );
}
