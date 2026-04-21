export function Colophon({ text }: { text?: string }) {
  return (
    <footer className="fx-colophon">
      <div className="fx-container fx-colophon-inner">
        {text ?? "INTERLIGENS · FORENSIC INTELLIGENCE PLATFORM · BETA 2026"}
      </div>
    </footer>
  );
}
