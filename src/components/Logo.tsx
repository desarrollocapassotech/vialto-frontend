type LogoProps = {
  className?: string;
  /** Altura visual del logo (ancho proporcional) */
  heightClass?: string;
  /** Ruta del asset a usar (default: wordmark en /public/logo.png) */
  src?: string;
};

export function Logo({
  className = '',
  heightClass = 'h-14 max-w-[11rem]',
  src = '/logo.png',
}: LogoProps) {
  return (
    <img
      src={src}
      alt="Vialto"
      decoding="async"
      className={`${heightClass} w-auto max-w-full object-contain object-left ${className}`}
    />
  );
}
