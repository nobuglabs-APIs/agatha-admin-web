export function Brand({ tagline = 'Admin · Nobug Labs' }: { tagline?: string }) {
  return (
    <div className="brand">
      <span className="brand__mark" aria-hidden="true">
        <img src="/brand/agata-mark.png" alt="" />
      </span>
      <span className="brand__copy">
        <strong>Ágata</strong>
        <small>{tagline}</small>
      </span>
    </div>
  );
}
