import React, { useState, useRef, useEffect } from "react";
import "../styles/ChatBot.css";
import ReactMarkdown from "react-markdown";
import { useTheme } from "./ThemeContext";
import { chatAPI } from "../services/api";

interface ChatBotProps {
  notes: {
    id?: string;
    title: string;
    markdown: string;
    tags: string[];
  }[];
}

const ChatBot: React.FC<ChatBotProps> = ({ notes }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isOpened, setIsOpened] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showDocs, setShowDocs] = useState(true);

  const chatRef = useRef<HTMLDivElement>(null);
  const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { theme }=useTheme();

  // Auto scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message + start typing effect
  const sendMessage = async () => {
    if (!input.trim() || isGenerating) return;

    const userMessage = { role: "user" as const, content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsGenerating(true);

    try {
      const res = await chatAPI.sendMessage([...messages, userMessage], notes);
      const data = res.data;
      const fullReply = data.reply;

      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "" }
      ]);

      let index = 0;
      typingIntervalRef.current = setInterval(() => {
        index++;
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];

          if (last.role === "assistant") {
            updated[updated.length - 1] = {
              ...last,
              content: fullReply.slice(0, index),
              role: "assistant",
            };
          }

          return updated;
        });

        if (index >= fullReply.length) {
          clearInterval(typingIntervalRef.current!);
          setIsGenerating(false);

          setTimeout(() => {
            inputRef.current?.focus();
          },100);
        }
      }, 20);
    } catch (err) {
      console.error(err);
      setIsGenerating(false);

      setTimeout(() => {
        inputRef.current?.focus();
      },100);
    }
  };

  // Stop typing effect
  const stopGenerating = () => {
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
      setIsGenerating(false);
      setTimeout(() => {
        inputRef.current?.focus();
      },100);
    }
  };

  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscKey);

    return () => {
      document.removeEventListener("keydown", handleEscKey);
    };
  }, [isOpen]);


  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100); // Small delay to ensure DOM is ready
    }
  }, [isOpen]);


  return (
    <>
      {/* Floating Documentation Box */}
      {showDocs && (
        <div className="docs-floating-box">
          <i className="bi bi-book"></i>
          <span>For detailed documentation, visit </span>
          <a href="https://github.com/sk8011/notetake-ai-ultimate" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          <button className="docs-close-btn" onClick={() => setShowDocs(false)} aria-label="Close">
            <i className="bi bi-x"></i>
          </button>
        </div>
      )}

      <div className={`chatbot-container ${isOpen ? "open" : ""}`}>
        {!isOpened && (
          <div className="chat-thought" style={{backgroundColor:theme==="dark"?"#215f94ef":"", color:theme==="dark"?"white":"black"}}>
            Powered by AI.<br /> Ask me anything about your notes.
            <div className="thought-tail" />
          </div>
        )}
      <button className="chat-toggle" onClick={() => {
        setIsOpen(prev => !prev);
        setIsOpened(true);
        }}>
        {isOpen?<i className="bi bi-x-lg"></i>:<img src={`chat-gpt.png`} alt="Chatbot Icon" />}
        <span className="btn-label">{isOpen ? "Close" : "AI Chat"}</span>
      </button>
      

        {isOpen && (
          <div className="chat-window" ref={chatRef}>
            <div className="chat-messages">

              {messages.length===0?(
                <div className="chat-placeholder">
                  <em>I'm here to help. Ask me anything!</em>
                </div>
              ):(messages.map((msg, idx) => (
                <div key={idx} className={`chat-msg ${msg.role}`}>
                  {msg.role === "user" ? (
                    <>
                      <span className="user-label">You</span>
                      <span className="user-content">{msg.content}</span>
                    </>
                  ) : (
                    <>
                      <span className="bot-label">Bot</span>
                      <div className="bot-content">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    </>
                  )}
                </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-input">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !isGenerating) {
                    sendMessage();
                  }
                }}
                placeholder="Ask me anything..."
              />
              {isGenerating ? (
                <button onClick={stopGenerating}>Stop</button>
              ) : (
                <button onClick={sendMessage} className="bi bi-send"></button>
              )}

            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default ChatBot;
