import { useEffect, useState } from 'react';

/** Phone breakpoint: everything below 768px gets the compact, single-column shell. */
const MOBILE_QUERY = '(max-width: 767.98px)';

/**
 * True while the viewport is phone-sized. Components use this to render a
 * genuinely different tree (a nav Drawer, card lists, a full-screen modal)
 * rather than just restyling, which CSS media queries alone cannot do.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(MOBILE_QUERY).matches;
  });

  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setIsMobile(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}
