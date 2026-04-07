import Navbar from "@/components/navbar";

export default function LegalShell({ className, children }) {
  return (
    <div className={className}>
      <div className="shell">
        <Navbar />
      </div>
      <main className="container">{children}</main>
    </div>
  );
}
