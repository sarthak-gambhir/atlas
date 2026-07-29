interface BrandMarkProps {
  /** Pixel size of the square glyph. Defaults to 24. */
  size?: number;
}

/**
 * The Atlas peak mark, inlined so `fill: currentColor` picks up the active
 * theme's foreground color wherever it is placed.
 */
export function BrandMark({ size = 24 }: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="-51.2 -51.2 614.4 614.4"
      fill="currentColor"
      role="img"
      aria-label="Atlas"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M476.811,492.379L268.639,8.332c-2.172-5.047-7.141-8.328-12.641-8.328s-10.469,3.281-12.641,8.328L35.186,492.379c-2.656,5.625-1.203,12.344,3.547,16.359c4.766,4.016,11.625,4.359,16.734,0.813l200.531-139.032l200.547,139.032c5.109,3.547,11.969,3.203,16.734-0.813C478.029,504.723,479.467,498.004,476.811,492.379z" />
    </svg>
  );
}
