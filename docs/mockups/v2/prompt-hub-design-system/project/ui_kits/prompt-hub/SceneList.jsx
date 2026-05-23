/* global React, RegionHeader, EmptyState */
function SceneRow({ scene, active, onSelect }) {
  return (
    <div
      className={`scene${active ? " active" : ""}`}
      role="row"
      onClick={() => onSelect(scene.id)}
    >
      <span className={`dot ${scene.state}`}></span>
      <span className="name">{scene.name}</span>
      <span className="path">{scene.path}</span>
      <span className="meta">{scene.duration}</span>
    </div>
  );
}

function SceneList({ scenes, activeId, onSelect }) {
  return (
    <section className="region" aria-label="Scenes">
      <RegionHeader
        title="Scenes"
        count={scenes.length > 0 ? `${scenes.length} · ${scenes[0]?.totalLabel || ""}` : 0}
        hint="filter"
        hotkey="/"
      />
      {scenes.length === 0 ? (
        <EmptyState hint="spawn" hotkey="⌘⇧N">No active scenes.</EmptyState>
      ) : (
        <div className="scene-list">
          {scenes.map((s) => (
            <SceneRow key={s.id} scene={s} active={s.id === activeId} onSelect={onSelect} />
          ))}
        </div>
      )}
    </section>
  );
}

Object.assign(window, { SceneList });
