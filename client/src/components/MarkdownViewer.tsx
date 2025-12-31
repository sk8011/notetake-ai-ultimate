import React from "react"
import ReactMarkdown from "react-markdown"
import rehypeRaw from "rehype-raw"
import "../styles/index.css"
import remarkGfm from "remark-gfm"

type MarkdownViewerProps = {
  markdown?: string
} & React.RefAttributes<HTMLDivElement>;

const encodeSpacesInImageUrls = (markdown: string): string => {
  if (!markdown) return markdown;
  // Encode spaces in markdown image URLs ![alt](url)
  return markdown.replace(/(!\[.*?\]\()(.+?)(\))/g, (_match, p1, p2, p3) => {
    const encodedUrl = p2.replace(/ /g, "%20");
    return `${p1}${encodedUrl}${p3}`;
  });
};

const MarkdownViewer = React.forwardRef<HTMLDivElement, MarkdownViewerProps>(({ markdown }, ref) => { // Use forwardRef

  // Preprocess markdown to encode spaces in image URLs
  const processedMarkdown = markdown ? encodeSpacesInImageUrls(markdown) : markdown;

  // Custom component to render video as a link and encode spaces in image URLs
  const components = {
    video({ node, ...props }: any) {
      const src = props.src || "";
      return (
        <a href={src} target="_blank" rel="noopener noreferrer" style={{ color: "blue", textDecoration: "underline" }}>
          {src}
        </a>
      );
    },
    audio({ node, ...props }: any) {
      const src = props.src || "";
      return (
        <a href={src} target="_blank" rel="noopener noreferrer" style={{ color: "blue", textDecoration: "underline" }}>
          {src}
        </a>
      );
    },
    img({ node, ...props }: any) {
      let src = props.src || "";
      // Encode spaces in src URL
      src = src.replace(/ /g, "%20");
      return (
        <img
          {...props}
          src={src}
          style={{ maxWidth: "500px", maxHeight: "400px", objectFit: "contain", display: "inline-block" }}
          alt={props.alt || ""}
        />
      );
    }
  };

  return (
    <div 
    className="markdown-body"
    ref={ref}
    style={{
      whiteSpace: "normal",
      wordBreak: "break-word",
      overflowWrap: "break-word",
      width: "100%",
    }}
    > {/* Attach the ref to the div */}
      <ReactMarkdown 
        rehypePlugins={[rehypeRaw]} 
        remarkPlugins={[remarkGfm]} 
        components={components}
      >
        {processedMarkdown}
      </ReactMarkdown>
    </div>
  );
});

MarkdownViewer.displayName = "MarkdownViewer";

export default MarkdownViewer
