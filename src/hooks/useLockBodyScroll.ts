import { useEffect } from 'react';

/**
 * Bloquea el scroll de la página mientras un overlay modal está abierto.
 * Por defecto solo en viewports menores a lg (<1024px).
 */
export function useLockBodyScroll(active: boolean, maxWidthPx = 1023) {
  useEffect(() => {
    if (!active) return;

    const media = window.matchMedia(`(max-width: ${maxWidthPx}px)`);
    let scrollY = 0;

    function lock() {
      if (!media.matches) {
        unlockStyles();
        return;
      }
      scrollY = window.scrollY;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
    }

    function unlockStyles() {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
    }

    function onMediaChange() {
      if (media.matches) lock();
      else {
        unlockStyles();
        window.scrollTo(0, scrollY);
      }
    }

    lock();
    media.addEventListener('change', onMediaChange);

    return () => {
      media.removeEventListener('change', onMediaChange);
      unlockStyles();
      if (media.matches) {
        window.scrollTo(0, scrollY);
      }
    };
  }, [active, maxWidthPx]);
}
