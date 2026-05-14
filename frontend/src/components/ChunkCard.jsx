import { useState } from 'react'
import { updateChunk } from '../api.js'

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatDuration(start, end) {
  const m = Math.round((end - start) / 60)
  return `${m} min`
}

export default function ChunkCard({ chunk, videoId, episodeNumber, isWatching, onWatch, onToggle }) {
  const [toggling, setToggling] = useState(false)

  async function handleToggle(e) {
    e.stopPropagation()
    setToggling(true)
    try {
      await updateChunk(videoId, chunk.id, !chunk.completed)
      onToggle(chunk.id, !chunk.completed)
    } finally {
      setToggling(false)
    }
  }

  return (
    <div
      className={`rounded-lg border transition-all ${
        isWatching
          ? 'border-[#0070d1]/50 bg-[#0070d1]/5'
          : chunk.completed
            ? 'border-[#1a1a1a] bg-[#181818]'
            : 'border-[#1e1e1e] bg-[#181818] hover:border-[#2a2a2a]'
      }`}
    >
      <div className="flex gap-4 p-4">
        {/* Episode number / done toggle */}
        <button
          onClick={handleToggle}
          disabled={toggling}
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors mt-0.5 ${
            chunk.completed
              ? 'bg-[#0070d1] text-white'
              : 'bg-[#222] text-[#555] hover:bg-[#0070d1]/20 hover:text-[#0070d1]'
          } ${toggling ? 'opacity-40 cursor-wait' : 'cursor-pointer'}`}
          title={chunk.completed ? 'Mark as in progress' : 'Mark as done'}
        >
          {chunk.completed ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            episodeNumber
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[10px] text-[#0070d1] font-medium uppercase tracking-wider">
                Episode {episodeNumber}
              </span>
              <h3 className={`text-sm font-medium leading-snug mt-0.5 ${
                chunk.completed ? 'text-[#666]' : 'text-white'
              }`}>
                {chunk.title}
              </h3>
            </div>
            <span className="flex-shrink-0 text-[10px] text-[#444] bg-[#222] rounded-full px-2 py-0.5 whitespace-nowrap">
              {formatDuration(chunk.start_time, chunk.end_time)}
            </span>
          </div>

          <p className="text-xs text-[#555] mt-1.5 leading-relaxed line-clamp-2">{chunk.summary}</p>

          <div className="flex items-center gap-4 mt-3">
            <span className="text-[10px] text-[#333] font-mono">
              {formatTime(chunk.start_time)} – {formatTime(chunk.end_time)}
            </span>
            <button
              onClick={onWatch}
              className={`flex items-center gap-1.5 rounded-full text-xs font-medium px-4 py-1.5 transition-colors ${
                isWatching
                  ? 'bg-[#0070d1] text-white'
                  : 'bg-[#222] text-[#888] hover:bg-[#0070d1] hover:text-white'
              }`}
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              {isWatching ? 'Now playing' : 'Watch'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
