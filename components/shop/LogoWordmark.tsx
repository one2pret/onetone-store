import { cn } from '@/lib/utils';

const MASK = '/images/onetone-wordmark-mask.png';
const ASPECT = 686 / 137; // intrinsic mask ratio

/**
 * "onetone" wordmark. The reference brand mark is a custom geometric
 * lettering (open-ring "o", plug bar, keyhole "t"), not a normal font — so
 * we render the exact artwork as an alpha mask and paint it with CSS.
 * Color comes from `currentColor`, so it themes like text (white on dark,
 * gold shimmer via the `shimmer` variant).
 */
export function LogoWordmark({
  className,
  shimmer = false,
}: {
  className?: string;
  shimmer?: boolean;
}) {
  return (
    <span
      role="img"
      aria-label="onetone"
      className={cn(
        'inline-block align-middle bg-current',
        shimmer && 'wordmark-shimmer',
        className,
      )}
      style={{
        height: '1em',
        width: `${ASPECT}em`,
        WebkitMaskImage: `url(${MASK})`,
        maskImage: `url(${MASK})`,
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
      }}
    />
  );
}
