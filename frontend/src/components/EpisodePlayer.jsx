import { useEffect, useRef, useState } from 'react'
import { listNotes, createNote, deleteNote, updateNote } from '../api.js'

function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

/**
 * Unified episode player. Keeps a single YouTube iframe mounted regardless of
 * fullscreen state — the outer wrapper only swaps CSS classes so React never
 * remounts the <div ref={containerRef}> slot the YT.Player has replaced.
 *
 * Fixes:
 *  - #1: interactive scrub bar (range input) that seeks within the episode.
 *  - #2: fullscreen toggle no longer restarts the video (single iframe instance).
 *  - #3: timestamped notes per chunk (add / list / jump / delete).
 */
export default function EpisodePlayer({
  chunk,
  videoId,
  youtubeId,
  episodeNumber,
  fullscreen,
  onClose,
  onToggleFullscreen,
  onMarkComplete,
  onMarkIncomplete,
}) {
  const containerRef = useRef(null)
  const playerRef = useRef(null)
  const pollRef = useRef(null)
  const endedRef = useRef(false)
  const [ready, setReady] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [ended, setEnded] = useState(false)
  const [scrubbing, setScrubbing] = useState(false)

  // Notes state
  const [notes, setNotes] = useState([])
  const [notesLoading, setNotesLoading] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [noteError, setNoteError] = useState('')

  const episodeDuration = chunk.end_time - chunk.start_time
  const progressPct = Math.min(100, (elapsed / episodeDuration) * 100)

  // Init / re-init the YouTube player when the chunk changes.
  useEffect(() => {
    endedRef.current = false
    setEnded(false)
    setElapsed(0)
    setReady(false)

    function startPolling() {
      clearInterval(pollRef.current)
      pollRef.current = setInterval(() => {
        const p = playerRef.current
        if (!p?.getCurrentTime) return
        const t = p.getCurrentTime()
        if (typeof t !== 'number') return
        if (scrubbing) return
        setElapsed(Math.max(0, t - chunk.start_time))
        if (!endedRef.current && t >= chunk.end_time - 0.5) {
          endedRef.current = true
          setElapsed(episodeDuration)
          setEnded(true)
          clearInterval(pollRef.current)
        }
      }, 500)
    }

    function initPlayer() {
      if (!containerRef.current) return
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId: youtubeId,
        playerVars: {
          start: Math.floor(chunk.start_time),
          end: Math.ceil(chunk.end_time),
          autoplay: 1,
          rel: 0,
        },
        events: {
          onReady() {
            setReady(true)
            startPolling()
          },
          onStateChange(e) {
            if (e.data === window.YT.PlayerState.ENDED) {
              endedRef.current = true
              setElapsed(episodeDuration)
              setEnded(true)
              clearInterval(pollRef.current)
            }
          },
        },
      })
    }

    if (window.YT?.Player) {
      initPlayer()
    } else {
      const prev = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => { prev?.(); initPlayer() }
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement('script')
        tag.src = 'https://www.youtube.com/iframe_api'
        document.head.appendChild(tag)
      }
    }

    return () => {
      clearInterval(pollRef.current)
      try { playerRef.current?.destroy?.() } catch { /* noop */ }
      playerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chunk.id, youtubeId])

  // Escape closes the player when in fullscreen.
  useEffect(() => {
    if (!fullscreen) return
    function handle(e) { if (e.key === 'Escape') onToggleFullscreen?.() }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [fullscreen, onToggleFullscreen])

  // Load notes when the chunk changes.
  useEffect(() => {
    let cancelled = false
    setNotesLoading(true)
    setNoteError('')
    listNotes(videoId, chunk.id)
      .then(rows => { if (!cancelled) setNotes(rows) })
      .catch(e => { if (!cancelled) setNoteError(e.message || 'Failed to load notes') })
      .finally(() => { if (!cancelled) setNotesLoading(false) })
    return () => { cancelled = true }
  }, [videoId, chunk.id])

  function seekToAbsolute(absSeconds) {
    const p = playerRef.current
    if (!p?.seekTo) return
    const clamped = Math.max(chunk.start_time, Math.min(chunk.end_time, absSeconds))
    p.seekTo(clamped, true)
    endedRef.current = false
    setEnded(false)
    setElapsed(Math.max(0, clamped - chunk.start_time))
  }

  function handleScrub(e) {
    const v = Number(e.target.value)
    setElapsed(v)
  }
  function handleScrubStart() { setScrubbing(true) }
  function handleScrubCommit(e) {
    const v = Number(e.target.value)
    setScrubbing(false)
    seekToAbsolute(chunk.start_time + v)
  }

  async function handleAddNote() {
    const content = noteDraft.trim()
    if (!content) return
    setSavingNote(true)
    setNoteError('')
    try {
      const p = playerRef.current
      const currentAbs = p?.getCurrentTime
        ? p.getCurrentTime()
        : chunk.start_time + elapsed
      const created = await createNote(videoId, chunk.id, currentAbs, content)
      setNotes(prev => [...prev, created].sort((a, b) => a.timestamp - b.timestamp))
      setNoteDraft('')
    } catch (e) {
      setNoteError(e.message || 'Failed to save note')
    } finally {
      setSavingNote(false)
    }
  }

  async function handleDeleteNote(noteId) {
    const prev = notes
    setNotes(notes.filter(n => n.id !== noteId))
    try {
      await deleteNote(noteId)
    } catch {
      setNotes(prev)
    }
  }

  async function handleEditNote(noteId, content) {
    const c = content.trim()
    if (!c) return
    try {
      const updated = await updateNote(noteId, { content: c })
      setNotes(prev => prev.map(n => n.id === noteId ? updated : n))
    } catch (e) {
      setNoteError(e.message || 'Failed to update note')
    }
  }

  // ── Layout classes swap based on fullscreen, but the JSX tree structure
  //    (and the container ref slot) stays identical so the iframe survives.
  const rootClass = fullscreen
    ? 'fixed inset-0 z-50 bg-black flex flex-col'
    : 'border-t border-edge bg-surface flex flex-col flex-shrink-0'

  const bodyClass = fullscreen
    ? 'flex-1 flex min-h-0'
    : 'flex min-h-0'

  const videoWrapClass = fullscreen
    ? 'flex-1 bg-black relative min-w-0'
    : 'bg-black flex-shrink-0 relative'

  const videoWrapStyle = fullscreen ? undefined : { width: '480px', height: '270px' }

  const sideClass = fullscreen
    ? 'w-[360px] border-l border-edge bg-surface flex flex-col min-h-0'
    : 'flex-1 flex flex-col min-w-0 min-h-0'

  const sideStyle = fullscreen ? undefined : { height: '270px' }

  return (
    <div className={rootClass}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-[#080808] border-b border-[#1a1a1a] flex-shrink-0">
        <div className="min-w-0 mr-4">
          <span className="text-[10px] text-[#0070d1] font-medium uppercase tracking-widest">
            Episode {episodeNumber}
          </span>
          <p className="text-sm font-light text-white truncate mt-0.5">{chunk.title}</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {!chunk.completed ? (
            <button
              onClick={onMarkComplete}
              className="flex items-center gap-1.5 rounded-full bg-[#0070d1] hover:bg-[#0064b7] text-white text-xs font-medium px-4 h-8 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              Mark done
            </button>
          ) : (
            <button
              onClick={onMarkIncomplete}
              className="flex items-center gap-1.5 rounded-full bg-[#1a1a1a] hover:bg-[#222] text-[#888] hover:text-white text-xs font-medium px-4 h-8 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              In progress
            </button>
          )}

          <button
            onClick={onToggleFullscreen}
            className="w-8 h-8 rounded-full bg-[#1a1a1a] hover:bg-[#222] text-[#888] hover:text-white flex items-center justify-center transition-colors"
            title={fullscreen ? 'Exit fullscreen (Esc)' : 'Enter fullscreen'}
          >
            {fullscreen ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V5H5m0 10v4h4m6-14h4v4m0 6v4h-4" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            )}
          </button>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#1a1a1a] hover:bg-[#222] text-[#666] hover:text-white flex items-center justify-center transition-colors"
            title="Close player"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body: video + side panel. JSX structure is identical in both modes. */}
      <div className={bodyClass}>
        <div className={videoWrapClass} style={videoWrapStyle}>
          <div ref={containerRef} className="absolute inset-0 w-full h-full" />
        </div>

        <div className={sideClass} style={sideStyle}>
          {/* Timeline (scrubbable) */}
          <div className="px-4 pt-3 pb-2 border-b border-[#1a1a1a] bg-[#080808] flex-shrink-0">
            <div className="flex justify-between text-[10px] text-[#666] mb-1.5 font-mono">
              <span>{formatTime(elapsed)}</span>
              <span className="text-[#333]">episode · {formatTime(episodeDuration)}</span>
              <span>{formatTime(episodeDuration)}</span>
            </div>
            <div className="relative h-4 flex items-center group">
              <div className="absolute inset-x-0 h-[3px] bg-[#1a1a1a] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#0070d1] rounded-full"
                  style={{ width: `${progressPct}%`, transition: scrubbing ? 'none' : 'width 0.2s linear' }}
                />
              </div>
              <input
                type="range"
                min={0}
                max={episodeDuration}
                step={0.1}
                value={elapsed}
                onChange={handleScrub}
                onMouseDown={handleScrubStart}
                onTouchStart={handleScrubStart}
                onMouseUp={handleScrubCommit}
                onTouchEnd={handleScrubCommit}
                onKeyUp={handleScrubCommit}
                disabled={!ready}
                aria-label="Seek within episode"
                className="episode-scrub absolute inset-0 w-full appearance-none bg-transparent cursor-pointer disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Notes panel */}
          <div className="flex-1 flex flex-col min-h-0 bg-[#0a0a0a]">
            <div className="px-4 pt-3 pb-2 flex items-center justify-between flex-shrink-0">
              <p className="text-[10px] text-[#0070d1] uppercase tracking-widest font-medium">Notes</p>
              <span className="text-[10px] text-[#444] font-mono">
                {notes.length} {notes.length === 1 ? 'note' : 'notes'}
              </span>
            </div>

            {/* Add note */}
            <div className="px-4 pb-3 flex-shrink-0">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={noteDraft}
                  onChange={e => setNoteDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddNote() }}
                  placeholder={`Add a note at ${formatTime(elapsed)}…`}
                  className="flex-1 min-w-0 bg-[#111] border border-[#1f1f1f] focus:border-[#0070d1] rounded-md px-3 py-1.5 text-xs text-white placeholder-[#555] outline-none transition-colors"
                />
                <button
                  onClick={handleAddNote}
                  disabled={savingNote || !noteDraft.trim()}
                  className="flex-shrink-0 rounded-md bg-[#0070d1] hover:bg-[#0064b7] disabled:bg-[#1a1a1a] disabled:text-[#555] text-white text-xs font-medium px-3 py-1.5 transition-colors"
                  title="Save note at current time"
                >
                  {savingNote ? '…' : 'Add'}
                </button>
              </div>
              {noteError && (
                <p className="text-[10px] text-red-400 mt-1.5">{noteError}</p>
              )}
            </div>

            {/* Notes list */}
            <div className="flex-1 overflow-y-auto px-2 pb-3 min-h-0">
              {notesLoading ? (
                <p className="text-[10px] text-[#555] px-2">Loading notes…</p>
              ) : notes.length === 0 ? (
                <p className="text-[10px] text-[#555] px-2 leading-relaxed">
                  Mark important moments — your notes will show here with a jump-to button.
                </p>
              ) : (
                <ul className="space-y-1">
                  {notes.map(n => (
                    <NoteRow
                      key={n.id}
                      note={n}
                      chunkStart={chunk.start_time}
                      onJump={() => seekToAbsolute(n.timestamp)}
                      onDelete={() => handleDeleteNote(n.id)}
                      onEdit={(content) => handleEditNote(n.id, content)}
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Ended prompt (fullscreen only, mirrors old behavior) */}
      {fullscreen && ended && !chunk.completed && (
        <div className="bg-[#080808] border-t border-[#1a1a1a] px-5 py-3 flex items-center justify-between flex-shrink-0">
          <p className="text-sm text-white font-light">Episode finished</p>
          <button
            onClick={onMarkComplete}
            className="rounded-full bg-[#0070d1] hover:bg-[#0064b7] text-white text-sm font-medium px-5 h-9 transition-colors"
          >
            Mark as done
          </button>
        </div>
      )}
    </div>
  )
}

function NoteRow({ note, chunkStart, onJump, onDelete, onEdit }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(note.content)

  const relative = Math.max(0, note.timestamp - chunkStart)

  function commit() {
    setEditing(false)
    if (draft.trim() && draft.trim() !== note.content) onEdit(draft)
    else setDraft(note.content)
  }

  return (
    <li className="group flex items-start gap-2 rounded-md hover:bg-[#111] px-2 py-1.5">
      <button
        onClick={onJump}
        className="flex-shrink-0 mt-0.5 text-[10px] text-[#0070d1] hover:text-[#4ea3e0] font-mono tabular-nums font-medium"
        title="Jump to this moment"
      >
        {formatTime(relative)}
      </button>
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') { setDraft(note.content); setEditing(false) }
          }}
          className="flex-1 min-w-0 bg-[#0a0a0a] border border-[#1f1f1f] focus:border-[#0070d1] rounded px-2 py-0.5 text-xs text-white outline-none"
        />
      ) : (
        <p
          onDoubleClick={() => setEditing(true)}
          className="flex-1 min-w-0 text-xs text-[#ccc] leading-snug break-words"
          title="Double-click to edit"
        >
          {note.content}
        </p>
      )}
      <button
        onClick={onDelete}
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-[#555] hover:text-red-400 transition-opacity"
        title="Delete note"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </li>
  )
}
