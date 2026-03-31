import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import DMPanel from "../components/DMPanel.tsx";
import { getOrCreateConversation } from "../services/api.ts";
import useLoginContext from "../hooks/useLoginContext";

export default function DM() {
  const { username } = useParams();
  const { user, pass } = useLoginContext();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    async function loadConversation() {
      try {
        if (!username) {
          setError("No username provided");
          return;
        }

        const res = await getOrCreateConversation(
          { username: user.username, password: pass },
          username,
        );

        if ("error" in res) {
          setError(res.error);
          return;
        }

        setConversationId(res.id);
      } catch {
        setError("Failed to load conversation");
      }
    }

    void loadConversation();
  }, [username, user.username, pass]);

  if (error !== "") {
    return <p>{error}</p>;
  }

  if (!conversationId) {
    return <p>Loading...</p>;
  }

  return <DMPanel conversationId={conversationId} />;
}
