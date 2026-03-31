import MessageCreation from "./MessageCreation.tsx";
import MessageList from "./MessageList.tsx";
import useSocketsForDM from "../hooks/useSocketsForDM.ts";

interface DMPanelProps {
  conversationId: string;
}

export default function DMPanel({ conversationId }: DMPanelProps) {
  const { messages, handleMessageCreation } = useSocketsForDM(conversationId);

  return (
    messages && (
      <div className="chatContainer">
        <MessageList messages={messages} />
        <MessageCreation handleMessageCreation={handleMessageCreation} />
      </div>
    )
  );
}
