import { useEffect, useState } from 'react';

const QUERY = '(max-width: 639px)';

/** Breakpoint `sm` de Tailwind (640px): `true` en mobile, `false` en tablet/desktop. */
export function useIsMobileViewport(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}
