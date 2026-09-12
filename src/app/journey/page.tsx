import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { JourneyHome } from "@/components/JourneyHome";
import { ChatbotWidget } from "@/components/ChatbotWidget";

export default async function JourneyPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth");

  return (
    <>
      <AppHeader />
      <JourneyHome />
      <ChatbotWidget />
    </>
  );
}
