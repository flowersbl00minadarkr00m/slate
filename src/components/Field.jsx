export function Field({ label, children }) {
  return (
    <label className="block">
      <span
        className="block mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-ink font-mono"
      >
        {label}
      </span>
      {children}
    </label>
  );
}
