import Image from "next/image";
import Link from "next/link";

// Intrinsic pixel dimensions of the source PNGs.
const DIMS = {
  icon: { src: "/icon.png", w: 170, h: 140, alt: "JobBoard AI" },
  stacked: { src: "/stacked.png", w: 260, h: 260, alt: "JobBoard AI" },
  horizontal: { src: "/horizontal.png", w: 985, h: 280, alt: "JobBoard AI" },
};

/**
 * Shared logo component. Variants:
 *   - icon        : mark only, wrapped in a rounded squircle container
 *   - stacked     : mark above wordmark (tall)
 *   - horizontal  : mark + wordmark side-by-side (wide)
 *
 * Pick a `height` (in px). Width is derived from the source aspect ratio.
 * If `href` is null the component renders without a link; otherwise it wraps
 * the image in a Next <Link> to `href` (defaults to "/").
 */
export function Logo({
  variant = "horizontal",
  height = 28,
  className = "",
  href,
  priority = false,
  alt,
}) {
  const d = DIMS[variant] || DIMS.horizontal;

  let node;
  if (variant === "icon") {
    // Square squircle container. Icon art sits inside with ~12% padding so it
    // doesn't kiss the corners. Radius scales with size to stay squircle-y.
    const box = height;
    const pad = Math.max(4, Math.round(box * 0.14));
    const inner = box - pad * 2;
    const radius = Math.round(box * 0.26);

    node = (
      <span
        className={`relative inline-flex shrink-0 items-center justify-center bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06),0_8px_24px_-12px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/80 dark:bg-slate-100 dark:ring-slate-300/60 ${className}`}
        style={{
          width: box,
          height: box,
          borderRadius: radius,
          padding: pad,
        }}
      >
        <Image
          src={d.src}
          alt={alt ?? d.alt}
          width={inner}
          height={Math.round((inner * d.h) / d.w)}
          priority={priority}
          className="select-none object-contain"
          draggable={false}
        />
      </span>
    );
  } else {
    const aspect = d.w / d.h;
    const width = Math.round(height * aspect);
    node = (
      <Image
        src={d.src}
        alt={alt ?? d.alt}
        width={width}
        height={height}
        priority={priority}
        className={`select-none ${className}`}
        draggable={false}
      />
    );
  }

  if (href === null) return node;
  return (
    <Link href={href ?? "/"} className="inline-flex items-center" aria-label={d.alt}>
      {node}
    </Link>
  );
}

export default Logo;
