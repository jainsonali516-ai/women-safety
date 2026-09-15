"use client";

import { useLanguage } from "@/components/LanguageProvider";
import { useTranslated } from "@/components/Translated";

/** "Walk your city," / "fearlessly." reads as one sentence, split only for a two-tone color
 * effect — translating the two fragments independently (as two separate <T> calls) strips the
 * comma's grammatical link between them and reads noticeably worse in Hindi/etc. than translating
 * the whole sentence at once. English keeps the free two-tone split; every other language renders
 * the single, fully-translated sentence instead. */
export function HomeHeroHeadline() {
  const { language } = useLanguage();
  const translated = useTranslated("Walk your city, fearlessly.");

  if (language === "en") {
    return (
      <>
        Walk your city,
        <br />
        <span style={{ color: "var(--brand-pink)" }}>fearlessly.</span>
      </>
    );
  }
  return <>{translated}</>;
}
