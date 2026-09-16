export function Logo({ light = false, size = "md" }: { light?: boolean; size?: "md" | "lg" }) {
  const box = size === "lg" ? "size-10 text-lg" : "size-8 text-base";
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className={`inline-flex ${box} items-center justify-center rounded-md font-display font-bold ${
          light ? "bg-saffron text-ink" : "bg-ink text-saffron"
        }`}
        aria-hidden
      >
        و
      </span>
      <span className={`font-display ${size === "lg" ? "text-2xl" : "text-xl"} font-semibold ${light ? "text-white" : "text-ink"}`}>
        واصل
      </span>
    </span>
  );
}
