// client/src/components/ChatPanel.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import styles      from './ChatPanel.module.css';
import ChatMessage from './ChatMessage';

export default function ChatPanel({
  messages,
  typingDisplay,      // string[] — names of currently typing users
  historyLoading,
  loadingMore,
  hasMore,
  onSendMessage,
  onTyping,
  onReact,
  onLoadMore,
  onReadReceipt,
  mySocketId,
  userName,
}) {
  const [inputValue,  setInputValue]  = useState('');
  const bottomRef  = useRef(null);
  const listRef    = useRef(null);
  const prevLenRef = useRef(0);

  // Track which emojis the local user has reacted to — { messageId: Set<emoji> }
  const [myReactions, setMyReactions] = useState({});

  // Auto-scroll to bottom when new messages arrive (but not when loading history)
  useEffect(() => {
    const newMessages = messages.length > prevLenRef.current;
    prevLenRef.current = messages.length;
    if (newMessages && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  // Send read receipt for the last message when panel is visible
  useEffect(() => {
    if (messages.length === 0 || !onReadReceipt) return;
    const last = messages[messages.length - 1];
    if (last.socketId !== mySocketId) {
      onReadReceipt(last.id);
    }
  }, [messages, mySocketId, onReadReceipt]);

  // Handle load-more when scrolled to top
  const handleScroll = useCallback(() => {
    if (!listRef.current || loadingMore || !hasMore) return;
    if (listRef.current.scrollTop < 40) {
      onLoadMore?.();
    }
  }, [loadingMore, hasMore, onLoadMore]);

  const handleSend = () => {
    if (!inputValue.trim()) return;
    onSendMessage(inputValue);
    setInputValue('');
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    onTyping?.();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReact = (messageId, emoji, action) => {
    onReact?.(messageId, emoji, action);
    setMyReactions((prev) => {
      const existing = new Set(prev[messageId] || []);
      if (action === 'add')    existing.add(emoji);
      if (action === 'remove') existing.delete(emoji);
      return { ...prev, [messageId]: existing };
    });
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>Chat</span>
        <span className={styles.count}>{messages.length}</span>
      </div>

      <div className={styles.messageList} ref={listRef} onScroll={handleScroll}>
        {/* Load more button at top */}
        {hasMore && (
          <div className={styles.loadMore}>
            <button
              className={styles.loadMoreBtn}
              onClick={onLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? 'Loading...' : '↑ Load earlier messages'}
            </button>
          </div>
        )}

        {/* History loading skeleton */}
        {historyLoading && (
          <div className={styles.historyLoading}>
            {[1, 2, 3].map((i) => (
              <div key={i} className={styles.skeletonMsg} style={{ width: `${50 + i * 15}%` }} />
            ))}
          </div>
        )}

        {/* Messages */}
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            isOwn={msg.socketId === mySocketId}
            onReact={handleReact}
            myReactions={myReactions[msg.id]}
          />
        ))}

        {/* Typing indicator */}
        {typingDisplay.length > 0 && (
          <div className={styles.typingIndicator}>
            <span className={styles.typingDots}>
              <span /><span /><span />
            </span>
            <span className={styles.typingText}>
              {typingDisplay.length === 1
                ? `${typingDisplay[0]} is typing`
                : `${typingDisplay.slice(0, -1).join(', ')} and ${typingDisplay[typingDisplay.length - 1]} are typing`}
            </span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className={styles.inputArea}>
        <textarea
          className={styles.input}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Message everyone... (Enter to send)"
          rows={1}
          maxLength={500}
        />
        <button
          className={styles.sendBtn}
          onClick={handleSend}
          disabled={!inputValue.trim()}
          aria-label="Send message"
        >
          ➤
        </button>
      </div>
    </div>
  );
}
