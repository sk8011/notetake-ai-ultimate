import React, { useState, useEffect, useRef, useCallback } from "react";
import { Badge, Button, Form, InputGroup, Spinner, Tab, Nav, Modal, Alert } from "react-bootstrap";
import { useSocket } from "../../context/SocketContext";
import { 
  usersAPI, 
  friendsAPI, 
  conversationsAPI, 
  messagesAPI,
  shareAPI 
} from "../../services/api";
import "./ChatPanel.css";

interface User {
  _id: string;
  name: string;
  email: string;
  isOnline?: boolean;
  lastSeen?: string;
}

interface Message {
  _id: string;
  content: string;
  sender: User;
  createdAt: string;
  readBy: string[];
}

interface Conversation {
  _id: string;
  type: "personal" | "group";
  participants: User[];
  name: string | null;
  admin: User | null;
  lastMessage: {
    content: string;
    sender: string;
    createdAt: string;
  } | null;
  unreadCount: number;
}

interface Friend {
  friendshipId: string;
  user: User;
  since: string;
}

interface PendingRequest {
  friendshipId: string;
  user: User;
  sentAt: string;
}

interface Note {
  _id?: string;
  id?: string;
  title: string;
  markdown: string;
  tags: string[];
  isShared?: boolean;
  sharedBy?: { name: string; email: string };
}

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  notes: Note[];
}

const ChatPanel: React.FC<ChatPanelProps> = ({ isOpen, onClose, notes }) => {
  const { socket } = useSocket();
  const [activeTab, setActiveTab] = useState("chats");
  
  // Conversations state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  
  // Friends state
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingReceived, setPendingReceived] = useState<PendingRequest[]>([]);
  const [pendingSent, setPendingSent] = useState<PendingRequest[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  
  // Users browser state
  const [searchUsers, setSearchUsers] = useState("");
  const [browseUsers, setBrowseUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);
  
  // Group creation state
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  
  // Note sharing state
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedNoteToShare, setSelectedNoteToShare] = useState<string>("");
  const [sharingNote, setSharingNote] = useState(false);
  
  // Group management state
  const [showGroupSettingsModal, setShowGroupSettingsModal] = useState(false);
  const [editingGroupName, setEditingGroupName] = useState("");
  const [addingMembers, setAddingMembers] = useState(false);
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [savingGroupName, setSavingGroupName] = useState(false);
  const [selectedNewMembers, setSelectedNewMembers] = useState<string[]>([]);
  
  // Typing indicator
  const [typingUsers, setTypingUsers] = useState<Record<string, string[]>>({});
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
  const currentUserId = storedUser._id || storedUser.id;

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load conversations
  const loadConversations = useCallback(async () => {
    try {
      const response = await conversationsAPI.getAll();
      setConversations(response.data);
    } catch (error) {
      console.error("Error loading conversations:", error);
    }
  }, []);

  // Load friends
  const loadFriends = useCallback(async () => {
    setLoadingFriends(true);
    try {
      const response = await friendsAPI.getAll();
      setFriends(response.data.friends);
      setPendingReceived(response.data.pendingReceived);
      setPendingSent(response.data.pendingSent);
    } catch (error) {
      console.error("Error loading friends:", error);
    } finally {
      setLoadingFriends(false);
    }
  }, []);

  // Browse users
  const searchForUsers = useCallback(async (query: string) => {
    setLoadingUsers(true);
    try {
      const response = await usersAPI.browse(query);
      setBrowseUsers(response.data.users);
    } catch (error) {
      console.error("Error browsing users:", error);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  // Load initial data when panel opens
  useEffect(() => {
    if (isOpen) {
      loadConversations();
      loadFriends();
    }
  }, [isOpen, loadConversations, loadFriends]);

  // Search users with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === "people") {
        searchForUsers(searchUsers);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchUsers, activeTab, searchForUsers]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = ({ message, conversationId }: { message: Message; conversationId: string }) => {
      if (activeConversation?._id === conversationId) {
        setMessages((prev) => [...prev, message]);
      }
      // Update conversation list
      loadConversations();
    };

    const handleTypingUpdate = ({ userId, conversationId, isTyping }: { userId: string; conversationId: string; isTyping: boolean }) => {
      setTypingUsers((prev) => {
        const updated = { ...prev };
        if (isTyping) {
          updated[conversationId] = [...(updated[conversationId] || []), userId];
        } else {
          updated[conversationId] = (updated[conversationId] || []).filter((id) => id !== userId);
        }
        return updated;
      });
    };

    socket.on("message:receive", handleNewMessage);
    socket.on("typing:update", handleTypingUpdate);

    return () => {
      socket.off("message:receive", handleNewMessage);
      socket.off("typing:update", handleTypingUpdate);
    };
  }, [socket, activeConversation, loadConversations]);

  // Load messages for active conversation
  useEffect(() => {
    if (!activeConversation) return;

    const loadMessages = async () => {
      setLoadingMessages(true);
      try {
        const response = await conversationsAPI.getOne(activeConversation._id);
        setMessages(response.data.messages);
        // Mark as read
        await messagesAPI.markAsRead(activeConversation._id);
        // Join socket room
        socket?.emit("conversation:join", activeConversation._id);
      } catch (error) {
        console.error("Error loading messages:", error);
      } finally {
        setLoadingMessages(false);
      }
    };

    loadMessages();

    return () => {
      socket?.emit("conversation:leave", activeConversation._id);
    };
  }, [activeConversation, socket]);

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeConversation || sendingMessage) return;

    setSendingMessage(true);
    try {
      if (socket?.connected) {
        socket.emit("message:send", {
          conversationId: activeConversation._id,
          content: newMessage.trim(),
        });
      } else {
        await messagesAPI.send(activeConversation._id, newMessage.trim());
        // Reload messages
        const response = await conversationsAPI.getOne(activeConversation._id);
        setMessages(response.data.messages);
      }
      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setSendingMessage(false);
    }
  };

  // Handle typing indicator
  const handleTyping = () => {
    if (!activeConversation || !socket) return;

    socket.emit("typing:start", activeConversation._id);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("typing:stop", activeConversation._id);
    }, 2000);
  };

  // Send friend request
  const handleSendRequest = async (userId: string) => {
    setSendingRequest(userId);
    try {
      await friendsAPI.sendRequest(userId);
      loadFriends();
      searchForUsers(searchUsers);
    } catch (error) {
      console.error("Error sending friend request:", error);
    } finally {
      setSendingRequest(null);
    }
  };

  // Accept friend request
  const handleAcceptRequest = async (friendshipId: string) => {
    try {
      await friendsAPI.acceptRequest(friendshipId);
      loadFriends();
    } catch (error) {
      console.error("Error accepting request:", error);
    }
  };

  // Decline friend request
  const handleDeclineRequest = async (friendshipId: string) => {
    try {
      await friendsAPI.declineRequest(friendshipId);
      loadFriends();
    } catch (error) {
      console.error("Error declining request:", error);
    }
  };

  // Start chat with friend
  const handleStartChat = async (friendId: string) => {
    try {
      const response = await conversationsAPI.create({
        type: "personal",
        participantIds: [friendId],
      });
      setActiveConversation(response.data);
      setActiveTab("chats");
      loadConversations();
    } catch (error) {
      console.error("Error starting chat:", error);
    }
  };

  // Create group
  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedGroupMembers.length === 0) return;

    setCreatingGroup(true);
    try {
      const response = await conversationsAPI.create({
        type: "group",
        participantIds: selectedGroupMembers,
        name: groupName.trim(),
      });
      setActiveConversation(response.data);
      setActiveTab("chats");
      setShowGroupModal(false);
      setGroupName("");
      setSelectedGroupMembers([]);
      loadConversations();
    } catch (error) {
      console.error("Error creating group:", error);
    } finally {
      setCreatingGroup(false);
    }
  };

  // Share note in conversation
  const handleShareNote = async () => {
    if (!selectedNoteToShare || !activeConversation) return;

    // For personal chats, get the other participant
    if (activeConversation.type === "personal") {
      const otherUser = activeConversation.participants.find(
        (p) => p._id !== currentUserId
      );
      if (!otherUser) return;

      setSharingNote(true);
      try {
        await shareAPI.shareNote(selectedNoteToShare, otherUser._id);
        setShowShareModal(false);
        setSelectedNoteToShare("");
        // Send a message about the share
        const note = notes.find((n) => n._id === selectedNoteToShare || n.id === selectedNoteToShare);
        if (note && socket?.connected) {
          socket.emit("message:send", {
            conversationId: activeConversation._id,
            content: `📝 Shared note: "${note.title}"`,
          });
        }
      } catch (error: any) {
        console.error("Error sharing note:", error);
        alert(error.response?.data?.error || "Failed to share note");
      } finally {
        setSharingNote(false);
      }
    }
  };

  // Open group settings
  const handleOpenGroupSettings = () => {
    if (!activeConversation || activeConversation.type !== "group") return;
    setEditingGroupName(activeConversation.name || "");
    setSelectedNewMembers([]);
    setShowGroupSettingsModal(true);
  };

  // Rename group
  const handleRenameGroup = async () => {
    if (!activeConversation || !editingGroupName.trim()) return;
    
    setSavingGroupName(true);
    try {
      const response = await conversationsAPI.rename(activeConversation._id, editingGroupName.trim());
      setActiveConversation(response.data);
      loadConversations();
    } catch (error: any) {
      console.error("Error renaming group:", error);
      alert(error.response?.data?.error || "Failed to rename group");
    } finally {
      setSavingGroupName(false);
    }
  };

  // Add members to group
  const handleAddMembers = async () => {
    if (!activeConversation || selectedNewMembers.length === 0) return;
    
    setAddingMembers(true);
    try {
      const response = await conversationsAPI.updateMembers(
        activeConversation._id, 
        "add", 
        selectedNewMembers
      );
      setActiveConversation(response.data);
      setSelectedNewMembers([]);
      loadConversations();
    } catch (error: any) {
      console.error("Error adding members:", error);
      alert(error.response?.data?.error || "Failed to add members");
    } finally {
      setAddingMembers(false);
    }
  };

  // Remove member from group
  const handleRemoveMember = async (memberId: string) => {
    if (!activeConversation) return;
    
    setRemovingMember(memberId);
    try {
      const response = await conversationsAPI.updateMembers(
        activeConversation._id, 
        "remove", 
        [memberId]
      );
      setActiveConversation(response.data);
      loadConversations();
    } catch (error: any) {
      console.error("Error removing member:", error);
      alert(error.response?.data?.error || "Failed to remove member");
    } finally {
      setRemovingMember(null);
    }
  };

  // Leave group
  const handleLeaveGroup = async () => {
    if (!activeConversation) return;
    
    if (!confirm("Are you sure you want to leave this group?")) return;
    
    try {
      await conversationsAPI.leave(activeConversation._id);
      setActiveConversation(null);
      setShowGroupSettingsModal(false);
      loadConversations();
    } catch (error: any) {
      console.error("Error leaving group:", error);
      alert(error.response?.data?.error || "Failed to leave group");
    }
  };

  // Get friends not in current group
  const getFriendsNotInGroup = () => {
    if (!activeConversation) return [];
    const participantIds = activeConversation.participants.map(p => p._id);
    return friends.filter(f => !participantIds.includes(f.user._id));
  };

  // Check if current user is admin
  const isGroupAdmin = activeConversation?.type === "group" && 
    activeConversation.admin?._id === currentUserId;

  // Get other participant in personal chat
  const getOtherParticipant = (conv: Conversation) => {
    return conv.participants.find((p) => p._id !== currentUserId);
  };

  // Format time
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (days === 1) {
      return "Yesterday";
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: "short" });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  if (!isOpen) return null;

  return (
    <div className="chat-panel">
      <div className="chat-panel-header">
        <h5 className="mb-0">
          {activeConversation ? (
            <Button
              variant="link"
              className="back-btn p-0 me-2"
              onClick={() => setActiveConversation(null)}
            >
              <i className="bi bi-arrow-left"></i>
            </Button>
          ) : null}
          {activeConversation
            ? activeConversation.type === "group"
              ? activeConversation.name
              : getOtherParticipant(activeConversation)?.name
            : "Messages"}
        </h5>
        <Button variant="link" className="close-btn" onClick={onClose}>
          <i className="bi bi-x-lg"></i>
        </Button>
      </div>

      {activeConversation ? (
        // Conversation View
        <div className="conversation-view">
          <div className="conversation-header">
            {activeConversation.type === "personal" && (
              <div className="d-flex align-items-center justify-content-end w-100">
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={() => setShowShareModal(true)}
                >
                  <i className="bi bi-share me-1"></i> Share Note
                </Button>
              </div>
            )}
            {activeConversation.type === "group" && (
              <div className="d-flex align-items-center justify-content-between w-100">
                <div className="text-muted small">
                  {activeConversation.participants.length} members
                  {isGroupAdmin && <Badge bg="primary" className="ms-2">Admin</Badge>}
                </div>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={handleOpenGroupSettings}
                  title="Group Settings"
                >
                  <i className="bi bi-gear"></i>
                </Button>
              </div>
            )}
          </div>

          <div className="messages-container">
            {loadingMessages ? (
              <div className="text-center py-4">
                <Spinner animation="border" size="sm" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center text-muted py-4">
                No messages yet. Say hello! 👋
              </div>
            ) : (
              messages.map((msg) => {
                const isSent = msg.sender._id === currentUserId;
                const isGroup = activeConversation.type === "group";
                
                return (
                  <div
                    key={msg._id}
                    className={`message ${isSent ? "sent" : "received"}`}
                  >
                    {/* Show sender name only in groups for received messages */}
                    {!isSent && isGroup && (
                      <div className="message-sender">{msg.sender.name}</div>
                    )}
                    
                    <div className={!isSent && isGroup ? "message-with-avatar" : ""}>
                      {/* Show avatar only in group chats */}
                      {!isSent && isGroup && (
                        <div className="message-avatar">
                          {msg.sender.name?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="message-bubble">
                        <div className="message-content">{msg.content}</div>
                      </div>
                    </div>
                    
                    <div className="message-time">{formatTime(msg.createdAt)}</div>
                  </div>
                );
              })
            )}
            {typingUsers[activeConversation._id]?.length > 0 && (
              <div className="typing-indicator">
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot"></span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <Form onSubmit={handleSendMessage} className="message-input-form">
            <InputGroup>
              <Form.Control
                type="text"
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value);
                  handleTyping();
                }}
                disabled={sendingMessage}
              />
              <Button 
                type="submit" 
                variant="primary" 
                disabled={!newMessage.trim() || sendingMessage}
              >
                {sendingMessage ? (
                  <Spinner animation="border" size="sm" />
                ) : (
                  <i className="bi bi-send"></i>
                )}
              </Button>
            </InputGroup>
          </Form>
        </div>
      ) : (
        // Tabs View
        <div className="chat-tabs-container">
          <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k || "chats")}>
            <Nav variant="pills" className="chat-nav">
              <Nav.Item>
                <Nav.Link eventKey="chats">
                  <i className="bi bi-chat-dots"></i>
                  <span>Chats</span>
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="friends">
                  <i className="bi bi-people"></i>
                  <span>Friends</span>
                  {pendingReceived.length > 0 && (
                    <Badge bg="danger" className="ms-1">{pendingReceived.length}</Badge>
                  )}
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="groups">
                  <i className="bi bi-collection"></i>
                  <span>Groups</span>
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="people">
                  <i className="bi bi-search"></i>
                  <span>People</span>
                </Nav.Link>
              </Nav.Item>
            </Nav>

            <Tab.Content className="chat-tab-content">
              {/* Chats Tab */}
              <Tab.Pane eventKey="chats">
                <div className="conversation-list">
                  {conversations.length === 0 ? (
                    <div className="text-center text-muted py-4">
                      No conversations yet.<br />
                      Add friends and start chatting!
                    </div>
                  ) : (
                    conversations.map((conv) => {
                      const otherUser = conv.type === "personal" ? getOtherParticipant(conv) : null;
                      return (
                        <div
                          key={conv._id}
                          className="conversation-item"
                          onClick={() => setActiveConversation(conv)}
                        >
                          <div className="conversation-avatar">
                            {conv.type === "group" ? (
                              <i className="bi bi-people-fill"></i>
                            ) : (
                              <span>{otherUser?.name?.charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <div className="conversation-info">
                            <div className="conversation-name">
                              {conv.type === "group" ? conv.name : otherUser?.name}
                            </div>
                            {conv.lastMessage && (
                              <div className="conversation-last-message">
                                {conv.lastMessage.content}
                              </div>
                            )}
                          </div>
                          <div className="conversation-meta">
                            {conv.lastMessage && (
                              <div className="conversation-time">
                                {formatTime(conv.lastMessage.createdAt)}
                              </div>
                            )}
                            {conv.unreadCount > 0 && (
                              <Badge bg="primary" className="unread-badge">
                                {conv.unreadCount}
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </Tab.Pane>

              {/* Friends Tab */}
              <Tab.Pane eventKey="friends">
                <div className="friends-list">
                  {pendingReceived.length > 0 && (
                    <div className="friends-section">
                      <div className="section-title">Friend Requests</div>
                      {pendingReceived.map((req) => (
                        <div key={req.friendshipId} className="friend-item request">
                          <div className="friend-avatar">
                            {req.user.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="friend-info">
                            <div className="friend-name">{req.user.name}</div>
                            <div className="friend-email">{req.user.email}</div>
                          </div>
                          <div className="friend-actions">
                            <Button
                              variant="success"
                              size="sm"
                              onClick={() => handleAcceptRequest(req.friendshipId)}
                            >
                              <i className="bi bi-check"></i>
                            </Button>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => handleDeclineRequest(req.friendshipId)}
                            >
                              <i className="bi bi-x"></i>
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {pendingSent.length > 0 && (
                    <div className="friends-section">
                      <div className="section-title">Pending</div>
                      {pendingSent.map((req) => (
                        <div key={req.friendshipId} className="friend-item pending">
                          <div className="friend-avatar">
                            {req.user.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="friend-info">
                            <div className="friend-name">{req.user.name}</div>
                            <div className="text-muted small">Request sent</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="friends-section">
                    <div className="section-title">
                      Friends {friends.length > 0 && `(${friends.length})`}
                    </div>
                    {loadingFriends ? (
                      <div className="text-center py-3">
                        <Spinner animation="border" size="sm" />
                      </div>
                    ) : friends.length === 0 ? (
                      <div className="text-center text-muted py-3">
                        No friends yet. Search for people to add!
                      </div>
                    ) : (
                      friends.map((friend) => (
                        <div key={friend.friendshipId} className="friend-item">
                          <div className="friend-avatar">
                            {friend.user.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="friend-info">
                            <div className="friend-name">{friend.user.name}</div>
                            <div className="friend-email">{friend.user.email}</div>
                          </div>
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => handleStartChat(friend.user._id)}
                          >
                            <i className="bi bi-chat"></i>
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </Tab.Pane>

              {/* Groups Tab */}
              <Tab.Pane eventKey="groups">
                <div className="groups-container">
                  <Button
                    variant="primary"
                    className="w-100 mb-3"
                    onClick={() => setShowGroupModal(true)}
                    disabled={friends.length === 0}
                  >
                    <i className="bi bi-plus-lg me-2"></i>
                    Create Group
                  </Button>

                  {friends.length === 0 && (
                    <Alert variant="info" className="small">
                      Add friends first to create groups!
                    </Alert>
                  )}

                  <div className="section-title">Your Groups</div>
                  <div className="groups-list">
                    {conversations.filter((c) => c.type === "group").length === 0 ? (
                      <div className="text-center text-muted py-3">
                        No groups yet
                      </div>
                    ) : (
                      conversations
                        .filter((c) => c.type === "group")
                        .map((group) => (
                          <div
                            key={group._id}
                            className="group-item"
                            onClick={() => {
                              setActiveConversation(group);
                              setActiveTab("chats");
                            }}
                          >
                            <div className="group-avatar">
                              <i className="bi bi-people-fill"></i>
                            </div>
                            <div className="group-info">
                              <div className="group-name">{group.name}</div>
                              <div className="group-members">
                                {group.participants.length} members
                              </div>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </Tab.Pane>

              {/* People Tab */}
              <Tab.Pane eventKey="people">
                <Form.Control
                  type="search"
                  placeholder="Search by name or email..."
                  value={searchUsers}
                  onChange={(e) => setSearchUsers(e.target.value)}
                  className="mb-3"
                />

                <div className="users-list">
                  {loadingUsers ? (
                    <div className="text-center py-3">
                      <Spinner animation="border" size="sm" />
                    </div>
                  ) : browseUsers.length === 0 ? (
                    <div className="text-center text-muted py-3">
                      {searchUsers ? "No users found" : "Search for users to add as friends"}
                    </div>
                  ) : (
                    browseUsers.map((user) => (
                      <div key={user._id} className="user-item">
                        <div className="user-avatar">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="user-info">
                          <div className="user-name">{user.name}</div>
                          <div className="user-email">{user.email}</div>
                        </div>
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => handleSendRequest(user._id)}
                          disabled={sendingRequest === user._id}
                        >
                          {sendingRequest === user._id ? (
                            <Spinner animation="border" size="sm" />
                          ) : (
                            <><i className="bi bi-person-plus"></i> Add</>
                          )}
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </Tab.Pane>
            </Tab.Content>
          </Tab.Container>
        </div>
      )}

      {/* Group Creation Modal */}
      <Modal show={showGroupModal} onHide={() => setShowGroupModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Create Group</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Group Name</Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              maxLength={50}
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>Select Members (max 20)</Form.Label>
            <div className="member-select-list">
              {friends.map((friend) => (
                <Form.Check
                  key={friend.user._id}
                  type="checkbox"
                  id={`member-${friend.user._id}`}
                  label={friend.user.name}
                  checked={selectedGroupMembers.includes(friend.user._id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      if (selectedGroupMembers.length < 19) {
                        setSelectedGroupMembers([...selectedGroupMembers, friend.user._id]);
                      }
                    } else {
                      setSelectedGroupMembers(selectedGroupMembers.filter((id) => id !== friend.user._id));
                    }
                  }}
                />
              ))}
            </div>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowGroupModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreateGroup}
            disabled={!groupName.trim() || selectedGroupMembers.length === 0 || creatingGroup}
          >
            {creatingGroup ? <Spinner animation="border" size="sm" /> : "Create"}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Share Note Modal */}
      <Modal show={showShareModal} onHide={() => setShowShareModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Share Note</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label>Select a note to share</Form.Label>
            <Form.Select
              value={selectedNoteToShare}
              onChange={(e) => setSelectedNoteToShare(e.target.value)}
            >
              <option value="">Choose a note...</option>
              {notes.filter(note => !note.isShared).map((note) => (
                <option key={note._id || note.id} value={note._id || note.id}>
                  {note.title}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <Alert variant="info" className="mt-3 small">
            The recipient will get view-only access to this note.
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowShareModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleShareNote}
            disabled={!selectedNoteToShare || sharingNote}
          >
            {sharingNote ? <Spinner animation="border" size="sm" /> : "Share"}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Group Settings Modal */}
      <Modal show={showGroupSettingsModal} onHide={() => setShowGroupSettingsModal(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-people-fill me-2"></i>
            Group Settings
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {activeConversation && activeConversation.type === "group" && (
            <>
              {/* Group Name Section */}
              <div className="group-settings-section">
                <h6 className="section-label">Group Name</h6>
                <InputGroup>
                  <Form.Control
                    type="text"
                    value={editingGroupName}
                    onChange={(e) => setEditingGroupName(e.target.value)}
                    disabled={!isGroupAdmin}
                    maxLength={50}
                  />
                  {isGroupAdmin && (
                    <Button 
                      variant="primary" 
                      onClick={handleRenameGroup}
                      disabled={savingGroupName || !editingGroupName.trim() || editingGroupName === activeConversation.name}
                    >
                      {savingGroupName ? <Spinner size="sm" /> : "Save"}
                    </Button>
                  )}
                </InputGroup>
                {!isGroupAdmin && (
                  <small className="text-muted">Only admin can change the group name</small>
                )}
              </div>

              {/* Members Section */}
              <div className="group-settings-section mt-4">
                <h6 className="section-label">
                  Members ({activeConversation.participants.length}/20)
                </h6>
                <div className="members-list">
                  {activeConversation.participants.map((member) => (
                    <div key={member._id} className="member-item">
                      <div className="member-avatar">
                        {member.name?.charAt(0).toUpperCase()}
                      </div>
                      <div className="member-info">
                        <div className="member-name">
                          {member.name}
                          {member._id === activeConversation.admin?._id && (
                            <Badge bg="warning" text="dark" className="ms-2">Admin</Badge>
                          )}
                          {member._id === currentUserId && (
                            <Badge bg="secondary" className="ms-2">You</Badge>
                          )}
                        </div>
                        <div className="member-email">{member.email}</div>
                      </div>
                      {isGroupAdmin && member._id !== currentUserId && (
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => handleRemoveMember(member._id)}
                          disabled={removingMember === member._id}
                          title="Remove from group"
                        >
                          {removingMember === member._id ? (
                            <Spinner size="sm" />
                          ) : (
                            <i className="bi bi-x-lg"></i>
                          )}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Add Members Section (Admin only) */}
              {isGroupAdmin && getFriendsNotInGroup().length > 0 && (
                <div className="group-settings-section mt-4">
                  <h6 className="section-label">Add Members</h6>
                  <div className="add-members-list">
                    {getFriendsNotInGroup().map((friend) => (
                      <Form.Check
                        key={friend.user._id}
                        type="checkbox"
                        id={`add-member-${friend.user._id}`}
                        label={friend.user.name}
                        checked={selectedNewMembers.includes(friend.user._id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            if (activeConversation.participants.length + selectedNewMembers.length < 20) {
                              setSelectedNewMembers([...selectedNewMembers, friend.user._id]);
                            }
                          } else {
                            setSelectedNewMembers(selectedNewMembers.filter((id) => id !== friend.user._id));
                          }
                        }}
                      />
                    ))}
                  </div>
                  <Button
                    variant="success"
                    className="mt-2"
                    onClick={handleAddMembers}
                    disabled={selectedNewMembers.length === 0 || addingMembers}
                  >
                    {addingMembers ? <Spinner size="sm" /> : (
                      <>
                        <i className="bi bi-plus-lg me-1"></i>
                        Add Selected ({selectedNewMembers.length})
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Leave Group */}
              <div className="group-settings-section mt-4 pt-3 border-top">
                <Button 
                  variant="outline-danger" 
                  onClick={handleLeaveGroup}
                  className="w-100"
                >
                  <i className="bi bi-box-arrow-left me-2"></i>
                  {isGroupAdmin ? "Delete Group" : "Leave Group"}
                </Button>
                {isGroupAdmin && (
                  <small className="text-muted d-block text-center mt-2">
                    As admin, leaving will delete the group for everyone
                  </small>
                )}
              </div>
            </>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default ChatPanel;
