import { useState, useRef, useEffect, useCallback } from 'react'

/**
 * CodeEditor — Custom editor with ghost-text autocomplete overlay.
 * 
 * Wraps a <textarea> with a transparent <pre> overlay that renders
 * "ghost text" (faded AI suggestions) after the cursor position.
 * 
 * Props:
 *   code          - Current code string
 *   onChange      - Called with new code string
 *   suggestion    - Ghost text to display (or null)
 *   onAcceptSuggestion - Called when user presses Tab to accept
 *   onCursorChange - Called with { line, col } when cursor moves
 */
export default function CodeEditor({ code, onChange, suggestion, onAcceptSuggestion, onCursorChange }) {
  const textareaRef = useRef(null)
  const overlayRef = useRef(null)
  const [cursorPos, setCursorPos] = useState(0)

  const lineCount = code.split('\n').length

  // Sync overlay scroll with textarea scroll
  useEffect(() => {
    const textarea = textareaRef.current
    const overlay = overlayRef.current
    if (!textarea || !overlay) return

    const syncScroll = () => {
      overlay.scrollTop = textarea.scrollTop
      overlay.scrollLeft = textarea.scrollLeft
    }

    textarea.addEventListener('scroll', syncScroll)
    return () => textarea.removeEventListener('scroll', syncScroll)
  }, [])

  // Track cursor position for autocomplete
  const handleSelect = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    const pos = textarea.selectionStart
    setCursorPos(pos)

    // Calculate line and column from position
    const textBefore = code.substring(0, pos)
    const lines = textBefore.split('\n')
    const line = lines.length
    const col = lines[lines.length - 1].length

    if (onCursorChange) {
      onCursorChange({ line, col })
    }
  }, [code, onCursorChange])

  // Handle keydown for Tab (accept suggestion) and Escape (dismiss)
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Tab' && suggestion) {
      e.preventDefault()
      if (onAcceptSuggestion) {
        onAcceptSuggestion()
      }
    }
    // Escape is handled by clearing suggestion in the parent
  }, [suggestion, onAcceptSuggestion])

  // Build the overlay content: code before cursor (invisible) + ghost text (visible)
  const renderOverlay = () => {
    if (!suggestion) return null

    const beforeCursor = code.substring(0, cursorPos)
    // The ghost text is rendered after the cursor text, made invisible except the suggestion
    return (
      <pre
        ref={overlayRef}
        className="ghost-overlay"
        aria-hidden="true"
      >
        <span className="ghost-invisible">{beforeCursor}</span>
        <span className="ghost-text">{suggestion}</span>
      </pre>
    )
  }

  return (
    <div className="code-editor-wrapper">
      <div className="line-numbers">
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>
      <div className="code-editor-area">
        <textarea
          ref={textareaRef}
          className="code-textarea"
          value={code}
          onChange={e => onChange(e.target.value)}
          onSelect={handleSelect}
          onClick={handleSelect}
          onKeyUp={handleSelect}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          placeholder="Write your MiniLang code here..."
        />
        {renderOverlay()}
      </div>
    </div>
  )
}
