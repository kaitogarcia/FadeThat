import Navbar from "@/components/navbar";

export default function PageShell({ children }) {
  return (
    <div className="shell">
      <Navbar />
      {children}
    </div>
  );
}
