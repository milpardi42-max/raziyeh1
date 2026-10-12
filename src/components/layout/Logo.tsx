type LogoProps = {
  className?: string;
  variant?: "wordmark" | "mark";
  size?: number;
};

/**
 * RosyAteliyer — animated, responsive brand lockup.
 *
 * The SVG crest draws on as the page appears, then a fine glint orbits it while
 * a satin-like highlight occasionally sweeps the wordmark. The mark-only
 * variant is used in the compact auth panels.
 */
export function Logo({ className = "", variant = "wordmark", size }: LogoProps) {
  const isMark = variant === "mark";

  return (
    <span
      className={`atelier-logo ${isMark ? "atelier-logo--mark" : "atelier-logo--wordmark"} ${className}`.trim()}
      style={isMark && size ? { width: size, height: size } : undefined}
      role="img"
      aria-label="RosyAteliyer"
      dir="ltr"
    >
      <svg
        className="atelier-logo__symbol"
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <circle
          className="atelier-logo__ring"
          cx="24"
          cy="24"
          r="20"
          pathLength="100"
        />
        <circle
          className="atelier-logo__orbit"
          cx="24"
          cy="24"
          r="20"
          pathLength="100"
        />
        <path
          className="atelier-logo__monogram"
          d="M17.5 33V15.5h7.2c3.5 0 5.8 2 5.8 4.9s-2.3 4.9-5.8 4.9h-7.2m7.1 0 7.2 7.7"
          pathLength="100"
        />
        <path
          className="atelier-logo__leaf"
          d="M29.8 13.7c.8-4.6 4.1-7.3 7.2-7.1.2 3.2-2.1 6.3-7.2 7.1Z"
        />
        <path className="atelier-logo__leaf-vein" d="M30.7 13.1c1.5-1.8 3.2-3.3 5.2-4.5" />
        <circle className="atelier-logo__seed" cx="9.1" cy="24" r="1.05" />
      </svg>

      {!isMark && (
        <span className="atelier-logo__wordmark" aria-hidden="true">
          <span className="atelier-logo__name">Rosy</span>
          <span className="atelier-logo__studio">Ateliyer</span>
          <span className="atelier-logo__rule" />
        </span>
      )}
    </span>
  );
}
