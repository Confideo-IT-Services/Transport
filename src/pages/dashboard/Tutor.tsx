import { UnifiedLayout } from "@/components/layout/UnifiedLayout";
import { TutorChatbot } from "@/components/chat/TutorChatbot";

export default function TeacherTutorPage() {
  return (
    <UnifiedLayout role="teacher">
      <TutorChatbot title="Tutor" />
    </UnifiedLayout>
  );
}

