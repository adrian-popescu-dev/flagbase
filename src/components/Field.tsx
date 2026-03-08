export function Field({
  label,
  name,
  placeholder,
  required,
  hint,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</label>
      <input
        name={name}
        placeholder={placeholder}
        required={required}
        className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none ring-zinc-900 transition focus:ring-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:ring-zinc-50"
      />
      {hint && <p className="text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}
