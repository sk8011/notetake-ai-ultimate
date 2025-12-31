import { useState, useEffect, useRef } from "react";
import { Modal, Button, Form, Nav, Tab, Stack, Alert, Spinner, Badge } from "react-bootstrap";
import { useTheme } from "./ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { settingsAPI, uploadAPI, shareAPI, notesAPI } from "../services/api";
import { useNavigate } from "react-router-dom";

// Default background images (these would be hosted URLs)
const DEFAULT_BACKGROUNDS = [
  { key: "gradient-1", name: "Purple Gradient", url: "https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=1920&q=80" },
  { key: "gradient-2", name: "Blue Gradient", url: "https://images.unsplash.com/photo-1557683316-973673baf926?w=1920&q=80" },
  { key: "nature-1", name: "Mountains", url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80" },
  { key: "nature-2", name: "Forest", url: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=1920&q=80" },
  { key: "abstract-1", name: "Abstract Dark", url: "https://images.unsplash.com/photo-1550684376-efcbd6e3f031?w=1920&q=80" },
  { key: "abstract-2", name: "Neon Lights", url: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1920&q=80" },
];

interface SettingsProps {
  show: boolean;
  onHide: () => void;
  onPreferencesChange: (prefs: UserPreferences) => void;
  currentPreferences: UserPreferences;
}

export interface UserPreferences {
  theme: "light" | "dark";
  backgroundImage: string | null;
  backgroundType: "none" | "default" | "custom";
  defaultBackground: string | null;
}

export function Settings({ show, onHide, onPreferencesChange, currentPreferences }: SettingsProps) {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Appearance state
  const [selectedTheme, setSelectedTheme] = useState<"light" | "dark">(theme);
  const [backgroundType, setBackgroundType] = useState<"none" | "default" | "custom">(currentPreferences.backgroundType || "none");
  const [selectedDefault, setSelectedDefault] = useState<string | null>(currentPreferences.defaultBackground);
  const [customBgUrl, setCustomBgUrl] = useState<string | null>(currentPreferences.backgroundImage);
  const [uploadingBg, setUploadingBg] = useState(false);

  // Account state
  const [name, setName] = useState(user?.name || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Storage/Images state
  const [userImages, setUserImages] = useState<{ url: string; public_id: string; noteId: string; noteTitle: string }[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [deletingImage, setDeletingImage] = useState<string | null>(null);

  // Sharing state
  const [mySharedNotes, setMySharedNotes] = useState<any[]>([]);
  const [loadingShares, setLoadingShares] = useState(false);
  const [togglingShare, setTogglingShare] = useState<string | null>(null);
  const [revokingShare, setRevokingShare] = useState<string | null>(null);

  // Export state
  const [exporting, setExporting] = useState(false);

  // UI state
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "danger"; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState("appearance");

  useEffect(() => {
    if (show) {
      setSelectedTheme(theme);
      setBackgroundType(currentPreferences.backgroundType || "none");
      setSelectedDefault(currentPreferences.defaultBackground);
      setCustomBgUrl(currentPreferences.backgroundImage);
      setName(user?.name || "");
      setMessage(null);
    }
  }, [show, theme, currentPreferences, user]);

  // Load images when storage tab is selected
  useEffect(() => {
    if (show && activeTab === "storage") {
      loadUserImages();
    }
    if (show && activeTab === "sharing") {
      loadMySharedNotes();
    }
  }, [show, activeTab]);

  const loadUserImages = async () => {
    setLoadingImages(true);
    try {
      const response = await settingsAPI.getImages();
      setUserImages(response.data.images || []);
    } catch (error) {
      console.error("Failed to load images:", error);
      setMessage({ type: "danger", text: "Failed to load images" });
    } finally {
      setLoadingImages(false);
    }
  };

  const loadMySharedNotes = async () => {
    setLoadingShares(true);
    try {
      const response = await shareAPI.getMyShared();
      setMySharedNotes(response.data || []);
    } catch (error) {
      console.error("Failed to load shared notes:", error);
      setMessage({ type: "danger", text: "Failed to load shared notes" });
    } finally {
      setLoadingShares(false);
    }
  };

  const handleToggleShareAccess = async (noteId: string, userId: string, currentActive: boolean) => {
    const shareKey = `${noteId}-${userId}`;
    setTogglingShare(shareKey);
    try {
      await shareAPI.toggleAccess(noteId, userId, !currentActive);
      // Update local state
      setMySharedNotes(prev => prev.map(note => ({
        ...note,
        sharedWith: note.sharedWith.map((share: any) => 
          share.user._id === userId ? { ...share, active: !currentActive } : share
        )
      })));
      setMessage({ type: "success", text: `Access ${!currentActive ? "enabled" : "disabled"}` });
    } catch (error: any) {
      setMessage({ type: "danger", text: error.response?.data?.error || "Failed to toggle access" });
    } finally {
      setTogglingShare(null);
    }
  };

  const handleRevokeShare = async (noteId: string, userId: string) => {
    const shareKey = `${noteId}-${userId}`;
    setRevokingShare(shareKey);
    try {
      await shareAPI.revokeAccess(noteId, userId);
      // Update local state - remove this share
      setMySharedNotes(prev => prev.map(note => ({
        ...note,
        sharedWith: note.sharedWith.filter((share: any) => share.user._id !== userId)
      })).filter(note => note.sharedWith.length > 0));
      setMessage({ type: "success", text: "Access revoked permanently" });
    } catch (error: any) {
      setMessage({ type: "danger", text: error.response?.data?.error || "Failed to revoke access" });
    } finally {
      setRevokingShare(null);
    }
  };

  const handleDeleteImage = async (publicId: string) => {
    if (!confirm("Are you sure you want to delete this image? It will also be removed from the note.")) {
      return;
    }

    setDeletingImage(publicId);
    try {
      await settingsAPI.deleteImage(publicId);
      setUserImages(prev => prev.filter(img => img.public_id !== publicId));
      setMessage({ type: "success", text: "Image deleted successfully" });
    } catch (error: any) {
      setMessage({ type: "danger", text: error.response?.data?.error || "Failed to delete image" });
    } finally {
      setDeletingImage(null);
    }
  };

  const handleThemeChange = async (newTheme: "light" | "dark") => {
    setSelectedTheme(newTheme);
    setTheme(newTheme);
    
    try {
      await settingsAPI.updatePreferences({ theme: newTheme });
      onPreferencesChange({ ...currentPreferences, theme: newTheme });
    } catch (error) {
      console.error("Failed to save theme:", error);
    }
  };

  const handleBackgroundTypeChange = async (type: "none" | "default" | "custom") => {
    setBackgroundType(type);
    
    const newPrefs: Partial<UserPreferences> = { backgroundType: type };
    
    if (type === "none") {
      newPrefs.backgroundImage = null;
      newPrefs.defaultBackground = null;
    } else if (type === "default" && selectedDefault) {
      const bg = DEFAULT_BACKGROUNDS.find(b => b.key === selectedDefault);
      newPrefs.backgroundImage = bg?.url || null;
    } else if (type === "custom") {
      newPrefs.backgroundImage = customBgUrl;
    }

    try {
      await settingsAPI.updatePreferences(newPrefs);
      onPreferencesChange({ ...currentPreferences, ...newPrefs } as UserPreferences);
    } catch (error) {
      console.error("Failed to save background:", error);
    }
  };

  const handleDefaultBgSelect = async (key: string) => {
    setSelectedDefault(key);
    const bg = DEFAULT_BACKGROUNDS.find(b => b.key === key);
    
    if (bg) {
      try {
        await settingsAPI.updatePreferences({
          backgroundType: "default",
          defaultBackground: key,
          backgroundImage: bg.url,
        });
        onPreferencesChange({
          ...currentPreferences,
          backgroundType: "default",
          defaultBackground: key,
          backgroundImage: bg.url,
        });
      } catch (error) {
        console.error("Failed to save default background:", error);
      }
    }
  };

  const handleCustomBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setMessage({ type: "danger", text: "Please upload an image file" });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: "danger", text: "Image must be less than 5MB" });
      return;
    }

    setUploadingBg(true);
    try {
      const response = await uploadAPI.upload(file);
      const imageUrl = response.data.url;
      
      setCustomBgUrl(imageUrl);
      await settingsAPI.updatePreferences({
        backgroundType: "custom",
        backgroundImage: imageUrl,
      });
      onPreferencesChange({
        ...currentPreferences,
        backgroundType: "custom",
        backgroundImage: imageUrl,
      });
      setBackgroundType("custom");
      setMessage({ type: "success", text: "Background uploaded successfully!" });
    } catch (error) {
      console.error("Failed to upload background:", error);
      setMessage({ type: "danger", text: "Failed to upload background image" });
    } finally {
      setUploadingBg(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!name.trim()) {
      setMessage({ type: "danger", text: "Name cannot be empty" });
      return;
    }

    setSaving(true);
    try {
      const response = await settingsAPI.updateProfile({ name: name.trim() });
      // Update localStorage
      const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
      storedUser.name = response.data.user.name;
      localStorage.setItem("user", JSON.stringify(storedUser));
      
      setMessage({ type: "success", text: "Profile updated successfully!" });
      // Force page reload to update the user context
      setTimeout(() => window.location.reload(), 1000);
    } catch (error: any) {
      setMessage({ type: "danger", text: error.response?.data?.error || "Failed to update profile" });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage({ type: "danger", text: "All password fields are required" });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: "danger", text: "New passwords do not match" });
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: "danger", text: "New password must be at least 6 characters" });
      return;
    }

    setSaving(true);
    try {
      await settingsAPI.changePassword({ currentPassword, newPassword });
      setMessage({ type: "success", text: "Password changed successfully!" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      setMessage({ type: "danger", text: error.response?.data?.error || "Failed to change password" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      setMessage({ type: "danger", text: "Password is required to delete account" });
      return;
    }

    setSaving(true);
    try {
      await settingsAPI.deleteAccount(deletePassword);
      await logout();
      navigate("/login");
    } catch (error: any) {
      setMessage({ type: "danger", text: error.response?.data?.error || "Failed to delete account" });
      setSaving(false);
    }
  };

  const handleClearData = () => {
    localStorage.removeItem("hasSeenLoadingScreen_" + user?.id);
    setMessage({ type: "success", text: "Local data cleared. You'll see the loading screen on next login." });
  };

  const handleExportAllNotes = async () => {
    setExporting(true);
    setMessage(null);
    try {
      const response = await notesAPI.exportAll();
      
      // Create a blob from the response data
      const blob = new Blob([response.data], { type: "application/zip" });
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `notes-export-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setMessage({ type: "success", text: "Notes exported successfully!" });
    } catch (error: any) {
      console.error("Export failed:", error);
      setMessage({ type: "danger", text: error.response?.data?.error || "Failed to export notes" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered className="settings-modal">
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="bi bi-gear me-2"></i>
          Settings
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {message && (
          <Alert variant={message.type} dismissible onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        )}
        
        <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k || "appearance")}>
          <Nav variant="pills" className="mb-4 flex-wrap">
            <Nav.Item>
              <Nav.Link eventKey="appearance">
                <i className="bi bi-palette me-2"></i>
                Appearance
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="account">
                <i className="bi bi-person me-2"></i>
                Account
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="storage">
                <i className="bi bi-cloud me-2"></i>
                Storage
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="sharing">
                <i className="bi bi-share me-2"></i>
                Sharing
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="data">
                <i className="bi bi-database me-2"></i>
                Data
              </Nav.Link>
            </Nav.Item>
          </Nav>

          <Tab.Content>
            {/* Appearance Tab */}
            <Tab.Pane eventKey="appearance">
              {/* Theme Selection */}
              <div className="settings-section">
                <h6 className="settings-section-title">
                  <i className="bi bi-moon-stars me-2"></i>
                  Theme
                </h6>
                <div className="theme-options">
                  <div 
                    className={`theme-option ${selectedTheme === "light" ? "active" : ""}`}
                    onClick={() => handleThemeChange("light")}
                  >
                    <div className="theme-preview light-preview">
                      <i className="bi bi-sun-fill"></i>
                    </div>
                    <span>Light</span>
                  </div>
                  <div 
                    className={`theme-option ${selectedTheme === "dark" ? "active" : ""}`}
                    onClick={() => handleThemeChange("dark")}
                  >
                    <div className="theme-preview dark-preview">
                      <i className="bi bi-moon-fill"></i>
                    </div>
                    <span>Dark</span>
                  </div>
                </div>
              </div>

              {/* Background Selection */}
              <div className="settings-section mt-4">
                <h6 className="settings-section-title">
                  <i className="bi bi-image me-2"></i>
                  Background
                </h6>
                
                <Form.Group className="mb-3">
                  <Form.Check
                    type="radio"
                    id="bg-none"
                    label="No background image"
                    checked={backgroundType === "none"}
                    onChange={() => handleBackgroundTypeChange("none")}
                  />
                  <Form.Check
                    type="radio"
                    id="bg-default"
                    label="Choose from defaults"
                    checked={backgroundType === "default"}
                    onChange={() => handleBackgroundTypeChange("default")}
                  />
                  <Form.Check
                    type="radio"
                    id="bg-custom"
                    label="Upload custom image"
                    checked={backgroundType === "custom"}
                    onChange={() => handleBackgroundTypeChange("custom")}
                  />
                </Form.Group>

                {/* Default Backgrounds Grid */}
                {backgroundType === "default" && (
                  <div className="default-backgrounds-grid">
                    {DEFAULT_BACKGROUNDS.map((bg) => (
                      <div
                        key={bg.key}
                        className={`bg-option ${selectedDefault === bg.key ? "active" : ""}`}
                        onClick={() => handleDefaultBgSelect(bg.key)}
                        style={{ backgroundImage: `url(${bg.url})` }}
                      >
                        <span className="bg-option-name">{bg.name}</span>
                        {selectedDefault === bg.key && (
                          <div className="bg-option-check">
                            <i className="bi bi-check-circle-fill"></i>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Custom Upload */}
                {backgroundType === "custom" && (
                  <div className="custom-bg-upload">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleCustomBgUpload}
                      style={{ display: "none" }}
                    />
                    
                    {customBgUrl ? (
                      <div className="custom-bg-preview">
                        <img src={customBgUrl} alt="Custom background" />
                        <Button 
                          variant="outline-light" 
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingBg}
                        >
                          {uploadingBg ? <Spinner size="sm" /> : "Change Image"}
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        variant="outline-primary"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingBg}
                      >
                        {uploadingBg ? (
                          <>
                            <Spinner size="sm" className="me-2" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <i className="bi bi-cloud-upload me-2"></i>
                            Upload Background Image
                          </>
                        )}
                      </Button>
                    )}
                    <Form.Text className="text-muted d-block mt-2">
                      Max file size: 5MB. Recommended: 1920x1080 or larger.
                    </Form.Text>
                  </div>
                )}
              </div>
            </Tab.Pane>

            {/* Account Tab */}
            <Tab.Pane eventKey="account">
              {/* Profile Section */}
              <div className="settings-section">
                <h6 className="settings-section-title">
                  <i className="bi bi-person-circle me-2"></i>
                  Profile
                </h6>
                <Form.Group className="mb-3">
                  <Form.Label>Email</Form.Label>
                  <Form.Control type="email" value={user?.email || ""} disabled />
                  <Form.Text className="text-muted">Email cannot be changed</Form.Text>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Name</Form.Label>
                  <Form.Control 
                    type="text" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                  />
                </Form.Group>
                <Button variant="primary" onClick={handleUpdateProfile} disabled={saving}>
                  {saving ? <Spinner size="sm" /> : "Update Profile"}
                </Button>
              </div>

              {/* Change Password Section */}
              <div className="settings-section mt-4">
                <h6 className="settings-section-title">
                  <i className="bi bi-key me-2"></i>
                  Change Password
                </h6>
                <Form.Group className="mb-3">
                  <Form.Label>Current Password</Form.Label>
                  <Form.Control 
                    type="password" 
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>New Password</Form.Label>
                  <Form.Control 
                    type="password" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min 6 characters)"
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Confirm New Password</Form.Label>
                  <Form.Control 
                    type="password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                  />
                </Form.Group>
                <Button variant="primary" onClick={handleChangePassword} disabled={saving}>
                  {saving ? <Spinner size="sm" /> : "Change Password"}
                </Button>
              </div>

              {/* Danger Zone */}
              <div className="settings-section mt-4 danger-zone">
                <h6 className="settings-section-title text-danger">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  Danger Zone
                </h6>
                
                {/* Export Notes Before Deletion */}
                <div className="mb-4 p-3 border rounded" style={{ borderColor: 'var(--chat-border-color)' }}>
                  <h6 className="mb-2">
                    <i className="bi bi-download me-2"></i>
                    Export Your Notes
                  </h6>
                  <p className="text-muted small mb-2">
                    Download all your notes as a ZIP file containing PDFs before deleting your account.
                  </p>
                  <Button 
                    variant="outline-primary" 
                    onClick={handleExportAllNotes} 
                    disabled={exporting}
                  >
                    {exporting ? (
                      <>
                        <Spinner size="sm" className="me-2" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-file-earmark-zip me-2"></i>
                        Export All Notes as ZIP
                      </>
                    )}
                  </Button>
                </div>

                {!showDeleteConfirm ? (
                  <Button variant="outline-danger" onClick={() => setShowDeleteConfirm(true)}>
                    <i className="bi bi-trash me-2"></i>
                    Delete Account
                  </Button>
                ) : (
                  <div className="delete-confirm-box">
                    <p className="text-danger mb-2">
                      <strong>Warning:</strong> This action cannot be undone. All your notes and data will be permanently deleted.
                    </p>
                    <p className="text-muted small mb-3">
                      <i className="bi bi-info-circle me-1"></i>
                      Make sure to export your notes above before deleting your account.
                    </p>
                    {message && message.type === "danger" && activeTab === "account" && (
                      <Alert variant="danger" className="mb-3">
                        {message.text}
                      </Alert>
                    )}
                    <Form.Group className="mb-3">
                      <Form.Label>Enter your password to confirm</Form.Label>
                      <Form.Control 
                        type="password" 
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                        placeholder="Your password"
                        isInvalid={message?.text?.toLowerCase().includes("password")}
                      />
                    </Form.Group>
                    <Stack direction="horizontal" gap={2}>
                      <Button variant="danger" onClick={handleDeleteAccount} disabled={saving}>
                        {saving ? <Spinner size="sm" /> : "Confirm Delete"}
                      </Button>
                      <Button variant="secondary" onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeletePassword("");
                        setMessage(null);
                      }}>
                        Cancel
                      </Button>
                    </Stack>
                  </div>
                )}
              </div>
            </Tab.Pane>

            {/* Storage Tab */}
            <Tab.Pane eventKey="storage">
              <div className="settings-section">
                <h6 className="settings-section-title">
                  <i className="bi bi-images me-2"></i>
                  Uploaded Images
                </h6>
                <p className="text-muted mb-3">
                  View and manage all images you've uploaded to your notes. Images are stored in cloud storage.
                </p>
                
                {loadingImages ? (
                  <div className="text-center py-4">
                    <Spinner animation="border" variant="primary" />
                    <p className="mt-2 text-muted">Loading images...</p>
                  </div>
                ) : userImages.length === 0 ? (
                  <div className="text-center py-4 text-muted">
                    <i className="bi bi-image" style={{ fontSize: "3rem", opacity: 0.3 }}></i>
                    <p className="mt-2">No images uploaded yet</p>
                  </div>
                ) : (
                  <>
                    <div className="mb-3 text-muted">
                      <small>{userImages.length} image{userImages.length !== 1 ? "s" : ""} • Click on an image to view it</small>
                    </div>
                    <div className="user-images-grid">
                      {userImages.map((image) => (
                        <div key={image.public_id} className="user-image-item">
                          <a href={image.url} target="_blank" rel="noopener noreferrer">
                            <img src={image.url} alt="Uploaded" />
                          </a>
                          <div className="user-image-overlay">
                            <span className="user-image-note" title={image.noteTitle}>
                              {image.noteTitle.length > 20 ? image.noteTitle.substring(0, 20) + "..." : image.noteTitle}
                            </span>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleDeleteImage(image.public_id)}
                              disabled={deletingImage === image.public_id}
                              className="user-image-delete"
                            >
                              {deletingImage === image.public_id ? (
                                <Spinner size="sm" />
                              ) : (
                                <i className="bi bi-trash"></i>
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </Tab.Pane>

            {/* Sharing Tab */}
            <Tab.Pane eventKey="sharing">
              <div className="settings-section">
                <h6 className="settings-section-title">
                  <i className="bi bi-share me-2"></i>
                  Notes You've Shared
                </h6>
                <p className="text-muted mb-3">
                  Manage view access to notes you've shared with friends. You can toggle access on/off or revoke it permanently.
                </p>
                
                {loadingShares ? (
                  <div className="text-center py-4">
                    <Spinner animation="border" variant="primary" />
                    <p className="mt-2 text-muted">Loading shared notes...</p>
                  </div>
                ) : mySharedNotes.length === 0 ? (
                  <div className="text-center py-4 text-muted">
                    <i className="bi bi-share" style={{ fontSize: "3rem", opacity: 0.3 }}></i>
                    <p className="mt-2">You haven't shared any notes yet</p>
                    <small>Share notes with friends through the chat panel</small>
                  </div>
                ) : (
                  <div className="shared-notes-list">
                    {mySharedNotes.map((noteGroup) => (
                      <div key={noteGroup.note?._id} className="shared-note-item">
                        <div className="shared-note-header">
                          <i className="bi bi-file-text me-2"></i>
                          <strong>{noteGroup.note?.title || "Deleted Note"}</strong>
                        </div>
                        <div className="shared-with-list">
                          {noteGroup.sharedWith.map((share: any) => (
                            <div key={share.user._id} className="shared-with-item">
                              <div className="shared-user-info">
                                <div className="shared-user-avatar">
                                  {share.user.name?.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="shared-user-name">{share.user.name}</div>
                                  <div className="shared-user-email">{share.user.email}</div>
                                </div>
                              </div>
                              <div className="shared-actions">
                                <Badge bg={share.active ? "success" : "secondary"} className="me-2">
                                  {share.active ? "Active" : "Disabled"}
                                </Badge>
                                <Button
                                  variant={share.active ? "outline-warning" : "outline-success"}
                                  size="sm"
                                  onClick={() => handleToggleShareAccess(noteGroup.note._id, share.user._id, share.active)}
                                  disabled={togglingShare === `${noteGroup.note._id}-${share.user._id}`}
                                  title={share.active ? "Disable access" : "Enable access"}
                                >
                                  {togglingShare === `${noteGroup.note._id}-${share.user._id}` ? (
                                    <Spinner size="sm" />
                                  ) : (
                                    <i className={`bi ${share.active ? "bi-pause" : "bi-play"}`}></i>
                                  )}
                                </Button>
                                <Button
                                  variant="outline-danger"
                                  size="sm"
                                  onClick={() => {
                                    if (confirm(`Remove ${share.user.name}'s access permanently?`)) {
                                      handleRevokeShare(noteGroup.note._id, share.user._id);
                                    }
                                  }}
                                  disabled={revokingShare === `${noteGroup.note._id}-${share.user._id}`}
                                  title="Revoke access permanently"
                                >
                                  {revokingShare === `${noteGroup.note._id}-${share.user._id}` ? (
                                    <Spinner size="sm" />
                                  ) : (
                                    <i className="bi bi-x-lg"></i>
                                  )}
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Tab.Pane>

            {/* Data Tab */}
            <Tab.Pane eventKey="data">
              <div className="settings-section">
                <h6 className="settings-section-title">
                  <i className="bi bi-hdd me-2"></i>
                  Local Storage
                </h6>
                <p className="text-muted mb-3">
                  Clear locally cached data. This won't affect your notes stored in the cloud.
                </p>
                <Button variant="outline-secondary" onClick={handleClearData}>
                  <i className="bi bi-arrow-counterclockwise me-2"></i>
                  Reset Loading Screen
                </Button>
                <Form.Text className="text-muted d-block mt-2">
                  This will show the welcome animation again on your next login.
                </Form.Text>
              </div>

              <div className="settings-section mt-4">
                <h6 className="settings-section-title">
                  <i className="bi bi-info-circle me-2"></i>
                  About
                </h6>
                <p className="text-muted mb-1">NoteGPT v1.0.0</p>
                <p className="text-muted mb-1">A modern note-taking app with AI assistance.</p>
                <p className="text-muted">Made with ❤️ using React & TypeScript</p>
              </div>
            </Tab.Pane>
          </Tab.Content>
        </Tab.Container>
      </Modal.Body>
    </Modal>
  );
}
