import { cookies } from "next/headers";
import Hero from "./Hero";
import HeroVariantB from "./HeroVariantB";

export default async function HeroSwitcher() {
  const store = await cookies();
  const variant = store.get("aiteam-variant")?.value;
  if (variant === "B") return <HeroVariantB />;
  return <Hero />;
}
