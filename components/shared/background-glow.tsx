/** Fixed, decorative ambient light field. Purely visual — aria-hidden,
 * pointer-events disabled — so it never interferes with content or a11y. */
export function BackgroundGlow() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute inset-0 bg-background" />
      <div className="absolute -top-40 -left-40 h-[36rem] w-[36rem] rounded-full bg-violet/25 blur-[140px]" />
      <div className="absolute top-1/3 -right-40 h-[32rem] w-[32rem] rounded-full bg-cyan/20 blur-[140px]" />
      <div className="absolute bottom-0 left-1/4 h-[28rem] w-[28rem] rounded-full bg-violet/15 blur-[160px]" />
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />
    </div>
  );
}
