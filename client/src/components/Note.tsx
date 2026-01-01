import { Badge, Button, Col, Row, Stack } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { useNote } from "./NoteLayout";
import MarkdownViewer from "./MarkdownViewer";
import { useRef } from "react";

type NoteProps = {
  onDelete: (id: string) => void;
};

export function Note({ onDelete }: NoteProps) {
  const note = useNote();
  const navigate = useNavigate();
  const markdownRef = useRef<HTMLDivElement>(null);

  const handleExport = () => {
    if (!note.markdown) return;

    // Create a Blob with the markdown content
    const blob = new Blob([note.markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);

    // Create a download link and trigger it
    const link = document.createElement("a");
    link.href = url;
    link.download = `${note.title || "note"}.md`;
    document.body.appendChild(link);
    link.click();

    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };



  return (
    <>
      <Row className="align-items-center mb-4">
        <Col>
          <h1>{note.title}</h1>
          {note.isShared && (
            <Badge bg="info" className="me-2">
              <i className="bi bi-eye me-1"></i> View Only
            </Badge>
          )}
          {note.isShared && note.sharedBy && (
            <small className="text-muted">
              Shared by {note.sharedBy.name}
            </small>
          )}
          {note.tags.length > 0 && (
            <Stack gap={1} direction="horizontal" className="flex-wrap mt-2">
              {note.tags.map((tag, index) => (
                  <Badge className="text-truncate" key={index}>
                  {tag}
                  </Badge>
              ))}
            </Stack>
          )}
        </Col>
        <Col xs="auto">
          <Stack gap={2} direction="horizontal">
            {!note.isShared && (
              <>
                <Link to={`/${note.id}/edit`}>
                  <Button variant="primary">
                    <i className="bi bi-pencil me-1"></i> Edit
                  </Button>
                </Link>
                <Button
                  onClick={() => {
                    if (note.id) {
                      onDelete(note.id);
                      navigate("/");
                    }
                  }}
                  variant="outline-danger"
                >
                  <i className="bi bi-trash me-1"></i> Delete
                </Button>
              </>
            )}
            <Link to="/">
              <Button variant="outline-secondary">
                <i className="bi bi-arrow-left me-1"></i> Back
              </Button>
            </Link>
            <Button variant="outline-secondary" onClick={handleExport}>
              <i className="bi bi-markdown me-1"></i> Export
            </Button>
          </Stack>
        </Col>
      </Row>
      <div className="note-content-box" style={{ height: "70vh", overflowY: "auto" }}>
        <MarkdownViewer markdown={note.markdown} ref={markdownRef} />
      </div>
    </>
  );
}
