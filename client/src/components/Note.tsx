import { Badge, Button, Col, Row, Stack } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { useNote } from "./NoteLayout";
import MarkdownViewer from "./MarkdownViewer";
import { useRef } from "react";
import html2pdf from "html2pdf.js";

type NoteProps = {
  onDelete: (id: string) => void;
};

export function Note({ onDelete }: NoteProps) {
  const note = useNote();
  const navigate = useNavigate();
  const markdownRef = useRef<HTMLDivElement>(null); // Ref to the MarkdownViewer

  const handleExport = async () => {
    if (!note.markdown) return;

    try {
      const ReactDOMServer = await import("react-dom/server");
      const React = await import("react");
      const MarkdownViewerModule = await import("./MarkdownViewer");

      // 1. Convert React markdown to static HTML string
      const htmlContent = ReactDOMServer.renderToStaticMarkup(
        React.createElement(MarkdownViewerModule.default, { markdown: note.markdown })
      );

      // 2. Create a visible offscreen container to allow proper rendering
      const container = document.createElement("div");
      container.innerHTML = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <style>
              body {
                font-family: Arial, sans-serif;
                margin: 1in;
                color: black;
              }
              .markdown-body {
                max-width: 100%;
                word-wrap: break-word;
                font-size: 14px;
                line-height: 1.6;
              }
              .markdown-body h1 {
                font-size: 2em;
                font-weight: bold;
                margin: 0.67em 0;
              }
              .markdown-body h2 {
                font-size: 1.5em;
                font-weight: bold;
                margin: 0.75em 0;
              }
              .markdown-body h3 {
                font-size: 1.17em;
                font-weight: bold;
                margin: 0.83em 0;
              }
              .markdown-body p {
                margin: 1em 0;
              }
              .markdown-body ul {
                list-style: none !important;
                list-style-type: none !important;
                padding-left: 0 !important;
                margin: 1em 0 !important;
              }
              .markdown-body ol {
                list-style: none !important;
                list-style-type: none !important;
                padding-left: 0 !important;
                margin: 1em 0 !important;
              }
              .markdown-body li {
                list-style: none !important;
                list-style-type: none !important;
                display: block !important;
                margin: 0.5em 0 !important;
              }
              .markdown-body ul li {
                list-style: none !important;
                list-style-type: none !important;
              }
              .markdown-body ol li {
                list-style: none !important;
                list-style-type: none !important;
              }
              .markdown-body li::marker {
                content: none !important;
                display: none !important;
              }
              .markdown-body code {
                background-color: #f4f4f4;
                padding: 2px 6px;
                border-radius: 3px;
                font-family: monospace;
                font-size: 0.9em;
              }
              .markdown-body pre {
                background-color: #f4f4f4;
                padding: 12px;
                border-radius: 6px;
                overflow-x: auto;
              }
              .markdown-body pre code {
                background: none;
                padding: 0;
              }
              .markdown-body blockquote {
                border-left: 4px solid #ddd;
                padding-left: 1em;
                margin-left: 0;
                color: #666;
              }
              a {
                color: blue;
                text-decoration: underline;
              }
              img, a {
                page-break-inside: avoid;
                break-inside: avoid;
                max-width: 100%;
                height: auto;
              }
            </style>
          </head>
          <body>
            <div class="markdown-body">${htmlContent}</div>
          </body>
        </html>
      `;

      // ⚠️ Append to DOM (must be visible enough to render)
      container.style.position = "absolute";
      container.style.left = "-9999px";
      document.body.appendChild(container);

      // 3. Fix list rendering for html2canvas - it doesn't render list-style properly
      // Convert list items to have explicit markers as text
      const markdownBody = container.querySelector(".markdown-body");
      if (markdownBody) {
        // Fix ordered lists - add number prefix
        const olLists = markdownBody.querySelectorAll("ol");
        olLists.forEach((ol) => {
          const olEl = ol as HTMLElement;
          olEl.style.cssText = "list-style: none !important; list-style-type: none !important; padding-left: 0 !important; margin: 1em 0 !important;";
          
          const items = ol.querySelectorAll(":scope > li");
          items.forEach((li, index) => {
            const liEl = li as HTMLElement;
            liEl.style.cssText = "list-style: none !important; list-style-type: none !important; display: block !important; margin-bottom: 0.5em !important; padding-left: 1.5em !important;";
            
            // Only add marker if not already added
            if (!liEl.dataset.markerAdded) {
              const marker = document.createElement("span");
              marker.textContent = `${index + 1}. `;
              marker.style.cssText = "font-weight: normal;";
              liEl.insertBefore(marker, liEl.firstChild);
              liEl.dataset.markerAdded = "true";
            }
          });
        });

        // Fix unordered lists - add bullet prefix
        const ulLists = markdownBody.querySelectorAll("ul");
        ulLists.forEach((ul) => {
          const ulEl = ul as HTMLElement;
          ulEl.style.cssText = "list-style: none !important; list-style-type: none !important; padding-left: 0 !important; margin: 1em 0 !important;";
          
          const items = ul.querySelectorAll(":scope > li");
          items.forEach((li) => {
            const liEl = li as HTMLElement;
            liEl.style.cssText = "list-style: none !important; list-style-type: none !important; display: block !important; margin-bottom: 0.5em !important; padding-left: 1.5em !important;";
            
            // Only add marker if not already added
            if (!liEl.dataset.markerAdded) {
              const marker = document.createElement("span");
              marker.textContent = "• ";
              liEl.insertBefore(marker, liEl.firstChild);
              liEl.dataset.markerAdded = "true";
            }
          });
        });
      }

      // 4. Generate the PDF from the actual inner content
      const elementToPrint = container.querySelector(".markdown-body");
      if (!elementToPrint) throw new Error("Rendered HTML not found");

      const opt = {
        margin:       0.5,
        filename:     `${note.title || "note"}.pdf`,
        image:        { type: "jpeg", quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: "in", format: "a4", orientation: "portrait" },
        pagebreak:    {
          mode: ["avoid-all","css","legacy"],
        },
      };

      await html2pdf().set(opt).from(elementToPrint).save();

      // 5. Cleanup
      document.body.removeChild(container);
    } catch (error) {
      console.error("Export PDF error:", error);
      alert("Failed to export PDF");
    }
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
              <i className="bi bi-file-pdf me-1"></i> Export
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
