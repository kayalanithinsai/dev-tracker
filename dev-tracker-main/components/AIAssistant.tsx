import React, { useState, useRef, useEffect } from 'react';
import { getAIResponse } from '../services/geminiService';
import { ChatMessage } from '../types';
import ReactMarkdown from 'react-markdown';

interface AIAssistantProps {
  subjectTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ subjectTitle, isOpen, onClose }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: `Hi! I'm your AI tutor for **${subjectTitle}**. Ask me for a study plan, a specific algorithm explanation, or help with a problem!` }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const responseText = await getAIResponse(userMsg.text, subjectTitle);
      setMessages(prev => [...prev, { role: 'model', text: responseText }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', text: "Sorry, I encountered an error connecting to the AI service.", isError: true }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-[450px] bg-zinc-900 shadow-2xl border-l border-zinc-800 z-50 flex flex-col transform transition-transform duration-300">
      <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900">
        <h3 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
          AI Tutor: {subjectTitle}
        </h3>
        <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-900/50">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-lg p-3 text-sm leading-relaxed ${
              msg.role === 'user' 
                ? 'bg-emerald-600 text-white' 
                : msg.isError ? 'bg-red-900/50 text-red-200' : 'bg-zinc-800 text-zinc-200'
            }`}>
              <ReactMarkdown 
                components={{
                  code({node, inline, className, children, ...props}: any) {
                    return !inline ? (
                      <pre className="bg-black/30 p-2 rounded mt-2 overflow-x-auto text-xs font-mono">
                        <code {...props}>{children}</code>
                      </pre>
                    ) : (
                      <code className="bg-black/30 px-1 rounded font-mono text-xs" {...props}>{children}</code>
                    )
                  }
                }}
              >
                {msg.text}
              </ReactMarkdown>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-zinc-800 rounded-lg p-3 text-sm text-zinc-400 animate-pulse">
              Thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-zinc-800 bg-zinc-900">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask about this topic..."
            className="flex-1 bg-zinc-800 border-zinc-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-zinc-500"
          />
          <button 
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors font-medium"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;
