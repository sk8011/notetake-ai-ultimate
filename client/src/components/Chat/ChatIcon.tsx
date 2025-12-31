import React, { useState, useEffect } from "react";
import { conversationsAPI } from "../../services/api";
import { useSocket } from "../../context/SocketContext";
import ChatPanel from "./ChatPanel";
import "./ChatPanel.css";

interface Note {
  _id?: string;
  id?: string;
  title: string;
  markdown: string;
  tags: string[];
}

interface ChatIconProps {
  notes: Note[];
}

const ChatIcon: React.FC<ChatIconProps> = ({ notes }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { socket } = useSocket();

  // Load unread count
  useEffect(() => {
    const loadUnreadCount = async () => {
      try {
        const response = await conversationsAPI.getAll();
        const total = response.data.reduce(
          (sum: number, conv: any) => sum + (conv.unreadCount || 0),
          0
        );
        setUnreadCount(total);
      } catch (error) {
        console.error("Error loading unread count:", error);
      }
    };

    loadUnreadCount();

    // Reload on new messages
    if (socket) {
      const handleNewMessage = () => {
        if (!isOpen) {
          loadUnreadCount();
        }
      };

      socket.on("message:notification", handleNewMessage);
      return () => {
        socket.off("message:notification", handleNewMessage);
      };
    }
  }, [socket, isOpen]);

  // Reset unread count when panel opens
  useEffect(() => {
    if (isOpen) {
      // Reload to get fresh count after viewing
      const timer = setTimeout(() => {
        conversationsAPI.getAll().then((response) => {
          const total = response.data.reduce(
            (sum: number, conv: any) => sum + (conv.unreadCount || 0),
            0
          );
          setUnreadCount(total);
        });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  return (
    <>
      <button
        className="chat-icon-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="Messages"
      >
        <i className={`bi ${isOpen ? "bi-x-lg" : "bi-chat-dots-fill"}`}></i>
        <span className="btn-label">{isOpen ? "Close" : "Messages"}</span>
        {unreadCount > 0 && !isOpen && (
          <span className="unread-count">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      <ChatPanel 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
        notes={notes}
      />
    </>
  );
};

export default ChatIcon;
