import Image from 'next/image';
import Link from 'next/link';
import { BRAND } from '@/content/images';
import { cn } from '@/lib/utils';

/** Header lockup (no tagline); switches to the emblem on very narrow screens. */
export function HeaderLogo({ className }: { className?: string }) {
  return (
    <Link href="/" aria-label="AgriLink home" className={cn('flex shrink-0 items-center rounded-md', className)}>
      <Image
        src={BRAND.logo.src}
        width={BRAND.logo.width}
        height={BRAND.logo.height}
        alt=""
        priority
        className="hidden h-[38px] w-auto object-contain min-[341px]:block lg:h-[46px]"
      />
      <Image
        src={BRAND.mark.src}
        width={BRAND.mark.width}
        height={BRAND.mark.height}
        alt=""
        priority
        className="block h-10 w-auto object-contain min-[341px]:hidden"
      />
    </Link>
  );
}

export function FullLogo({ className, priority = false }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src={BRAND.logoFull.src}
      width={BRAND.logoFull.width}
      height={BRAND.logoFull.height}
      alt="AgriLink — Starting local. Scaling smart."
      priority={priority}
      className={cn('h-auto w-[196px] max-w-full object-contain', className)}
    />
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <Image src={BRAND.mark.src} width={BRAND.mark.width} height={BRAND.mark.height} alt="" className={cn('h-14 w-auto object-contain', className)} />
  );
}
