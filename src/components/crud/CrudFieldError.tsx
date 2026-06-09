export function CrudFieldError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-xs font-medium text-red-600">
      {message}
    </p>
  );
}
