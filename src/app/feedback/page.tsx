import { AppHeader } from "@/components/AppHeader";
import { FeedbackSection } from "@/components/FeedbackSection";

// Guest-accessible — the feedback table's RLS already models this: anyone can submit, and only
// approved rows are ever publicly readable, so there's nothing here to gate behind sign-in.
export default function FeedbackPage() {
  return (
    <>
      <AppHeader />
      <main style={{ flex: 1, padding: "1.5rem", maxWidth: 700, margin: "0 auto", width: "100%" }}>
        <FeedbackSection />
      </main>
    </>
  );
}
