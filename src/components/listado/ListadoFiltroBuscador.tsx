import { useEffect, useState, type KeyboardEvent } from "react";

type Props = {
  value: string;
  onApply: (val: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  inputClassName?: string;
};

export function ListadoFiltroBuscador({
  value,
  onApply,
  placeholder = "Buscar…",
  ariaLabel,
  className = "",
  inputClassName = "",
}: Props) {
  const [input, setInput] = useState(value);

  useEffect(() => {
    setInput(value);
  }, [value]);

  const aplicar = () => {
    onApply(input.trim());
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      aplicar();
    }
  };

  return (
    <div className={`flex gap-1 ${className}`}>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={`h-9 min-w-0 flex-1 border border-black/15 bg-white px-2 text-sm ${
          input.trim() ? "text-vialto-fire" : "text-vialto-charcoal"
        } ${inputClassName}`}
      />
      <button
        type="button"
        onClick={aplicar}
        className="h-9 shrink-0 border border-black/15 bg-white px-2 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
      >
        OK
      </button>
    </div>
  );
}
