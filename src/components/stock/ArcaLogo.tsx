export function ArcaLogo({
  className = 'h-4 w-auto',
  alt = 'ARCA',
}: {
  className?: string;
  alt?: string;
}) {
  return <img src="/logo-arca.svg" alt={alt} className={className} />;
}
