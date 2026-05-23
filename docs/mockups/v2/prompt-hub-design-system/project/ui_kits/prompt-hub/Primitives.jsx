/* global React */
const { useState, useEffect, useRef } = React;

/* =====================================================
   Icon — img-based wrapper for our lucide SVGs.
   Color is achieved via CSS filter (inversion); for solid
   tinting we'd swap to inline-SVG, but stroke-only icons
   look correct with invert filter against canvas.
   ===================================================== */
function Icon({ name, size = 16, className = "ic-inv", style }) {
  return (
    <img
      src={`../../assets/icons/${name}.svg`}
      width={size}
      height={size}
      className={className}
      alt=""
      draggable={false}
      style={style}
    />
  );
}

/* =====================================================
   Hotkey badge — supports compound combos like "⌘N" or "⌥Space"
   ===================================================== */
function Kbd({ children, sm }) {
  return <span className={`kbd${sm ? " kbd-sm" : ""}`}>{children}</span>;
}

/* =====================================================
   Region header (title · count · hint+hotkey)
   ===================================================== */
function RegionHeader({ title, count, hint, hotkey, right }) {
  return (
    <div className="region-header">
      <div className="left">
        <span className="title">{title}</span>
        {count != null && <span className="count">{count}</span>}
      </div>
      <div className="right">
        {right}
        {hint && <span className="hint">{hint}</span>}
        {hotkey && <Kbd>{hotkey}</Kbd>}
      </div>
    </div>
  );
}

/* =====================================================
   Empty state — sentence-fragment + optional hint
   ===================================================== */
function EmptyState({ children, hint, hotkey }) {
  return (
    <div className="empty">
      <div>{children}</div>
      {(hint || hotkey) && (
        <span className="hint">
          {hint && <span>{hint}</span>}
          {hotkey && <Kbd>{hotkey}</Kbd>}
        </span>
      )}
    </div>
  );
}

Object.assign(window, { Icon, Kbd, RegionHeader, EmptyState });
