export function EditorialStandard({
  standard = "Forensic Editorial v2",
  hashRef,
  updatedAt,
}: {
  standard?: string;
  hashRef?: string;
  updatedAt?: string;
}) {
  return (
    <footer className="fx-editorial-standard">
      <span>STANDARD · {standard}</span>
      {hashRef && <span>HASH · {hashRef.slice(0, 12)}…{hashRef.slice(-4)}</span>}
      {updatedAt && <span>UPDATED · {updatedAt}</span>}
    </footer>
  );
}
