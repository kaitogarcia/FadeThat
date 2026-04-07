import Navbar from "@/components/navbar";

export default function PageShell({ children, showNav = true }) {
  return (
    <div className="shell">
      {showNav ? <Navbar /> : null}
      {children}
    </div>
  );
}
