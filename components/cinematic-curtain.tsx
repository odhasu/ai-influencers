export function CinematicCurtain() {
  return (
    <div className="curtain" aria-hidden="true">
      <div className="curtain-tint" />
      <div className="curtain-panels">
        {Array.from({ length: 7 }, (_, index) => (
          <span className="curtain-panel" key={index} />
        ))}
      </div>
      <div className="curtain-fade" />
    </div>
  );
}
