'use client';
import { useState, useEffect, useRef, useId } from "react";
import { API_BASE } from "../../lib/api";
import { useLoan } from "../../lib/LoanContext";
import { 
  X, 
  Send, 
  Mic, 
  MicOff, 
  MessageCircle, 
  Zap,
  FileText,
  Scale,
  Leaf,
  AlertTriangle,
  Bot,
  User
} from 'lucide-react';

interface Message {
  role: 'user' | 'ai';
  text: string;
  isLoading?: boolean;
}

// LMA Heart Icon - 3D Premium heart shape with MA
const LMAIcon = ({ size = 48 }: { size?: number }) => {
  const gradientId = useId();
  return (
    <div style={{
      perspective: '1000px',
      transformStyle: 'preserve-3d',
      transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
      display: 'inline-block'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'rotateY(20deg) rotateX(-10deg) scale(1.1)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'rotateY(0deg) rotateX(0deg) scale(1)';
    }}
    >
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 100 100" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg" 
        style={{ 
          display: 'block',
          filter: 'drop-shadow(0 12px 24px rgba(236, 72, 153, 0.5))',
          transform: 'translateZ(30px)'
        }}
      >
        <defs>
          <linearGradient id={`lma-gradient-${gradientId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#EC4899" />
            <stop offset="50%" stopColor="#F43F5E" />
            <stop offset="100%" stopColor="#DC2626" />
          </linearGradient>
          <linearGradient id={`lma-gradient-light-${gradientId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F9A8D4" />
            <stop offset="100%" stopColor="#EC4899" />
          </linearGradient>
          <filter id={`lma-glow-${gradientId}`}>
            <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          {/* 3D Shadow */}
          <radialGradient id={`lma-shadow-${gradientId}`} cx="50%" cy="50%">
            <stop offset="0%" stopColor="rgba(236, 72, 153, 0.4)" />
            <stop offset="100%" stopColor="rgba(236, 72, 153, 0)" />
          </radialGradient>
        </defs>
        
        {/* 3D Shadow beneath */}
        <ellipse 
          cx="50" 
          cy="95" 
          rx="35" 
          ry="8" 
          fill={`url(#lma-shadow-${gradientId})`} 
          opacity="0.6"
          style={{ transform: 'translateZ(-20px)' }}
        />
        
        {/* Main heart shape with 3D depth */}
        <path 
          d="M50 85 C20 55, 5 35, 15 22 C25 9, 40 9, 50 22 C60 9, 75 9, 85 22 C95 35, 80 55, 50 85Z"
          fill={`url(#lma-gradient-${gradientId})`}
          filter={`url(#lma-glow-${gradientId})`}
          style={{ transform: 'translateZ(20px)' }}
        />
        
        {/* Highlight for 3D effect (top-left) */}
        <path 
          d="M50 22 C40 9, 25 9, 15 22 C5 35, 20 55, 50 85 C50 50, 50 30, 50 22Z"
          fill={`url(#lma-gradient-light-${gradientId})`}
          fillOpacity="0.4"
          style={{ transform: 'translateZ(25px)' }}
        />
        
        {/* MA text with 3D effect */}
        <text 
          x="50" 
          y="48" 
          textAnchor="middle" 
          dominantBaseline="middle"
          fontFamily="system-ui, -apple-system, sans-serif" 
          fontSize="18" 
          fontWeight="900" 
          fill="white"
          style={{ 
            textShadow: '0 2px 8px rgba(0,0,0,0.5), 0 0 12px rgba(255,255,255,0.3)',
            transform: 'translateZ(30px)'
          }}
        >
          MA
        </text>
      </svg>
    </div>
  );
};

export default function LMAAssistant() {
  const { activeLoanId, loanName } = useLoan();
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'chat' | 'voice'>('chat');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: '**LMA Assistant**\n\nI can analyze your deal documents and answer questions about:\n• Covenants & financial terms\n• Transfer restrictions\n• ESG/Sustainability KPIs\n• Cure periods & defaults\n\nHow can I help you today?' }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onresult = (event: any) => {
          const current = event.resultIndex;
          const transcriptText = event.results[current][0].transcript;
          setTranscript(transcriptText);
          
          // If final result, send the message
          if (event.results[current].isFinal) {
            setInput(transcriptText);
            setTranscript("");
          }
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
          
          let errorMessage = 'Voice input failed';
          if (event.error === 'not-allowed') {
            errorMessage = '🎤 Microphone access denied. Please allow microphone permission in your browser settings.';
          } else if (event.error === 'no-speech') {
            errorMessage = 'No speech detected. Please try again.';
          } else if (event.error === 'network') {
            errorMessage = 'Network error. Check your connection.';
          }
          
          window.dispatchEvent(new CustomEvent('loantwin-toast', { 
            detail: { message: errorMessage, type: 'error' } 
          }));
        };
      }
    }
  }, []);

  // Speak text using browser TTS
  const speakText = (text: string) => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      
      // Clean text of markdown
      const cleanText = text
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\n/g, ' ')
        .replace(/• /g, ', ');
      
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      // Try to use a good voice
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => 
        v.name.includes('Samantha') || 
        v.name.includes('Google') || 
        v.name.includes('Microsoft')
      );
      if (preferredVoice) utterance.voice = preferredVoice;
      
      window.speechSynthesis.speak(utterance);
    }
  };

  const quickQuestions = [
    { icon: FileText, label: "Financial covenants" },
    { icon: Scale, label: "Transfer restrictions" },
    { icon: Leaf, label: "ESG KPIs" },
    { icon: AlertTriangle, label: "Cure periods" }
  ];

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage = input;
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setInput("");
    setIsLoading(true);
    setMessages(prev => [...prev, { role: 'ai', text: '', isLoading: true }]);

    try {
      if (!activeLoanId) {
        setMessages(prev => {
          const msgs = [...prev];
          msgs[msgs.length - 1] = { 
            role: 'ai', 
            text: '**No deal loaded**\n\nPlease load a deal first by clicking "Try with Sample Deal" on the dashboard, or create a new workspace and upload your PDFs.' 
          };
          return msgs;
        });
        return;
      }

      const res = await fetch(`${API_BASE}/api/loans/${activeLoanId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage })
      });

      const data = await res.json();
      const answer = data.answer || 'I couldn\'t find relevant information for that query.';
      
      setMessages(prev => {
        const msgs = [...prev];
        msgs[msgs.length - 1] = { 
          role: 'ai', 
          text: answer 
        };
        return msgs;
      });

      // Speak the response if in voice mode
      if (mode === 'voice') {
        speakText(answer);
      }
    } catch (e: any) {
      setMessages(prev => {
        const msgs = [...prev];
        msgs[msgs.length - 1] = { role: 'ai', text: `**Error:** ${e.message}` };
        return msgs;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceToggle = async () => {
    if (!recognitionRef.current) {
      window.dispatchEvent(new CustomEvent('loantwin-toast', { 
        detail: { message: 'Speech recognition not supported in this browser', type: 'error' } 
      }));
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      setTranscript("");
    } else {
      // Request microphone permission first
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        setIsListening(true);
        setTranscript("");
        recognitionRef.current.start();
        window.dispatchEvent(new CustomEvent('loantwin-toast', { 
          detail: { message: '🎤 Listening... Speak now', type: 'info' } 
        }));
      } catch (err: any) {
        console.error('Microphone permission error:', err);
        window.dispatchEvent(new CustomEvent('loantwin-toast', { 
          detail: { 
            message: '🎤 Microphone access required. Click the mic icon in your browser\'s address bar to allow.', 
            type: 'warning' 
          } 
        }));
      }
    }
  };

  // Render simple markdown
  const renderMarkdown = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>')
      .replace(/• /g, '<br/>• ');
  };

  return (
    <div className="lma-assistant-container">
      {isOpen ? (
        <div className="lma-assistant-panel scale-in">
          {/* Header */}
          <div className="lma-assistant-header">
            <div className="flex items-center gap-sm">
              <div className="lma-assistant-icon-large">
                <LMAIcon size={36} />
                <span className="lma-online-indicator" />
              </div>
              <div>
                <div className="h3" style={{ margin: 0, color: 'var(--text-primary)' }}>LMA Assistant</div>
                <div className="small opacity-60">
                  {activeLoanId ? `Active: ${loanName || `Deal #${activeLoanId}`}` : 'No deal loaded'}
                </div>
              </div>
            </div>
            <button className="btn-icon" onClick={() => setIsOpen(false)} style={{ border: 'none' }}>
              <X size={18} />
            </button>
          </div>

          {/* Mode Switcher */}
          <div className="lma-mode-switcher">
            <button 
              className={`lma-mode-btn ${mode === 'chat' ? 'active' : ''}`} 
              onClick={() => setMode('chat')}
            >
              <MessageCircle size={14} /> Chat
            </button>
            <button 
              className={`lma-mode-btn ${mode === 'voice' ? 'active' : ''}`} 
              onClick={() => setMode('voice')}
            >
              <Mic size={14} /> Voice
            </button>
          </div>

          {/* Chat Body */}
          <div ref={scrollRef} className="lma-chat-body">
            {messages.map((msg, index) => (
              <div key={index} className={`lma-message ${msg.role} fade-in`}>
                <div className="lma-avatar">
                  {msg.role === 'user' ? (
                    <User size={16} style={{ color: 'var(--accent-secondary)' }} />
                  ) : (
                    <Bot size={16} style={{ color: 'var(--accent-secondary)' }} />
                  )}
                </div>
                <div className="lma-message-bubble">
                  {msg.isLoading ? (
                    <div className="flex items-center gap-sm">
                      <span className="spinner" style={{ width: 16, height: 16 }} />
                      <span className="small opacity-60">Thinking...</span>
                    </div>
                  ) : (
                    <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }} />
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Input Area */}
          <div className="lma-input-area">
            {mode === 'chat' ? (
              <>
                {/* Quick Questions */}
                <div className="lma-quick-questions">
                  {quickQuestions.map((q, idx) => {
                    const IconComponent = q.icon;
                    return (
                      <button 
                        key={idx} 
                        className="btn secondary"
                        style={{ padding: '4px 8px', fontSize: 11, height: 'auto' }}
                        onClick={() => setInput(q.label)}
                        disabled={isLoading}
                      >
                        <IconComponent size={12} />
                        {q.label}
                      </button>
                    );
                  })}
                </div>
                {/* Input */}
                <div className="flex gap-sm mt-sm">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Ask about your loan..."
                    className="input"
                    disabled={isLoading}
                    style={{ fontSize: 14 }}
                  />
                  <button 
                    className="btn primary" 
                    onClick={handleSend} 
                    disabled={isLoading || !input.trim()}
                    style={{ padding: '0 12px' }}
                  >
                    {isLoading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <Send size={16} />}
                  </button>
                </div>
              </>
            ) : (
              <div className="lma-voice-input-area">
                <button
                  className={`lma-voice-fab ${isListening ? 'listening' : ''}`}
                  onClick={handleVoiceToggle}
                  disabled={isLoading}
                >
                  {isListening ? <MicOff size={24} /> : <Mic size={24} />}
                </button>
                
                {/* Live transcript display */}
                {(transcript || input) && (
                  <div className="mt-md p-sm rounded-lg" style={{ background: 'var(--bg-elevated)', minHeight: 40 }}>
                    <p className="small" style={{ color: transcript ? 'var(--accent-warning)' : 'var(--text-primary)' }}>
                      {transcript || input}
                    </p>
                  </div>
                )}
                
                <p className="small opacity-60 mt-md text-center">
                  {isListening ? '🎤 Listening... Speak now' : isLoading ? 'Processing...' : 'Click mic to speak'}
                </p>
                
                {/* Send button for voice mode */}
                {input && !isListening && (
                  <button 
                    className="btn primary w-full mt-sm"
                    onClick={handleSend}
                    disabled={isLoading}
                  >
                    {isLoading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <Send size={16} />}
                    Send Message
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-center items-center py-sm" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <span className="small opacity-40 flex items-center gap-xs">
              <Zap size={10} /> Powered by Groq
            </span>
          </div>
        </div>
      ) : (
        <button 
          className="lma-fab-3d"
          onClick={() => setIsOpen(true)}
          aria-label="Open LMA Assistant"
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1000,
            width: 72,
            height: 72,
            borderRadius: '50%',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            perspective: '1000px',
            transformStyle: 'preserve-3d',
            transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), filter 0.4s',
            filter: 'drop-shadow(0 8px 24px rgba(236, 72, 153, 0.4))'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-8px) scale(1.1) rotateY(10deg)';
            e.currentTarget.style.filter = 'drop-shadow(0 16px 32px rgba(236, 72, 153, 0.6))';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1) rotateY(0deg)';
            e.currentTarget.style.filter = 'drop-shadow(0 8px 24px rgba(236, 72, 153, 0.4))';
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px) scale(0.95)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'translateY(-8px) scale(1.1)';
          }}
        >
          <LMAIcon size={64} />
        </button>
      )}
    </div>
  );
}
