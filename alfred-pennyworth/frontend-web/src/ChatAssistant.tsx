import { useState, useRef, useEffect, useCallback } from 'react';
import { chatMessage } from './api';

interface Msg { role: 'user' | 'assistant'; text: string; }

const STARTERS = [
  'What should I eat right now?',
  'How is my hydration today?',
  'Am I getting enough sleep?',
  'How do I boost my energy?',
];

export default function ChatAssistant({ userId }: { userId: number }) {
  const [open, setOpen]       = useState(false);
  const [msgs, setMsgs]       = useState<Msg[]>([]);
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef             = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, open]);

  const send = useCallback(async (text: string) => {
    const msg = text.trim();
    if (!msg || loading) return;
    setInput('');
    setMsgs((m) => [...m, { role: 'user', text: msg }]);
    setLoading(true);
    try {
      const res = await chatMessage(msg, userId);
      setMsgs((m) => [...m, { role: 'assistant', text: res.reply }]);
    } catch {
      setMsgs((m) => [...m, { role: 'assistant', text: "Sorry, I'm having trouble connecting right now." }]);
    } finally {
      setLoading(false);
    }
  }, [loading, userId]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  return (
    <>
      {/* Floating toggle */}
      <button
        className={`chat-toggle ${open ? 'chat-toggle--open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        title="Chat with Alfred"
        aria-label="Open Alfred chat"
      >
        {open ? '✕' : '✦'}
      </button>

      {/* Panel */}
      <div className={`chat-panel ${open ? 'chat-panel--open' : ''}`} role="dialog" aria-label="Alfred AI Chat">
        <div className="chat-header">
          <div className="chat-header-brand">
            <span className="chat-orb">✦</span>
            <div>
              <p className="chat-title">Alfred</p>
              <p className="chat-subtitle">Your wellness assistant</p>
            </div>
          </div>
          <button className="chat-close" onClick={() => setOpen(false)}>✕</button>
        </div>

        <div className="chat-body">
          {msgs.length === 0 && (
            <div className="chat-empty">
              <p className="chat-empty-title">Ask me anything about your health</p>
              <div className="chat-starters">
                {STARTERS.map((s) => (
                  <button key={s} className="chat-starter" onClick={() => send(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}

          {msgs.map((m, i) => (
            <div key={i} className={`chat-msg chat-msg--${m.role}`}>
              {m.role === 'assistant' && <span className="chat-msg-icon">✦</span>}
              <p className="chat-msg-text">{m.text}</p>
            </div>
          ))}

          {loading && (
            <div className="chat-msg chat-msg--assistant">
              <span className="chat-msg-icon">✦</span>
              <div className="chat-typing">
                <span /><span /><span />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="chat-footer">
          <input
            className="chat-input"
            placeholder="Ask Alfred…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            disabled={loading}
          />
          <button
            className="chat-send"
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            aria-label="Send"
          >↑</button>
        </div>
      </div>
    </>
  );
}
