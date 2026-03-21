import { UnifiedLayout } from "@/components/layout/UnifiedLayout";
import { TutorChatbot } from "@/components/chat/TutorChatbot";

export default function ParentTutorPage() {
  return (
    <UnifiedLayout role="parent">
      <TutorChatbot title="Tutor" />
    </UnifiedLayout>
  );
}

