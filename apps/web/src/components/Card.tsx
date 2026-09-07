export function Card({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-[20px] border border-line bg-card p-6 shadow-[0_18px_50px_rgba(23,33,43,0.06)] ${className}`}
    >
      {children}
    </div>
  );
}
