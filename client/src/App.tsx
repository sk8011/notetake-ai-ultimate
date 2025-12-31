import "bootstrap/dist/css/bootstrap.min.css"
import 'bootstrap-icons/font/bootstrap-icons.css';
import { useMemo, useState, useEffect, useRef } from "react"
import { Container, Button } from "react-bootstrap"
import { Routes, Route, Navigate, useLocation } from "react-router-dom"
import { NewNote } from "./components/NewNote"
import { NoteList } from "./components/NoteList"
import { NoteLayout } from "./components/NoteLayout"
import { Note } from "./components/Note"
import { EditNote } from "./components/EditNote"
import ChatBot from "./components/Chatbot"
import { ChatIcon } from "./components/Chat"
import { Settings } from "./components/Settings"
import type { UserPreferences } from "./components/Settings"
import { ThemeProvider, useTheme } from "./components/ThemeContext"
import { SocketProvider } from "./context/SocketContext"
import { LoadingScreen } from "./components/LoadingScreen"
import { Login } from "./components/Login"
import { Register } from "./components/Register"
import { PrivateRoute } from "./components/PrivateRoute"
import { AuthProvider, useAuth } from "./contexts/AuthContext"
import { notesAPI, tagsAPI, settingsAPI, shareAPI } from "./services/api"

export type Note = {
  _id?: string;
  id?: string;
  isShared?: boolean;
  sharedBy?: { name: string; email: string };
} & NoteData

export type RawNote = {
  _id?: string;
  id?: string;
  images: { url: string; public_id: string }[];
  isShared?: boolean;
  sharedBy?: { name: string; email: string };
} & RawNoteData

export type RawNoteData = {
  title: string
  markdown: string
  tags: string[]
}

export type NoteData = {
  title: string
  markdown: string
  tags: string[]
  images: { url: string; public_id: string }[];
}

export type Tag = {
  _id?: string;
  id?: string;
  label: string
}

function MainApp() {
  const [notes, setNotes] = useState<RawNote[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const location = useLocation();
  const isMainScreen = location.pathname === "/";
  const [isLoaded, setIsLoaded] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [userPreferences, setUserPreferences] = useState<UserPreferences>({
    theme: "dark",
    backgroundImage: null,
    backgroundType: "none",
    defaultBackground: null,
  });
  const { user, logout } = useAuth();
  const { setTheme } = useTheme();
  const hasProcessedUser = useRef(false);

  // Load user preferences
  useEffect(() => {
    if (user) {
      settingsAPI.getPreferences()
        .then(response => {
          const prefs = response.data.preferences;
          if (prefs) {
            setUserPreferences(prefs);
            if (prefs.theme) {
              setTheme(prefs.theme);
            }
          }
        })
        .catch(err => console.error("Failed to load preferences:", err));
    }
  }, [user?.id]);

  useEffect(() => {
    // Only process once per user session
    if (hasProcessedUser.current) {
      return;
    }
    
    if (user) {
      hasProcessedUser.current = true;
      
      // Check if we've already shown loading screen for this session
      const hasSeenLoadingScreen = localStorage.getItem("hasSeenLoadingScreen_" + user.id);
      
      if (!hasSeenLoadingScreen) {
        // First time - show loading screen, DON'T load data yet
        setIsLoaded(false);
        setDataLoading(false);
        localStorage.setItem("hasSeenLoadingScreen_" + user.id, "true");
      } else {
        // Already seen it - skip loading screen and load data immediately
        setIsLoaded(true);
        loadData();
      }
    } else {
      setDataLoading(false);
    }
  }, [user?.id]);

  // When LoadingScreen completes and isLoaded becomes true, load the data
  useEffect(() => {
    if (isLoaded && dataLoading === false && user) {
      loadData();
    }
  }, [isLoaded, user?.id]);

  const loadData = async () => {
    try {
      setDataLoading(true);
      const [notesResponse, tagsResponse, sharedNotesResponse] = await Promise.all([
        notesAPI.getAll(),
        tagsAPI.getAll(),
        shareAPI.getSharedWithMe(),
      ]);
      
      // Own notes
      const ownNotes = notesResponse.data.map((note: any) => ({
        ...note,
        id: note._id,
        isShared: false,
      }));
      
      // Shared notes (view-only)
      const sharedNotes = sharedNotesResponse.data.map((share: any) => ({
        ...share.note,
        id: share.note._id,
        isShared: true,
        sharedBy: share.owner,
      }));
      
      setNotes([...ownNotes, ...sharedNotes]);
      
      setTags(tagsResponse.data.map((tag: any) => ({
        ...tag,
        id: tag._id,
      })));
    } catch (error) {
      console.error("[MainApp] Failed to load data:", error);
    } finally {
      setDataLoading(false);
    }
  };

  const notesWithTags = useMemo(() => {
    return notes.map(note => {
      return { 
        ...note,
        id: note.id || note._id,
        tags: note.tags || [],
        images: note.images || []
      }
    }).filter(note => note.id) as Array<RawNote & { id: string }>
  }, [notes, tags])

  async function onCreateNote({ tags, images, ...data }: NoteData) {
    try {
      const response = await notesAPI.create({
        ...data,
        tags: tags || [],
        images: images || [],
      });
      setNotes(prevNotes => [...prevNotes, { ...response.data, id: response.data._id }]);
      
      // Reload tags to get any new ones
      const tagsResponse = await tagsAPI.getAll();
      setTags(tagsResponse.data.map((tag: any) => ({ ...tag, id: tag._id })));
    } catch (error) {
      console.error("Failed to create note:", error);
      alert("Failed to create note");
    }
  }

  async function onUpdateNote(id: string, { tags, images, ...data }: NoteData) {
    try {
      const response = await notesAPI.update(id, {
        ...data,
        tags: tags || [],
        images: images || [],
      });
      const updatedNote = response.data;
      setNotes(prevNotes =>
        prevNotes.map(note =>
          note.id === id || note._id === id
            ? { ...updatedNote, id: updatedNote._id }
            : note
        )
      );
      
      // Reload tags to get any new ones
      const tagsResponse = await tagsAPI.getAll();
      setTags(tagsResponse.data.map((tag: any) => ({ ...tag, id: tag._id })));
    } catch (error) {
      console.error("Failed to update note:", error);
      alert("Failed to update note");
    }
  }

  async function onDeleteNote(id: string) {
    try {
      await notesAPI.delete(id);
      setNotes(prevNotes => prevNotes.filter(note => note.id !== id && note._id !== id));
    } catch (error) {
      console.error("Failed to delete note:", error);
      alert("Failed to delete note");
    }
  }

  async function onDeleteNotes(ids: string[]) {
    try {
      await notesAPI.deleteMany(ids);
      setNotes(prevNotes => prevNotes.filter(note => 
        !ids.includes(note.id || '') && !ids.includes(note._id || '')
      ));
    } catch (error) {
      console.error("Failed to delete notes:", error);
      throw error;
    }
  }

  async function updateTag(id: string, label: string) {
    try {
      await tagsAPI.update(id, { label });
      setTags(prevTags =>
        prevTags.map(tag =>
          tag.id === id || tag._id === id ? { ...tag, label } : tag
        )
      );
      // Reload notes to see updated tags
      await loadData();
    } catch (error) {
      console.error("Failed to update tag:", error);
      alert("Failed to update tag");
    }
  }

  async function deleteTag(id: string) {
    try {
      await tagsAPI.delete(id);
      setTags(prevTags => prevTags.filter(tag => tag.id !== id && tag._id !== id));
      // Reload notes to see updated tags
      await loadData();
    } catch (error) {
      console.error("Failed to delete tag:", error);
      alert("Failed to delete tag");
    }
  }

  const handleLogout = async () => {
    await logout();
  };

  // Show LoadingScreen first if user hasn't seen it yet
  if (!isLoaded && !dataLoading) {
    return <LoadingScreen onComplete={()=>{setIsLoaded(true)}} />;
  }

  // Show spinner while loading data
  if (dataLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "100vh" }}>
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Background Image */}
      {userPreferences.backgroundType !== "none" && userPreferences.backgroundImage && (
        <div 
          className="app-background" 
          style={{ backgroundImage: `url(${userPreferences.backgroundImage})` }}
        />
      )}
      
      <Container fluid className="my-4 px-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <button className="settings-btn" onClick={() => setShowSettings(true)}>
            <i className="bi bi-gear-fill"></i>
            <span className="btn-label">Settings</span>
          </button>
          <div className="d-flex align-items-center gap-3">
            <span>Welcome, {user?.name}!</span>
            <Button variant="outline-danger" size="sm" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>
        <Routes>
          <Route
            path="/"
            element={
              <NoteList
                notes={notesWithTags}
                availableTags={tags}
                onUpdateTag={updateTag}
                onDeleteTag={deleteTag}
                onDeleteNotes={onDeleteNotes}
              />
            }
          />
          <Route
            path="/new"
            element={
              <NewNote
                onSubmit={onCreateNote}
                onAddTag={() => {}}
                availableTags={tags}
              />
            }
          />
          <Route path="/:id" element={<NoteLayout notes={notesWithTags} />}>
            <Route index element={<Note onDelete={onDeleteNote} />} />
            <Route
              path="edit"
            element={
              <EditNote
                onSubmit={onUpdateNote}
                onAddTag={() => {}}
                availableTags={tags}
              />
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      {isMainScreen && (
        <>
          <ChatBot notes={notesWithTags} />
          <ChatIcon notes={notesWithTags} />
        </>
      )}
      
      {/* Settings Modal */}
      <Settings 
        show={showSettings}
        onHide={() => setShowSettings(false)}
        onPreferencesChange={setUserPreferences}
        currentPreferences={userPreferences}
      />
    </Container>
    </>
  )
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SocketProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/*"
              element={
                <PrivateRoute>
                  <MainApp />
                </PrivateRoute>
              }
            />
          </Routes>
        </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
