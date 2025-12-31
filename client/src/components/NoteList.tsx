import { useMemo, useState } from "react"
import {
  Badge,
  Button,
  Card,
  Col,
  Form,
  Modal,
  Row,
  Stack,
  Spinner,
} from "react-bootstrap"
import { Link } from "react-router-dom"
import ReactSelect from "react-select"
import type { Tag } from "../App"
import styles from "../NoteList.module.css"
import { useTheme } from "./ThemeContext"

type SimplifiedNote = {
  tags: string[]
  title: string
  id?: string
  isShared?: boolean
  sharedBy?: { name: string; email: string }
}

type NoteListProps = {
  availableTags: Tag[]
  notes: SimplifiedNote[]
  onDeleteTag: (id: string) => void
  onUpdateTag: (id: string, label: string) => void
  onDeleteNotes?: (ids: string[]) => Promise<void>
}

type EditTagsModalProps = {
  show: boolean
  availableTags: Tag[]
  handleClose: () => void
  onDeleteTag: (id: string) => void
  onUpdateTag: (id: string, label: string) => void
}

export function NoteList({
  availableTags,
  notes,
  onUpdateTag,
  onDeleteTag,
  onDeleteNotes,
}: NoteListProps) {
  const { theme } = useTheme();
  const [selectedTags, setSelectedTags] = useState<Tag[]>([])
  const [title, setTitle] = useState("")
  const [editTagsModalIsOpen, setEditTagsModalIsOpen] = useState(false)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set())
  const [deletingNotes, setDeletingNotes] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Filter out shared notes for selection mode (can only delete own notes)
  const ownNotes = useMemo(() => notes.filter(note => !note.isShared), [notes])

  const filteredNotes = useMemo(() => {
    return notes.filter(note => {
      const titleMatch = title === "" || note.title.toLowerCase().includes(title.toLowerCase());
      
      const tagsMatch = selectedTags.length === 0 || selectedTags.every(selectedTag => {
        // note.tags is an array of tag labels (strings), not IDs
        return note.tags.some(noteTagLabel => {
          // Compare the label strings
          return noteTagLabel === selectedTag.label;
        });
      });
      
      return titleMatch && tagsMatch;
    })
  }, [title, selectedTags, notes])

  const toggleNoteSelection = (noteId: string) => {
    setSelectedNotes(prev => {
      const newSet = new Set(prev)
      if (newSet.has(noteId)) {
        newSet.delete(noteId)
      } else {
        newSet.add(noteId)
      }
      return newSet
    })
  }

  const selectAllOwn = () => {
    const ownFilteredNotes = filteredNotes.filter(n => !n.isShared && n.id)
    setSelectedNotes(new Set(ownFilteredNotes.map(n => n.id!)))
  }

  const clearSelection = () => {
    setSelectedNotes(new Set())
  }

  const exitSelectionMode = () => {
    setSelectionMode(false)
    setSelectedNotes(new Set())
  }

  const handleDeleteSelected = async () => {
    if (selectedNotes.size === 0 || !onDeleteNotes) return
    
    setDeletingNotes(true)
    try {
      await onDeleteNotes(Array.from(selectedNotes))
      setSelectedNotes(new Set())
      setShowDeleteConfirm(false)
      setSelectionMode(false)
    } catch (error) {
      console.error("Failed to delete notes:", error)
    } finally {
      setDeletingNotes(false)
    }
  }

  return (
    <>
      <Row className="align-items-center mb-4">
        <Col>
          <h1 className="app-title">
            <i className="bi bi-journal-text me-2"></i>
            Note<span className="app-title-accent">GPT</span>
          </h1>
        </Col>
        <Col xs="auto">
          {selectionMode ? (
            <Stack gap={2} direction="horizontal">
              <span className="text-muted me-2">
                {selectedNotes.size} selected
              </span>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={selectAllOwn}
              >
                Select All
              </Button>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={clearSelection}
              >
                Clear
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={selectedNotes.size === 0}
              >
                <i className="bi bi-trash me-1"></i>
                Delete ({selectedNotes.size})
              </Button>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={exitSelectionMode}
              >
                Cancel
              </Button>
            </Stack>
          ) : (
            <Stack gap={2} direction="horizontal">
              <Link to="/new">
                <Button variant="primary">
                  <i className="bi bi-plus-lg me-1"></i> Create
                </Button>
              </Link>
              {ownNotes.length > 0 && (
                <Button
                  onClick={() => setSelectionMode(true)}
                  variant="outline-secondary"
                >
                  <i className="bi bi-check2-square me-1"></i> Select
                </Button>
              )}
              <Button
                onClick={() => setEditTagsModalIsOpen(true)}
                variant="outline-secondary"
              >
                <i className="bi bi-tags me-1"></i> Edit Tags
              </Button>
            </Stack>
          )}
        </Col>
      </Row>
      <Form>
        <Row className="mb-4">
          <Col>
            <Form.Group controlId="title">
              <Form.Label>Title</Form.Label>
              <Form.Control
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </Form.Group>
          </Col>
          <Col>
            <Form.Group controlId="tags">
              <Form.Label>Tags</Form.Label>
              <ReactSelect
                value={selectedTags.map(tag => {
                  return { label: tag.label, value: tag.id }
                })}
                options={availableTags.map(tag => {
                  return { label: tag.label, value: tag.id }
                })}
                onChange={tags => {
                  setSelectedTags(
                    tags.map(tag => {
                      return { label: tag.label, id: tag.value }
                    })
                  )
                }}
                isMulti
                placeholder="Filter by tags..."
                styles={{ 
                  control: (baseStyles, state) => ({
                    ...baseStyles,
                    backgroundColor: theme === "dark" ? "#1e293b" : "#ffffff",
                    borderRadius: "8px",
                    borderWidth: "1.5px",
                    boxShadow: state.isFocused ? "0 0 0 3px rgba(99, 102, 241, 0.15)" : "none",
                    "&:hover": {
                      borderColor: "#6366f1",
                    },
                    borderColor: state.isFocused ? "#6366f1" : theme === "dark" ? "#475569" : "#cbd5e1",
                    transition: "all 200ms ease",
                  }),
                  menu: (base) => ({
                    ...base,
                    backgroundColor: theme === "dark" ? "#1e293b" : "#ffffff",
                    borderRadius: "12px",
                    border: theme === "dark" ? "1px solid #334155" : "1px solid #e2e8f0",
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.2)",
                    overflow: "hidden",
                  }),
                  option: (base, state) => ({
                    ...base,
                    backgroundColor: state.isFocused 
                      ? (theme === "dark" ? "#334155" : "#f1f5f9") 
                      : "transparent",
                    color: theme === "dark" ? "#e2e8f0" : "#1e293b",
                    cursor: "pointer",
                    transition: "background-color 150ms ease",
                  }),
                  multiValue: (base) => ({
                    ...base,
                    background: "linear-gradient(135deg, #6366f1 0%, #818cf8 100%)",
                    borderRadius: "20px",
                    padding: "2px",
                  }),
                  multiValueLabel: (base) => ({
                    ...base,
                    color: "white",
                    fontWeight: "500",
                    padding: "2px 8px",
                  }),
                  multiValueRemove: (base) => ({
                    ...base,
                    color: "white",
                    borderRadius: "0 20px 20px 0",
                    ":hover": {
                      backgroundColor: "rgba(255,255,255,0.2)",
                      color: "white",
                    },
                  }),
                  placeholder: (base) => ({
                    ...base,
                    color: theme === "dark" ? "#64748b" : "#94a3b8",
                  }),
                  input: (base) => ({
                    ...base,
                    color: theme === "dark" ? "#e2e8f0" : "#1e293b",
                  }),
                 }}
              />
            </Form.Group>
          </Col>
        </Row>
      </Form>
      <Row xs={1} sm={2} lg={3} xl={4} className="g-3">
        {filteredNotes.map(note => (
          <Col key={note.id}>
            <NoteCard 
              id={note.id} 
              title={note.title} 
              tags={note.tags} 
              isShared={note.isShared}
              sharedBy={note.sharedBy}
              selectionMode={selectionMode}
              isSelected={selectedNotes.has(note.id || '')}
              onSelect={() => note.id && toggleNoteSelection(note.id)}
            />
          </Col>
        ))}
      </Row>
      
      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteConfirm} onHide={() => setShowDeleteConfirm(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Delete Notes</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Are you sure you want to delete <strong>{selectedNotes.size}</strong> note{selectedNotes.size !== 1 ? 's' : ''}?</p>
          <p className="text-danger mb-0">
            <i className="bi bi-exclamation-triangle me-2"></i>
            This action cannot be undone.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDeleteSelected} disabled={deletingNotes}>
            {deletingNotes ? (
              <>
                <Spinner size="sm" className="me-2" />
                Deleting...
              </>
            ) : (
              <>Delete {selectedNotes.size} Note{selectedNotes.size !== 1 ? 's' : ''}</>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
      
      <EditTagsModal
        onUpdateTag={onUpdateTag}
        onDeleteTag={onDeleteTag}
        show={editTagsModalIsOpen}
        handleClose={() => setEditTagsModalIsOpen(false)}
        availableTags={availableTags}
      />
    </>
  )
}

function NoteCard({ id, title, tags, isShared, sharedBy, selectionMode, isSelected, onSelect }: SimplifiedNote & {
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
}) {
  const handleClick = (e: React.MouseEvent) => {
    if (selectionMode && !isShared) {
      e.preventDefault();
      onSelect?.();
    }
  };

  return (
    <Card
      as={selectionMode && !isShared ? 'div' : Link}
      {...(!(selectionMode && !isShared) && { to: `/${id}` })}
      onClick={handleClick}
      className={`h-100 text-reset text-decoration-none ${styles.card} ${isShared ? styles.sharedCard : ''} ${isSelected ? styles.selectedCard : ''} ${selectionMode && !isShared ? styles.selectableCard : ''}`}
      style={{ cursor: selectionMode && !isShared ? 'pointer' : undefined }}
    >
      <Card.Body>
        <Stack
          gap={2}
          className="align-items-center justify-content-center h-100"
        >
          {selectionMode && !isShared && (
            <div className={`position-absolute top-0 start-0 m-2 ${styles.selectCheckbox}`}>
              <Form.Check
                type="checkbox"
                checked={isSelected}
                onChange={() => onSelect?.()}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
          {isShared && (
            <Badge bg="info" className="position-absolute top-0 end-0 m-2">
              <i className="bi bi-eye me-1"></i> View Only
            </Badge>
          )}
          <span className="fs-5">{title}</span>
          {isShared && sharedBy && (
            <small className="text-muted">
              Shared by {sharedBy.name}
            </small>
          )}
          {tags.length > 0 && (
            <Stack
              gap={1}
              direction="horizontal"
              className="justify-content-center flex-wrap"
            >
              {tags.map((tag, index) => (
                <Badge className="text-truncate" key={index}>
                  {tag}
                </Badge>
              ))}
            </Stack>
          )}
        </Stack>
      </Card.Body>
    </Card>
  )
}

function EditTagsModal({
  availableTags,
  handleClose,
  show,
  onDeleteTag,
  onUpdateTag,
}: EditTagsModalProps) {
  return (
    <Modal show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Edit Tags</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Stack gap={2}>
            {availableTags.map(tag => (
              <Row key={tag.id || tag._id}>
                <Col>
                  <Form.Control
                    type="text"
                    value={tag.label}
                    onChange={e => onUpdateTag(tag.id || tag._id || '', e.target.value)}
                  />
                </Col>
                <Col xs="auto">
                  <Button
                    onClick={() => onDeleteTag(tag.id || tag._id || '')}
                    variant="outline-danger"
                  >
                    &times;
                  </Button>
                </Col>
              </Row>
            ))}
          </Stack>
        </Form>
      </Modal.Body>
    </Modal>
  )
}
