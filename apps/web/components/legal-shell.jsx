export default function LegalShell({ className, children }) {
  return (
    <div className={className}>
      <main className="container">{children}</main>
    </div>
  );
}
