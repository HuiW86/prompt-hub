/* global React, Icon, Kbd, RegionHeader, EmptyState */
const { useState } = React;

function MacroCard({ macro, onFire }) {
  const [pressing, setPressing] = useState(false);
  return (
    <button
      className={`macro${pressing ? " pressing" : ""}`}
      onMouseDown={() => setPressing(true)}
      onMouseUp={() => setPressing(false)}
      onMouseLeave={() => setPressing(false)}
      onClick={() => onFire(macro)}
    >
      <div className="row">
        <div className="title">{macro.title}</div>
        <Icon name={macro.icon} size={14} className="ic ic-inv" />
      </div>
      <div className="body">{macro.body}</div>
      <div className="meta">
        <Kbd sm>{macro.hotkey}</Kbd>
        <span className="sep">·</span>
        <span>{macro.uses} uses</span>
        <span className="sep">·</span>
        <span>{macro.lastUsed}</span>
      </div>
    </button>
  );
}

function MacroGrid({ macros, onFire }) {
  return (
    <section className="region" aria-label="Macros">
      <RegionHeader title="Macros" count={macros.length} hint="new" hotkey="⌘N" />
      {macros.length === 0 ? (
        <EmptyState hint="create" hotkey="⌘N">No macros.</EmptyState>
      ) : (
        <div className="macro-grid">
          {macros.map((m) => (
            <MacroCard key={m.id} macro={m} onFire={onFire} />
          ))}
        </div>
      )}
    </section>
  );
}

Object.assign(window, { MacroGrid });
