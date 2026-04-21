export function HashStrip({
  hash,
  authored,
  revision,
}: {
  hash: string;
  authored: string;
  revision: string;
}) {
  return (
    <div className="fx-hash-strip" aria-label="Document integrity">
      <span>HASH · <strong>{hash}</strong></span>
      <span>FILED · <strong>{authored}</strong></span>
      <span>REV · <strong>{revision}</strong></span>
    </div>
  );
}
