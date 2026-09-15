import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { JourneyHome } from "@/components/JourneyHome";
import { ChatbotWidget } from "@/components/ChatbotWidget";

// Guest-accessible: route search, live safety scores, and map layers don't need an account.
// Actions that write to a personal account (saving a contact, triggering SOS) are gated
// individually, at the point of use, via AuthModal — not by blocking this whole page.
export default function JourneyPage() {
  return (
    <>
      <AppHeader />
      {/* JourneyHome reads ?origin=&destination= via useSearchParams (to pre-fill/auto-run a
          search when arriving from About's journey preview card), which Next.js requires to be
          inside a Suspense boundary. */}
      <Suspense fallback={null}>
        <JourneyHome />
      </Suspense>
      <ChatbotWidget />
    </>
  );
}
