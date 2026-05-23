/* global React, Kbd */
function StatusBar({ connected, model, phase, sceneCount, totalDuration, tokens }) {
  return (
    <div className="statusbar" role="status">
      <span className="grp">
        <span className={`dot ${connected ? "ok" : ""}`}></span>
        <span>{connected ? "connected" : "disconnected"}</span>
      </span>
      <span className="sep"></span>
      <span className="grp mono">{model}</span>
      <span className="sep"></span>
      <span className="grp"><span className="dot proto"></span><span>{phase}</span></span>
      <span className="sep"></span>
      <span className="grp mono">{sceneCount} scenes · {totalDuration}</span>
      <span className="spacer"></span>
      <span className="grp mono">{tokens.toLocaleString()} tokens</span>
      <span className="sep"></span>
      <span className="grp"><span>help</span><Kbd>?</Kbd></span>
    </div>
  );
}

Object.assign(window, { StatusBar });
