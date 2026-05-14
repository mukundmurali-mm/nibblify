import { useEffect, useRef, useState } from 'react'

function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

export default function VideoPlayer({ chunk, youtubeId, episodeNumber, onClose, onMarkComplete, onMarkIncomplete }) {
  const containerRef = useRef(null)
  const playerRef = useRef(null)
  const pollRef = useRef(null)
  const endedRef = useRef(false)
  const [elapsed, setElapsed] = useState(0)
  const [ended, setEnded] = useState(false)

  const episodeDuration = chunk.end_time - chunk.start_time
  const progressPct = Math.min(100, (elapsed / episodeDuration) * 100)

  useEffect(() => {
    endedRef.current = false

    function startPolling() {
      clearInterval(pollRef.current)
      pollRef.current = setInterval(() => {
        const p = playerRef.current
        if (!p?.getCurrentTime) return
        const t = p.getCurrentTime()
        if (typeof t !== 'number') return
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
        playerVars: { start: Math.floor(chunk.start_time), end: Math.ceil(chunk.end_time), autoplay: 1, rel: 0 },
        events: {
          onReady() { startPolling() },
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

    // Close on Escape
    function handleKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)

    return () => {
      clearInterval(pollRef.current)
      playerRef.current?.destroy?.()
      window.removeEventListener('keydown', handleKey)
    }
  }, [chunk.id, youtubeId]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-[#080808] border-b border-[#1a1a1a] flex-shrink-0">
        <div className="min-w-0 mr-4">
          <span className="text-[10px] text-[#0070d1] font-medium uppercase tracking-widest">Episode {episodeNumber}</span>
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
              Mark in progress
            </button>
          )}

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#1a1a1a] hover:bg-[#222] text-[#666] hover:text-white flex items-center justify-center transition-colors"
            title="Exit fullscreen (Esc)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* YouTube player */}
      <div className="flex-1 relative bg-black">
        <div ref={containerRef} className="absolute inset-0 w-full h-full" />
      </div>

      {/* Episode progress bar */}
      <div className="bg-[#080808] border-t border-[#1a1a1a] px-5 py-3 flex-shrink-0">
        <div className="flex justify-between text-[10px] text-[#333] mb-2 font-mono">
          <span>{formatTime(elapsed)}</span>
          <span className="text-[#222]">episode · {formatTime(episodeDuration)}</span>
          <span>{formatTime(episodeDuration)}</span>
        </div>
        <div className="h-[2px] bg-[#1a1a1a] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#0070d1] rounded-full"
            style={{ width: `${progressPct}%`, transition: 'width 0.5s linear' }}
          />
        </div>
      </div>

      {/* Ended prompt */}
      {ended && !chunk.completed && (
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
