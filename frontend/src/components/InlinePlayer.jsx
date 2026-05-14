import { useEffect, useRef, useState } from 'react'

function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

export default function InlinePlayer({
  chunk,
  youtubeId,
  episodeNumber,
  onClose,
  onMarkComplete,
  onMarkIncomplete,
  onFullscreen,
}) {
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
    setElapsed(0)
    setEnded(false)

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

    return () => {
      clearInterval(pollRef.current)
      playerRef.current?.destroy?.()
    }
  }, [chunk.id, youtubeId]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="border-t border-edge bg-surface flex-shrink-0">
      <div className="flex">
        {/* ── Left: video iframe ── */}
        <div className="bg-black flex-shrink-0 relative" style={{ width: '480px', height: '270px' }}>
          <div ref={containerRef} className="w-full h-full" />
        </div>

        {/* ── Right: controls panel ── */}
        <div className="flex-1 flex flex-col justify-between px-5 py-4 min-w-0 gap-3">

          {/* Episode label + close */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] text-[#0070d1] font-medium uppercase tracking-widest">
                Episode {episodeNumber}
              </span>
              <p className="text-xs text-ink-2 mt-0.5 leading-snug line-clamp-2">{chunk.title}</p>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 w-6 h-6 rounded-full bg-chip hover:bg-elevated text-ink-3 hover:text-ink flex items-center justify-center transition-colors mt-0.5"
              title="Close player"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Episode progress bar */}
          <div>
            <div className="flex justify-between text-[10px] text-ink-4 mb-1.5 font-mono">
              <span>{formatTime(elapsed)}</span>
              <span>{formatTime(episodeDuration)}</span>
            </div>
            <div className="h-[3px] bg-chip rounded-full overflow-hidden">
              <div
                className="h-full bg-[#0070d1] rounded-full"
                style={{ width: `${progressPct}%`, transition: 'width 0.5s linear' }}
              />
            </div>
            <p className="text-[10px] text-ink-5 mt-1 text-right">{Math.round(progressPct)}% complete</p>
          </div>

          {/* ── Action buttons ── */}
          <div className="flex flex-col gap-2">

            {/* Primary: fullscreen */}
            <button
              onClick={onFullscreen}
              className="w-full flex items-center justify-center gap-2 rounded-full bg-[#0070d1] hover:bg-[#0064b7] active:bg-[#005aa3] text-white text-sm font-medium h-10 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              Watch in full screen
            </button>

            {/* Secondary: completion toggle */}
            {ended && !chunk.completed ? (
              <button
                onClick={onMarkComplete}
                className="w-full flex items-center justify-center gap-2 rounded-full bg-green-600 hover:bg-green-500 text-white text-sm font-medium h-10 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Episode done — Mark complete
              </button>
            ) : !chunk.completed ? (
              <button
                onClick={onMarkComplete}
                className="w-full flex items-center justify-center gap-2 rounded-full border border-edge-2 hover:border-elevated text-ink-3 hover:text-ink text-sm font-medium h-10 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Mark as done
              </button>
            ) : (
              <button
                onClick={onMarkIncomplete}
                className="w-full flex items-center justify-center gap-2 rounded-full border border-edge-2 hover:border-elevated text-ink-3 hover:text-ink text-sm font-medium h-10 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                Mark as in progress
              </button>
            )}
          </div>

          {/* Hint text */}
          <p className="text-[10px] text-ink-5 leading-relaxed hidden lg:block">
            Use "Watch in full screen" above to keep episode progress tracking active.
          </p>

        </div>
      </div>
    </div>
  )
}
