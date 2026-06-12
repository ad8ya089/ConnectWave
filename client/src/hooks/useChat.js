// client/src/hooks/useChat.js
import { useState, useEffect, useRef, useCallback } from 'react';
import { io as ioClient } from 'socket.io-client';
import { fetchHistory }   from '../services/chatApi';

const CHAT_SERVICE_URL = import.meta.env.VITE_CHAT_SERVICE_URL || 'http://localhost:4002';

// How long after the user stops typing before we emit typing-stop (ms)
const TYPING_DEBOUNCE_MS = 800;

// useChat
//
// Connects to the Chat Service /chat namespace.
// Manages: messages, history, typing indicators, reactions, read receipts.
//
// Parameters:
//   roomId:    string
//   userName:  string
//   joinToken: string — Room Service JWT, sent to Chat Service for auth

export const useChat = ({ roomId, userName, joinToken }) => {
  const [messages,         setMessages]         = useState([]);
  const [typingUsers,      setTypingUsers]       = useState({}); // { socketId: userName }
  const [historyLoading,   setHistoryLoading]    = useState(true);
  const [loadingMore,      setLoadingMore]       = useState(false);
  const [hasMore,          setHasMore]           = useState(true);
  const [chatError,        setChatError]         = useState(null);
  // The chat socket's own id. Messages carry the chat socket id (NOT the
  // signaling socket id), so the UI must compare against this to detect
  // the local user's own messages.
  const [chatSocketId,     setChatSocketId]      = useState(null);

  const chatSocketRef  = useRef(null);
  const typingTimerRef = useRef(null);
  const isTypingRef    = useRef(false);

  // ── Connect to Chat Service ────────────────────────────────────────────────

  useEffect(() => {
    if (!roomId || !userName) return;

    const chatSocket = ioClient(`${CHAT_SERVICE_URL}/chat`, {
      auth: { chatToken: joinToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    chatSocketRef.current = chatSocket;

    chatSocket.on('connect', () => {
      setChatSocketId(chatSocket.id);
      // Join the chat room and receive history
      chatSocket.emit('chat-join', { roomId, userName, chatToken: joinToken });
    });

    chatSocket.on('connect_error', (err) => {
      console.error('[useChat] Connection error:', err.message);
      setChatError('Chat connection failed. Messages may not be delivered.');
    });

    // ── Incoming events ──────────────────────────────────────────────────────

    // Full history on join
    chatSocket.on('chat-history', ({ messages: history }) => {
      setMessages(history);
      setHistoryLoading(false);
    });

    // New message (from any participant including self — server echoes back)
    chatSocket.on('chat-message', (message) => {
      setMessages((prev) => {
        // De-duplicate by ID — server may echo before the optimistic update resolves
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
    });

    // Typing indicator map
    chatSocket.on('typing-update', ({ typing }) => {
      setTypingUsers(typing || {});
    });

    // Reaction count update
    chatSocket.on('reaction-update', ({ messageId, emoji, count }) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== messageId) return msg;
          return {
            ...msg,
            reactions: { ...msg.reactions, [emoji]: count },
          };
        })
      );
    });

    // Read receipt (optional — used for "seen" indicators)
    chatSocket.on('read-receipt', ({ socketId, userName: readerName, messageId }) => {
      // Mark the message as read by this user
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== messageId) return msg;
          const seenBy = msg.seenBy || {};
          return { ...msg, seenBy: { ...seenBy, [socketId]: readerName } };
        })
      );
    });

    chatSocket.on('chat-error', ({ message }) => {
      setChatError(message);
    });

    return () => {
      chatSocket.disconnect();
      chatSocketRef.current = null;
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [roomId, userName, joinToken]);

  // ── Send a message ─────────────────────────────────────────────────────────

  const sendMessage = useCallback((content) => {
    const socket = chatSocketRef.current;
    if (!socket || !content.trim()) return;

    socket.emit('chat-message', {
      roomId,
      content: content.trim(),
      userName,
    });

    // Stop typing when message is sent
    if (isTypingRef.current) {
      isTypingRef.current = false;
      socket.emit('typing-stop', { roomId });
    }
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
  }, [roomId, userName]);

  // ── Typing indicator ───────────────────────────────────────────────────────
  // Call this on every keystroke in the chat input.
  // Debounced — emits typing-stop automatically after TYPING_DEBOUNCE_MS of silence.

  const onTyping = useCallback(() => {
    const socket = chatSocketRef.current;
    if (!socket) return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit('typing-start', { roomId, userName });
    }

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      socket.emit('typing-stop', { roomId });
      typingTimerRef.current = null;
    }, TYPING_DEBOUNCE_MS);
  }, [roomId, userName]);

  // ── Send a reaction ────────────────────────────────────────────────────────

  const sendReaction = useCallback((messageId, emoji, action = 'add') => {
    const socket = chatSocketRef.current;
    if (!socket) return;
    socket.emit('message-react', { roomId, messageId, emoji, action });
  }, [roomId]);

  // ── Send a read receipt ────────────────────────────────────────────────────

  const sendReadReceipt = useCallback((messageId) => {
    const socket = chatSocketRef.current;
    if (!socket) return;
    socket.emit('read-receipt', { roomId, messageId });
  }, [roomId]);

  // ── Load older messages (infinite scroll) ──────────────────────────────────

  const loadMoreHistory = useCallback(async () => {
    if (loadingMore || !hasMore || messages.length === 0) return;

    setLoadingMore(true);
    try {
      const oldest    = messages[0];
      const { messages: older, hasMore: moreAvailable } = await fetchHistory(roomId, {
        before: oldest.timestamp,
        limit: 50,
      });

      setMessages((prev) => {
        // Prepend older messages, de-duplicate
        const existingIds = new Set(prev.map((m) => m.id));
        const newOnes     = older.filter((m) => !existingIds.has(m.id));
        return [...newOnes, ...prev];
      });
      setHasMore(moreAvailable);
    } catch (err) {
      console.error('[useChat] loadMoreHistory failed:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [roomId, messages, loadingMore, hasMore]);

  // ── Derive typing display string ───────────────────────────────────────────
  // Exclude self from typing display (socket.id comparison not available here,
  // so we exclude by userName match — good enough for display purposes)

  const typingDisplay = Object.values(typingUsers)
    .filter((name) => name !== userName)
    .slice(0, 3); // show at most 3 typing names

  return {
    messages,
    typingUsers,
    typingDisplay,
    historyLoading,
    loadingMore,
    hasMore,
    chatError,
    chatSocketId,
    sendMessage,
    onTyping,
    sendReaction,
    sendReadReceipt,
    loadMoreHistory,
  };
};
