import "./globals.css";
import PointerTracker from "@/components/pointer-tracker";

export const metadata = {
  title: "FadeThat",
  description: "FadeThat website and internal tools",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <PointerTracker />
        {children}
      </body>
    </html>
  );
}
