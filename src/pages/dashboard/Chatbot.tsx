import { UnifiedLayout } from "@/components/layout/UnifiedLayout";
import { Chatbot } from "@/components/chat/Chatbot";

export default function DashboardChatbot() {
  return (
    <UnifiedLayout role="admin">
      <Chatbot title="School Chatbot (School Admin Scope)" />
    </UnifiedLayout>
  );
}

