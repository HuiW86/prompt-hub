/* global React, RegionHeader */
function AuxRow({ label, value, isAux }) {
  return (
    <div className="row">
      <span className="lbl">{label}</span>
      <span className={`val${isAux ? " aux-c" : ""}`}>{value}</span>
    </div>
  );
}

function AuxPanel({ stats }) {
  return (
    <section className="region" aria-label="Aux metadata">
      <RegionHeader title="Context" right={null} />
      <div className="aux">
        <div className="group">
          <div className="key">session</div>
          <AuxRow label="Model"      value={stats.model} />
          <AuxRow label="Tokens"     value={stats.tokens.toLocaleString()} isAux />
          <AuxRow label="Cost"       value={`$${stats.cost.toFixed(2)}`} isAux />
          <AuxRow label="Uptime"     value={stats.uptime} isAux />
        </div>
        <div className="group">
          <div className="key">repo</div>
          <AuxRow label="Branch"      value={stats.branch} />
          <AuxRow label="Files dirty" value={stats.dirty} isAux />
          <AuxRow label="Last commit" value={stats.lastCommit} isAux />
        </div>
        <div className="group">
          <div className="key">recent</div>
          {stats.recent.map((r, i) => (
            <AuxRow key={i} label={r.label} value={r.ago} isAux />
          ))}
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { AuxPanel });
