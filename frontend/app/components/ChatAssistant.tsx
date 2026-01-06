'use client';
import { useState, useEffect, useRef } from "react";

export default function ChatAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Hello! I am your Deal Assistant. How can I help you analyze this deal set today?' }
  ]);
  const [input, setQuery] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg = { role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setQuery("");

    // Simulate AI response based on deal context
    setTimeout(() => {
      let response = "I've analyzed the Deal Set. Could you be more specific? I can answer questions about covenants, cure periods, or assignments.";
      if (input.toLowerCase().includes('leverage')) response = "The Net Leverage covenant is defined in Section 7.02. The current limit is 4.0x, with a step-down to 3.5x after Year 2.";
      if (input.toLowerCase().includes('cure')) response = "According to Section 8.01, there is a 5-business day cure period for payment defaults and a 30-day period for other covenant breaches.";
      
      setMessages(prev => [...prev, { role: 'ai', text: response }]);
    }, 800);
  };

  return (
    <div style={{ position: 'fixed', bottom: 30, right: 30, zIndex: 1000 }}>
      {isOpen ? (
        <div className="card" style={{ width: 350, height: 500, display: 'flex', flexDirection: 'column', padding: 0, boxShadow: '0 10px 40px rgba(0,0,0,0.4)', border: '1px solid var(--accent-primary)' }}>
          <div className="flex justify-between items-center" style={{ padding: '12px 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ fontWeight: 600 }}>💬 Deal Assistant</span>
            <button className="btn-icon btn" onClick={() => setIsOpen(false)}>×</button>
          </div>
          
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === 'ai' ? 'flex-start' : 'flex-end', maxWidth: '85%' }}>
                <div className={`small ${m.role === 'ai' ? 'card-inner' : 'pill active'}`} style={{ padding: '8px 12px', borderRadius: 12, background: m.role === 'ai' ? 'var(--bg-elevated)' : 'var(--accent-primary)', color: m.role === 'ai' ? 'var(--text-primary)' : 'white' }}>
                  {m.text}
                </div>
              </div>
            ))}
          </div>
          
          <div className="flex gap-sm" style={{ padding: 12, borderTop: '1px solid var(--border-subtle)' }}>
            <input className="input" style={{ padding: '8px 12px', fontSize: 13 }} placeholder="Ask about this deal..." value={input} onChange={e => setQuery(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSend()} />
            <button className="btn primary" style={{ padding: '8px 12px' }} onClick={handleSend}>Send</button>
          </div>
        </div>
      ) : (
        <button className="btn primary" style={{ borderRadius: '50%', width: 60, height: 60, fontSize: 24, boxShadow: '0 8px 24px rgba(59, 130, 246, 0.4)' }} onClick={() => setIsOpen(true)}>
          💬
        </button>
      )}
    </div>
  );
}


