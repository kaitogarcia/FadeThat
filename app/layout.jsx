import "./globals.css";
import PointerTracker from "@/components/pointer-tracker";
import localFont from "next/font/local";

const griffo = localFont({
  src: "./fonts/GriffosFont.ttf",
  variable: "--font-griffo",
  display: "swap",
});

const griffoSCaps = localFont({
  src: "./fonts/GriffosSCapsFont.ttf",
  variable: "--font-griffo-scaps",
  display: "swap",
});

const apercuMonoRegular = localFont({
  src: "./fonts/ApercuMonoProRegular.ttf",
  variable: "--font-apercu-mono",
  display: "swap",
});

export const metadata = {
  title: "FadeThat",
  description: "FadeThat website and internal tools",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${griffo.variable} ${griffoSCaps.variable} ${apercuMonoRegular.variable}`}>
        <PointerTracker />
        {children}
      </body>
    </html>
  );
}
