import { useState, useEffect } from 'react'
import { getVideo, deleteVideo, updateChunk } from '../api.js'
import ChunkCard from './ChunkCard.jsx'
import VideoPlayer from './VideoPlayer.jsx'

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m} min`
}

export default function VideoDetail({ videoId, onBack, onDeleted }) {
  const [video, setVideo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [watchingChunk, setWatchingChunk] = useState(null)

  useEffect(() => {
    getVideo(videoId)
      .then(setVideo)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [videoId])

  function handleChunkToggle(chunkId, completed) {
    setVideo(v => {
      const chunks = v.chunks.map(c => c.id === chunkId ? { ...c, completed } : c)
      return {
        ...v,
        chunks,
        completed_chunks: chunks.filter(c => c.completed).length,
      }
    })
    // Keep player's chunk state in sync
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
    if (!confirm(`Remove "${video.title}" and all progress?`)) return
    setDeleting(true)
    try {
      await deleteVideo(videoId)
      onDeleted()
    } catch {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <svg className="animate-spin h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading…
      </div>
    )
  }

  if (error) return <p className="text-red-600 p-4">{error}</p>
  if (!video) return null

  const progress = video.total_chunks > 0
    ? Math.round(video.completed_chunks / video.total_chunks * 100)
    : 0

  const nextChunk = video.chunks.find(c => !c.completed)

  return (
    <>
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Back */}
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to all videos
        </button>

        {/* Header */}
        <div className="flex gap-4 mb-6">
          <img
            src={video.thumbnail}
            alt={video.title}
            className="w-32 h-20 object-cover rounded-lg flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-gray-900 text-lg leading-tight">{video.title}</h1>
            <p className="text-sm text-gray-400 mt-1">{formatDuration(video.total_duration)} total</p>

            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{video.completed_chunks} of {video.total_chunks} episodes done</span>
                <span className="font-semibold text-indigo-600">{progress}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Continue button */}
        {nextChunk && (
          <button
            onClick={() => setWatchingChunk(nextChunk)}
            className="w-full flex items-center gap-2 bg-indigo-600 text-white rounded-xl px-4 py-3 mb-6 hover:bg-indigo-700 transition-colors"
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            <div className="text-left">
              <p className="text-xs text-indigo-200">Continue where you left off</p>
              <p className="text-sm font-semibold">Episode {nextChunk.order + 1}: {nextChunk.title}</p>
            </div>
          </button>
        )}

        {progress === 100 && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 rounded-xl px-4 py-3 mb-6">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-semibold">You've completed this video!</p>
          </div>
        )}

        {/* Episodes list */}
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Episodes</h2>
        <div className="space-y-3">
          {video.chunks.map((chunk) => (
            <ChunkCard
              key={chunk.id}
              chunk={chunk}
              videoId={video.id}
              episodeNumber={chunk.order + 1}
              onToggle={handleChunkToggle}
              onWatch={() => setWatchingChunk(chunk)}
            />
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-gray-100 text-center">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-sm text-red-400 hover:text-red-600 disabled:opacity-50"
          >
            {deleting ? 'Removing…' : 'Remove this video'}
          </button>
        </div>
      </div>

      {/* Full-screen player modal */}
      {watchingChunk && (
        <VideoPlayer
          chunk={watchingChunk}
          youtubeId={video.youtube_id}
          episodeNumber={watchingChunk.order + 1}
          onClose={() => setWatchingChunk(null)}
          onMarkComplete={handleMarkComplete}
          onMarkIncomplete={handleMarkIncomplete}
        />
      )}
    </>
  )
}
