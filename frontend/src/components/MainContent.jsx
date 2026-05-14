import { useState, useEffect } from 'react'
import { getVideo, deleteVideo, updateChunk } from '../api.js'
import ChunkCard from './ChunkCard.jsx'
import InlinePlayer from './InlinePlayer.jsx'
import VideoPlayer from './VideoPlayer.jsx'

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function MainContent({ videoId }) {
  const [video, setVideo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [watchingChunk, setWatchingChunk] = useState(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    getVideo(videoId).then(setVideo).finally(() => setLoading(false))
  }, [videoId])

  function handleChunkToggle(chunkId, completed) {
    setVideo(v => {
      const chunks = v.chunks.map(c => c.id === chunkId ? { ...c, completed } : c)
      return { ...v, chunks, completed_chunks: chunks.filter(c => c.completed).length }
    })
    setWatchingChunk(prev => prev?.id === chunkId ? { ...prev, completed } : prev)
  }

  async function handleMarkComplete() {
    if (!watchingChunk || watchingChunk.completed) return
    await updateChunk(videoId, watchingChunk.id, true)
    handleChunkToggle(watchingChunk.id, true)
  }

  async function handleMarkIncomplete() {
    if (!watchingChunk || !watchingChunk.completed) return
    await updateChunk(videoId, watchingChunk.id, false)
    handleChunkToggle(watchingChunk.id, false)
  }

  async function handleDelete() {
    if (!confirm(`Remove "${video.title}"?`)) return
    setDeleting(true)
    try { await deleteVideo(videoId) } catch { setDeleting(false) }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full gap-3 bg-canvas text-ink-5">
        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  if (!video) return null

  const progress = video.total_chunks > 0
    ? Math.round(video.completed_chunks / video.total_chunks * 100)
    : 0
  const nextChunk = video.chunks.find(c => !c.completed)

  return (
    <div className="flex flex-col h-full bg-canvas">
      {/* Scrollable episode area */}
      <div className="flex-1 overflow-y-auto">
        {/* Sticky video header */}
        <div className="sticky top-0 z-10 bg-canvas backdrop-blur-sm border-b border-edge px-6 py-3">
          <div className="flex items-center gap-4">
            <img
              src={video.thumbnail}
              alt={video.title}
              className="w-[80px] h-[45px] object-cover rounded flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-light text-ink truncate tracking-tight">{video.title}</h1>
              <div className="flex items-center gap-3 mt-1.5">
                <div className="flex-1 h-[2px] bg-chip rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#0070d1] rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-[10px] text-[#0070d1] font-medium whitespace-nowrap tabular-nums">
                  {video.completed_chunks}/{video.total_chunks} done
                </span>
                <span className="text-[10px] text-ink-5">·</span>
                <span className="text-[10px] text-ink-5">{formatDuration(video.total_duration)}</span>
              </div>
            </div>

            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-shrink-0 w-7 h-7 rounded-full hover:bg-chip text-ink-5 hover:text-ink-2 flex items-center justify-center transition-colors"
              title="Remove video"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Continue CTA */}
        {nextChunk && !watchingChunk && (
          <div className="px-6 pt-5 pb-2">
            <button
              onClick={() => setWatchingChunk(nextChunk)}
              className="w-full flex items-center gap-3 bg-[#0070d1] hover:bg-[#0064b7] active:bg-[#005aa3] text-white rounded-full px-5 py-3 transition-colors group"
            >
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-[10px] text-blue-200 uppercase tracking-widest">Continue</p>
                <p className="text-sm font-medium">Ep {nextChunk.order + 1}: {nextChunk.title}</p>
              </div>
            </button>
          </div>
        )}

        {progress === 100 && (
          <div className="mx-6 mt-5 mb-2 flex items-center gap-3 bg-card border border-edge-2 rounded-lg px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-[#0070d1] flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-ink">Completed</p>
              <p className="text-xs text-ink-3">You've finished all episodes</p>
            </div>
          </div>
        )}

        {/* Episode list */}
        <div className="px-6 py-4 space-y-2">
          <p className="text-[10px] text-ink-5 uppercase tracking-widest font-medium mb-3">
            {video.total_chunks} Episodes
          </p>
          {video.chunks.map(chunk => (
            <ChunkCard
              key={chunk.id}
              chunk={chunk}
              videoId={video.id}
              episodeNumber={chunk.order + 1}
              isWatching={watchingChunk?.id === chunk.id}
              onWatch={() => setWatchingChunk(chunk)}
              onToggle={handleChunkToggle}
            />
          ))}
        </div>
      </div>

      {/* Inline player — only shown when not in fullscreen */}
      {watchingChunk && !fullscreen && (
        <InlinePlayer
          chunk={watchingChunk}
          youtubeId={video.youtube_id}
          episodeNumber={watchingChunk.order + 1}
          onClose={() => setWatchingChunk(null)}
          onMarkComplete={handleMarkComplete}
          onMarkIncomplete={handleMarkIncomplete}
          onFullscreen={() => setFullscreen(true)}
        />
      )}

      {/* Fullscreen overlay */}
      {fullscreen && watchingChunk && (
        <VideoPlayer
          chunk={watchingChunk}
          youtubeId={video.youtube_id}
          episodeNumber={watchingChunk.order + 1}
          onClose={() => setFullscreen(false)}
          onMarkComplete={handleMarkComplete}
          onMarkIncomplete={handleMarkIncomplete}
        />
      )}
    </div>
  )
}
