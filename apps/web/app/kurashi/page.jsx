import localFont from "next/font/local";
import PageShell from "@/components/page-shell";
import Kurashi from "@/components/kurashi/kurashi";
import kurashiData from "@/data/kurashi.json";
import s from "@/components/kurashi/kurashi.module.css";

// Same display face as /goals; Japanese falls through to the system Hiragino / Noto.
const kurashiFont = localFont({
  src: "../fonts/Arimo-Variable-latin.woff2",
  variable: "--font-kurashi",
  weight: "400 700",
  display: "swap",
});

export const metadata = {
  title: "Kurashi | FadeThat",
  description: "To-do lists for any term, and a budget book that reads receipts and screenshots.",
};

export default function KurashiPage() {
  return (
    <div className={`${s.page} ${kurashiFont.variable}`}>
      <PageShell>
        <Kurashi initialData={kurashiData} />
      </PageShell>
    </div>
  );
}
