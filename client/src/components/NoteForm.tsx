import type {FormEvent} from "react"
import { useRef, useState, useEffect } from "react"
import { Button, Col, Form, Row, Stack, OverlayTrigger, Popover } from "react-bootstrap"
import { Link, useNavigate } from "react-router-dom"
import CreatableReactSelect from "react-select/creatable"
import type { NoteData, Tag } from "../App"
import { v4 as uuidV4 } from "uuid"
import MarkdownViewer from "./MarkdownViewer"
import { uploadAPI } from "../services/api"

type NoteFormProps = {
  onSubmit: (data: NoteData) => void
  onAddTag: (tag: Tag) => void
  availableTags: Tag[]
} & Partial<NoteData>

export function NoteForm({
  onSubmit,
  onAddTag,
  availableTags,
  title = "",
  markdown = "",
  tags = [],
  images = [],
}: NoteFormProps) {
  const titleRef = useRef<HTMLInputElement>(null)
  const markdownRef = useRef<HTMLTextAreaElement>(null)
  // Normalize incoming tags so id/label are always present; avoids undefined keys in react-select
  const [selectedTags, setSelectedTags] = useState<Tag[]>(() => {
    const normalized = (tags as Array<Tag | string>).map(tag => {
      if (typeof tag === "string") {
        return { id: tag, label: tag }
      } else {
        const id = tag.id || (tag as any)._id || tag.label
        return { ...tag, id, label: tag.label }
      }
    })
    
    // Remove duplicates based on both id and label
    const unique = normalized.filter((tag, index, arr) => 
      arr.findIndex(t => t.id === tag.id && t.label === tag.label) === index
    )
    
    return unique
  })
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [localMarkdown, setLocalMarkdown] = useState(markdown)
  const [localImages, setLocalImages] = useState(images);
  const [showImageHelp, setShowImageHelp] = useState(false);

  
  useEffect(() => {
    const tempUploads = JSON.parse(localStorage.getItem("tempUploads") || "[]");

    if (tempUploads.length > 0) {
      Promise.all(
        tempUploads.map((public_id: string) =>
          uploadAPI.deleteImage(public_id)
        )
      )
        .then(() => {
          localStorage.removeItem("tempUploads");
        })
        .catch((err) => console.error("Cleanup failed", err));
    }
  }, []);


  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Trigger only if markdown has unsaved edits or there are temp uploads
      const hasUnsavedWork =
        localMarkdown !== markdown || localStorage.getItem("tempUploads");

      if (hasUnsavedWork) {
        e.preventDefault();
        e.returnValue = ""; // required for Chrome and most browsers
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [localMarkdown, markdown]);


  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const referencedImages = localImages.filter(image =>
      localMarkdown.includes(image.url)
    );

    const unreferencedImages = localImages.filter(
      image => !referencedImages.some(ref => ref.public_id === image.public_id)
    );

    // Delete images that are no longer referenced
    await Promise.all(
      unreferencedImages.map(image =>
        deleteImage(image.public_id, false) // false => don't touch markdown
      )
    );

    // Proceed with saving only the referenced images
    onSubmit({
      title: titleRef.current!.value,
      markdown: localMarkdown,
      tags: selectedTags.map(tag => tag.label),
      images: referencedImages,
    });

    localStorage.removeItem("tempUploads");

    navigate("..");
  }


  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const response = await uploadAPI.upload(file);
        const data = response.data;
        
        const newImage = { url: data.url, public_id: data.public_id };

        // Save to state
        setLocalImages(prev => [...prev, newImage]);

        // Save to localStorage
        const tempUploads = JSON.parse(localStorage.getItem("tempUploads") || "[]");
        localStorage.setItem("tempUploads", JSON.stringify([...tempUploads, data.public_id]));

        
        // Add the image markdown to the localMarkdown
        const imageMarkdown = `![${file.name}](${data.url})`;
        
        // Insert at cursor position if possible
        if (markdownRef.current) {
          const textarea = markdownRef.current;
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const newMarkdown = 
            localMarkdown.substring(0, start) + "\n\n" +
            imageMarkdown + "\n\n" +
            localMarkdown.substring(end);
          setLocalMarkdown(newMarkdown);
        } else {
          // Fallback to appending at the end
          setLocalMarkdown(prev => prev + "\n" + imageMarkdown );
        }
        // show image help after successful upload
        setShowImageHelp(true);
        setTimeout(() => setShowImageHelp(false), 4000); // auto-hide after 4s

      } catch (err: any) {
        console.error("[NoteForm] Upload failed:", err);
        console.error("[NoteForm] Error response:", err.response?.data);
        console.error("[NoteForm] Error status:", err.response?.status);
        const errorMsg = err.response?.data?.error || err.message || "Upload failed";
        alert(`Failed to upload image: ${errorMsg}`);
      } finally {
        // Clear the file input so the same file can be selected again
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    }
  };

  const deleteImage = async (public_id: string, updateMarkdown = true) => {
    try {
      const response = await fetch("https://notetake-ai.onrender.com/api/delete-image", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ public_id }),
      });
      await uploadAPI.deleteImage(public_id);
      if (!response.ok) throw new Error("Deletion failed");
      
      // Get the image URL before removing it from localImages
      const imageToDelete = localImages.find(img => img.public_id === public_id);
      
      if (imageToDelete) {
        // Remove the image from localImages
        setLocalImages(prev => prev.filter(image => image.public_id !== public_id));
        
        // Remove the image markdown from localMarkdown if requested
        if (updateMarkdown) {
          const imageUrl = imageToDelete.url;
          const markdownRegex = new RegExp(`!\\[[^\\]]*\\]\\(${imageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)\\n?`, 'g');
          setLocalMarkdown(prev => prev.replace(markdownRegex, ''));
        }
      }
    } catch (err) {
      console.error("Failed to delete image:", err);
    }
  };

  const markdownHelpPopover = (
    <Popover id="markdown-help-popover">
      <Popover.Header as="h3">Markdown Help</Popover.Header>
      <Popover.Body>
        <strong>Bold:</strong> `**text**`<br />
        <em>Italic:</em> `*text*`<br />
        <code>Code:</code> `` `code` ``<br />
        Lists: `- item` or `1. item`<br />
        Links: `[title](url)`<br />
        Images: `![alt](url)`<br />
        ....
        <hr />
        Tap the button to see full guide
      </Popover.Body>
    </Popover>
  );

  return (
    <Form onSubmit={handleSubmit}>
      <Stack gap={4}>
        <Row>
          <Col>
            <Form.Group controlId="title">
              <Form.Label>Title</Form.Label>
              <Form.Control ref={titleRef} required defaultValue={title} />
            </Form.Group>
          </Col>
          <Col>
            <Form.Group controlId="tags">
              <Form.Label>Tags</Form.Label>
              <CreatableReactSelect
                onCreateOption={label => {
                  const newTag = { id: uuidV4(), label }
                  onAddTag(newTag)
                  setSelectedTags(prev => [...prev, newTag])
                }}
                value={selectedTags.map(tag => {
                  return { label: tag.label, value: tag.id }
                })}
                options={availableTags
                  .filter(tag => {
                    const isSelected = selectedTags.some(selected => 
                      selected.id === tag.id || 
                      selected.id === tag._id || 
                      selected.label === tag.label
                    )
                    return !isSelected
                  })
                  .map(tag => {
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
                placeholder="Add or create tags..."
                styles={{
                  control: (baseStyles, state) => ({
                    ...baseStyles,
                    backgroundColor: 'var(--input-bg)',
                    borderRadius: '8px',
                    borderWidth: '1.5px',
                    boxShadow: state.isFocused ? '0 0 0 3px rgba(99, 102, 241, 0.15)' : 'none',
                    '&:hover': {
                      borderColor: '#6366f1',
                    },
                    borderColor: state.isFocused ? '#6366f1' : 'var(--input-border)',
                    transition: 'all 200ms ease',
                  }),
                  menu: (base) => ({
                    ...base,
                    backgroundColor: 'var(--card-bg)',
                    borderRadius: '12px',
                    border: '1px solid var(--card-border)',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)',
                    overflow: 'hidden',
                  }),
                  option: (base, state) => ({
                    ...base,
                    backgroundColor: state.isFocused ? 'var(--primary-light)' : 'transparent',
                    color: 'var(--bs-body-color)',
                    cursor: 'pointer',
                    transition: 'background-color 150ms ease',
                  }),
                  multiValue: (base) => ({
                    ...base,
                    background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
                    borderRadius: '20px',
                    padding: '2px',
                  }),
                  multiValueLabel: (base) => ({
                    ...base,
                    color: 'white',
                    fontWeight: '500',
                    padding: '2px 8px',
                  }),
                  multiValueRemove: (base) => ({
                    ...base,
                    color: 'white',
                    borderRadius: '0 20px 20px 0',
                    ':hover': {
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      color: 'white',
                    },
                  }),
                  placeholder: (base) => ({
                    ...base,
                    color: '#64748b',
                  }),
                  input: (base) => ({
                    ...base,
                    color: 'var(--bs-body-color)',
                  }),
                  singleValue: (base) => ({
                    ...base,
                    color: 'var(--bs-body-color)',
                  }),
                }}
              />
            </Form.Group>
          </Col>
        </Row>
        <Row>
          <Col md={6}>
            <Form.Group controlId="markdown">
              <Form.Label>Body</Form.Label>
              <div style={{ position: "relative" }}>
                {/* Markdown Help Button inside textarea container */}
                <OverlayTrigger
                  trigger={["hover","focus"]}
                  placement="top"
                  overlay={markdownHelpPopover}
                  rootClose
                >
                  <Button
                    variant="info"
                    size="sm"
                    style={{
                      position: "absolute",
                      bottom: "8px",
                      right: "14px",
                      opacity: 0.6,
                      zIndex: 10,
                    }}
                    title="Markdown Help"
                    as="a"
                    href="https://github.com/im-luka/markdown-cheatsheet/blob/main/complete-markdown-cheatsheet.pdf"
                    target="_blank"
                  >
                    ℹ️
                  </Button>
                </OverlayTrigger>

                {/* Textarea */}
                <Form.Control
                  as="textarea"
                  value={localMarkdown}
                  required
                  rows={15}
                  ref={markdownRef}
                  onChange={(e) => setLocalMarkdown(e.target.value)}
                  style={{
                    height: "50vh",
                    overflowY: "auto",
                    resize: "none",
                  }}
                  spellCheck="false"
                />
              </div>
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group>
              <Form.Label>Preview</Form.Label>
              <div
                style={{
                  border: "1px solid #ced4da",
                  borderRadius: ".25rem",
                  padding: "0.5rem",
                  overflowY: "auto",
                  height:"50vh"
                }}
              >
                <MarkdownViewer markdown={localMarkdown} />
              </div>
            </Form.Group>
          </Col>
        </Row>

        <Stack direction="horizontal" gap={2}>
          <input
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            ref={fileInputRef}
            onChange={handleFileChange}
          />

          <OverlayTrigger
            show={showImageHelp}
            placement="top"
            overlay={
              <Popover id="image-help-popover">
                <Popover.Body>
                  🖼️ Image added! To remove it, simply delete the image's markdown link from the note.
                </Popover.Body>
              </Popover>
            }
          >
            <Button
              type="button"
              variant="outline-secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              🖼️ Insert Image
            </Button>
          </OverlayTrigger>


          <Button type="submit" variant="primary" className="ms-auto">
            Save
          </Button>
          <Link to=".." className="">
            <Button type="button" variant="outline-secondary">
              Cancel
            </Button>
          </Link>
        </Stack>
      </Stack>
    </Form>
  )
}
