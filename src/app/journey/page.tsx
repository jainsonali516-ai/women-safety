import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { JourneyHome } from "@/components/JourneyHome";
import { ChatbotWidget } from "@/components/ChatbotWidget";

export default async function JourneyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  return (
    <>
      <AppHeader />
      <JourneyHome />
      <ChatbotWidget />
    </>
  );
}
