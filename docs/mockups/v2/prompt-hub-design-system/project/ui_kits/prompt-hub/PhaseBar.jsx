/* global React */
/* Protocol-layer · phase segmented bar */
function PhaseBar({ phases, activeId, onSelect }) {
  return (
    <div className="phasebar" role="tablist" aria-label="Protocol phase">
      {phases.map((p, i) => (
        <button
          key={p.id}
          role="tab"
          aria-selected={p.id === activeId}
          className={`phase${p.id === activeId ? " active" : ""}`}
          onClick={() => onSelect(p.id)}
        >
          <span className="num">{i + 1}</span>
          <span>{p.label}</span>
          <span className="timer">{p.timer}</span>
        </button>
      ))}
    </div>
  );
}

Object.assign(window, { PhaseBar });
