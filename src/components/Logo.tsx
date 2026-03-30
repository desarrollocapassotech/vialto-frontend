type LogoProps = {
  className?: string;
  /** Altura visual del logo (ancho proporcional) */
  heightClass?: string;
};

export function Logo({
  className = '',
  heightClass = 'h-14 max-w-[11rem]',
}: LogoProps) {
  return (
    <img
      src="/logo.png"
      alt="Vialto"
      decoding="async"
      className={`${heightClass} w-auto max-w-full object-contain object-left ${className}`}
    />
  );
}
