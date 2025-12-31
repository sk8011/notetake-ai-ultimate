import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token expiration (but not during auth endpoints or settings)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Don't redirect on auth or settings endpoints (they handle 401 for wrong password)
    const isAuthEndpoint = error.config?.url?.includes("/auth/");
    const isSettingsEndpoint = error.config?.url?.includes("/settings/");
    
    if (error.response?.status === 401 && !isAuthEndpoint && !isSettingsEndpoint) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data: { email: string; password: string; name: string }) =>
    api.post("/auth/register", data),
  login: (data: { email: string; password: string }) =>
    api.post("/auth/login", data),
  logout: () => api.post("/auth/logout"),
  getCurrentUser: () => api.get("/auth/me"),
};

// Notes API
export const notesAPI = {
  getAll: () => api.get("/notes"),
  getOne: (id: string) => api.get(`/notes/${id}`),
  create: (data: { title: string; markdown: string; tags: string[]; images: any[] }) =>
    api.post("/notes", data),
  update: (id: string, data: { title: string; markdown: string; tags: string[]; images: any[] }) =>
    api.put(`/notes/${id}`, data),
  delete: (id: string) => api.delete(`/notes/${id}`),
  deleteMany: (ids: string[]) => api.delete("/notes/bulk", { data: { ids } }),
  exportAll: () => api.get("/notes/export-all", { responseType: 'blob' }),
};

// Tags API
export const tagsAPI = {
  getAll: () => api.get("/tags"),
  update: (id: string, data: { label: string }) => api.put(`/tags/${id}`, data),
  delete: (id: string) => api.delete(`/tags/${id}`),
};

// Upload API
export const uploadAPI = {
  upload: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const response = await api.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 30000, // 30 second timeout
      });
      return response;
    } catch (error: any) {
      console.error("Upload failed:", error);
      throw error;
    }
  },
  deleteImage: (public_id: string) => api.delete("/delete-image", { data: { public_id } }),
};

// Chat API
export const chatAPI = {
  sendMessage: (messages: any[], notes: any[]) =>
    api.post("/chat", { messages, notes }),
};

// Settings API
export const settingsAPI = {
  getPreferences: () => api.get("/settings/preferences"),
  updatePreferences: (data: {
    theme?: string;
    backgroundImage?: string | null;
    backgroundType?: string;
    defaultBackground?: string | null;
  }) => api.put("/settings/preferences", data),
  updateProfile: (data: { name: string }) => api.put("/settings/profile", data),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.put("/settings/password", data),
  deleteAccount: (password: string) =>
    api.delete("/settings/account", { data: { password } }),
  getImages: () => api.get("/settings/images"),
  deleteImage: (publicId: string) => 
    api.delete(`/settings/images/${encodeURIComponent(publicId)}`),
};

// Users API
export const usersAPI = {
  browse: (search?: string, page?: number, limit?: number) =>
    api.get("/users", { params: { search, page, limit } }),
  getProfile: (id: string) => api.get(`/users/${id}`),
};

// Friends API
export const friendsAPI = {
  getAll: () => api.get("/friends"),
  sendRequest: (userId: string) => api.post(`/friends/request/${userId}`),
  acceptRequest: (friendshipId: string) => api.put(`/friends/accept/${friendshipId}`),
  declineRequest: (friendshipId: string) => api.put(`/friends/decline/${friendshipId}`),
  removeFriend: (userId: string) => api.delete(`/friends/${userId}`),
  cancelRequest: (friendshipId: string) => api.delete(`/friends/request/${friendshipId}`),
};

// Conversations API
export const conversationsAPI = {
  getAll: () => api.get("/conversations"),
  getOne: (id: string, page?: number) => 
    api.get(`/conversations/${id}`, { params: { page, limit: 50 } }),
  create: (data: { type: "personal" | "group"; participantIds: string[]; name?: string }) =>
    api.post("/conversations", data),
  updateMembers: (id: string, action: "add" | "remove", memberIds: string[]) =>
    api.put(`/conversations/${id}/members`, { action, memberIds }),
  rename: (id: string, name: string) => api.put(`/conversations/${id}/name`, { name }),
  leave: (id: string) => api.delete(`/conversations/${id}`),
};

// Messages API
export const messagesAPI = {
  send: (conversationId: string, content: string) =>
    api.post("/messages", { conversationId, content }),
  getMessages: (conversationId: string, page?: number) =>
    api.get(`/messages/${conversationId}`, { params: { page, limit: 50 } }),
  markAsRead: (conversationId: string) => api.put(`/messages/read/${conversationId}`),
};

// Note Sharing API
export const shareAPI = {
  shareNote: (noteId: string, sharedWithUserId: string) =>
    api.post(`/share/note/${noteId}`, { sharedWithUserId }),
  revokeAccess: (noteId: string, userId: string) =>
    api.delete(`/share/note/${noteId}/${userId}`),
  toggleAccess: (noteId: string, userId: string, active: boolean) =>
    api.put(`/share/note/${noteId}/${userId}`, { active }),
  getMyShared: () => api.get("/share/my-shared"),
  getSharedWithMe: () => api.get("/share/shared-with-me"),
  getNoteShares: (noteId: string) => api.get(`/share/note/${noteId}/users`),
};

export default api;
