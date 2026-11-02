import Emberfall from "@/components/emberfall/emberfall";

export const metadata = {
  title: "Emberfall | FadeThat",
  description: "A small top-down bullet-hell RPG. Walk out from the Hearth, level up, loot stat shards, fell the Ember Sovereign.",
};

export default function EmberfallPage() {
  return (
    <main style={{ position: "fixed", inset: 0, overflow: "hidden" }}>
      <Emberfall />
    </main>
  );
}
