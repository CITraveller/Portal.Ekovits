import { useEffect, useRef } from "react";
import { sanitizeRichText, toRichTextHtml } from "../utils/richText.js";

export function RichTextEditor({ value, onChange }) {
  const editorRef = useRef(null);
  const lastEmittedRef = useRef("");

  // Only synchronize external value changes into the editor.
  // Do NOT rewrite innerHTML while the user is typing.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    // If this value is exactly what we last emitted ourselves, the DOM
    // already reflects it -- do nothing. Re-deriving HTML here on every
    // render was double-escaping plain text (turning "&" into "&amp;",
    // which then rendered literally as "&nbsp;") and resetting the
    // cursor mid-keystroke, causing garbled/duplicated typing.
    if ((value || "") === lastEmittedRef.current) return;

    const next = toRichTextHtml(value || "");

    if (editor.innerHTML !== next) {
      editor.innerHTML = next;
    }

    lastEmittedRef.current = value || "";
  }, [value]);

  const emit = () => {
    const editor = editorRef.current;
    if (!editor) return;

    const html = sanitizeRichText(editor.innerHTML || "");

    lastEmittedRef.current = html;
    onChange(html);
  };

  const command = (name) => {
    const editor = editorRef.current;
    if (!editor) return;

    editor.focus();

    document.execCommand(name, false, null);

    emit();
  };

  const paste = (event) => {
    event.preventDefault();

    const text = event.clipboardData.getData("text/plain");

    if (!text) return;

    document.execCommand(
      "insertText",
      false,
      text.replace(/\u00a0/g, " ")
    );

    emit();
  };

  return (
    <div className="rich-editor">
      <div className="rich-toolbar" aria-label="Description formatting">
        <button
          type="button"
          title="Bold"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => command("bold")}
        >
          B
        </button>

        <button
          type="button"
          title="Italic"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => command("italic")}
        >
          <i>I</i>
        </button>

        <button
          type="button"
          title="Normal text"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => command("removeFormat")}
        >
          Normal
        </button>

        <button
          type="button"
          title="Bullet list"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => command("insertUnorderedList")}
        >
          Bullets
        </button>
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
    </div>
  );
}
