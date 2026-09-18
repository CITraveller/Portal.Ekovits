import { useEffect, useRef } from "react";
import { sanitizeRichText, toRichTextHtml } from "../utils/richText.js";

export function RichTextEditor({ value, onChange }) {
  const editorRef = useRef(null);

  useEffect(() => {
    const next = toRichTextHtml(value || "");
    if (editorRef.current && editorRef.current.innerHTML !== next) {
      editorRef.current.innerHTML = next;
    }
  }, [value]);

  const command = (name) => {
    editorRef.current?.focus();
    document.execCommand(name, false, null);
    emit();
  };

  const emit = () => {
    const html = sanitizeRichText(editorRef.current?.innerHTML || "");
    onChange(html);
  };

  const paste = (event) => {
    event.preventDefault();
    const html = event.clipboardData.getData("text/html");
    const text = event.clipboardData.getData("text/plain");
    document.execCommand("insertHTML", false, toRichTextHtml(html || text));
    emit();
  };

  return <div className="rich-editor">
    <div className="rich-toolbar" aria-label="Description formatting">
      <button type="button" title="Bold" onClick={() => command("bold")}>B</button>
      <button type="button" title="Italic" onClick={() => command("italic")}><i>I</i></button>
      <button type="button" title="Normal text" onClick={() => command("removeFormat")}>Normal</button>
      <button type="button" title="Bullet list" onClick={() => command("insertUnorderedList")}>Bullets</button>
    </div>
    <div
      className="rich-input"
      contentEditable
      ref={editorRef}
      role="textbox"
      aria-multiline="true"
      data-placeholder="Service / product description"
      onInput={emit}
      onBlur={emit}
      onPaste={paste}
      suppressContentEditableWarning
    />
  </div>;
}
