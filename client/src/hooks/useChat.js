import { useState, useEffect, useCallback } from "react";
import { useSocket } from "../context/SocketContext";

export function useChat(roomId, userName) {
  const socket = useSocket();
  const [messages, setMessages] = useState([]);
  const [unread, setUnread] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    if (!socket) return;

    socket.on("chat-message", (msg) => {
      setMessages((prev) => [...prev, msg]);
      if (!chatOpen) setUnread((n) => n + 1);
    });

    return () => socket.off("chat-message");
  }, [socket, chatOpen]);

  const sendMessage = useCallback(
    (message) => {
      if (!message.trim()) return;
      socket.emit("chat-message", { roomId, message, userName });
    },
    [socket, roomId, userName]
  );

  const openChat = useCallback(() => {
    setChatOpen(true);
    setUnread(0);
  }, []);

  const closeChat = useCallback(() => setChatOpen(false), []);

  return { messages, unread, chatOpen, sendMessage, openChat, closeChat };
}
