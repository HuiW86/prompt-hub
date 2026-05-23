/* global React */
/* Protocol-layer · alignment phrase chips */
function AlignmentPhrases({ phrases, activeIds, onToggle, onAdd }) {
  return (
    <div className="phrases" aria-label="Alignment phrases">
      <span className="label">aligned</span>
      {phrases.map((p) => (
        <button
          key={p.id}
          className={`chip${activeIds.includes(p.id) ? " active" : " dim"}`}
          onClick={() => onToggle(p.id)}
        >
          <span className="dot"></span>
          {p.label}
        </button>
      ))}
      <button className="chip add-chip" onClick={onAdd}>
        <span className="add">+</span> phrase
      </button>
    </div>
  );
}

Object.assign(window, { AlignmentPhrases });
