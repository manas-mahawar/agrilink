import Image from 'next/image';
import type { SiteImage } from '@/content/images';

/** Photo panel + form card, as in the design reference. The photo hides on small screens. */
export function AuthShell({ image, quote, title, description, children }: { image: SiteImage; quote: string; title: string; description?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid w-full max-w-[1040px] overflow-hidden rounded-2xl border border-line bg-white shadow-card lg:grid-cols-[0.9fr_1fr]">
      <div className="relative hidden min-h-[560px] lg:block">
        <Image src={image.src} alt={image.alt} fill priority sizes="460px" className="object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,59,40,0)_45%,rgba(16,59,40,0.85)_100%)]" aria-hidden="true" />
        <p className="absolute inset-x-8 bottom-8 font-display text-xl font-extrabold leading-snug text-white">{quote}</p>
      </div>
      <div className="flex flex-col gap-6 p-6 sm:p-10">
        <div className="flex flex-col gap-2">
          <h1 className="text-[28px] font-extrabold text-forest-deep">{title}</h1>
          {description ? <div className="text-[15px] text-muted">{description}</div> : null}
        </div>
        {children}
      </div>
    </div>
  );
}
