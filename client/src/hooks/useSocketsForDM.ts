import { useEffect, useState } from "react";
import useLoginContext from "./useLoginContext.ts";
import useAuth from "./useAuth.ts";
import type { ChatMessage } from "../util/types.ts";
import type { SafeUserInfo } from "@gamenite/shared";

type DmMessage = {
  id: string;
  text: string;
  sender: SafeUserInfo;
  createdAt: Date | string;
};

type DmJoinedPayload = {
  conversationId: string;
  messages: DmMessage[];
};

type DmNewMessagePayload = {
  conversationId: string;
  message: DmMessage;
};

function toChatMessage(message: DmMessage): ChatMessage {
  return {
    messageId: message.id,
    text: message.text,
    createdBy: message.sender,
    createdAt: new Date(message.createdAt),
  };
}

export default function useSocketsForDM(conversationId: string) {
  const auth = useAuth();
  const { socket } = useLoginContext();
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);

  useEffect(() => {
    const handleDmJoined = (payload: DmJoinedPayload) => {
      if (payload.conversationId !== conversationId) return;
      socket.off("dmJoined", handleDmJoined);
      setMessages(payload.messages.map(toChatMessage));
      socket.on("dmNewMessage", handleDmNewMessage);
    };

    const handleDmNewMessage = (payload: DmNewMessagePayload) => {
      if (payload.conversationId !== conversationId) return;
      setMessages((oldMessages) => {
        if (!oldMessages) return null;
        return [...oldMessages, toChatMessage(payload.message)];
      });
    };

    socket.emit("dmJoin", { auth, payload: { conversationId } });
    socket.on("dmJoined", handleDmJoined);

    return () => {
      socket.off("dmJoined", handleDmJoined);
      socket.off("dmNewMessage", handleDmNewMessage);
      socket.emit("dmLeave", { auth, payload: { conversationId } });
    };
  }, [socket, auth, conversationId]);

  function handleMessageCreation(text: string) {
    socket.emit("dmSendMessage", { auth, payload: { conversationId, text } });
  }

  return { messages, handleMessageCreation };
}
