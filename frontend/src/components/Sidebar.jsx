import { useState, useEffect } from 'react'
import { getVideos } from '../api.js'
import AddVideoModal from './AddVideoModal.jsx'
import { useTheme } from '../context/ThemeContext.jsx'

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function VideoCard({ video, isSelected, onClick }) {
  const done = video.progress === 100
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg transition-all group ${
        isSelected
          ? 'bg-[#0070d1]/15 ring-1 ring-[#0070d1]/40'
          : 'hover:bg-card'
      }`}
    >
      <div className="flex gap-3 items-start">
        <div className="relative flex-shrink-0">
          <img
            src={video.thumbnail}
            alt={video.title}
            className="w-[72px] h-[40px] object-cover rounded"
          />
          {done && (
            <div className="absolute inset-0 bg-black/60 rounded flex items-center justify-center">
              <svg className="w-4 h-4 text-[#0070d1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-ink leading-snug line-clamp-2">{video.title}</p>
          <p className="text-[10px] text-ink-3 mt-0.5">{formatDuration(video.total_duration)} · {video.total_chunks} eps</p>

          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 h-[2px] bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all bg-[#0070d1]"
                style={{ width: `${video.progress}%` }}
              />
            </div>
            <span className={`text-[10px] font-medium tabular-nums ${done ? 'text-[#0070d1]' : 'text-ink-4'}`}>
              {video.progress}%
            </span>
          </div>
        </div>
      </div>
    </button>
  )
}

function SunIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="4" strokeWidth={2} />
      <path strokeLinecap="round" strokeWidth={2} d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41" />
    </svg>
  )
}

function MonitorIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="2" y="3" width="20" height="14" rx="2" strokeWidth={2} />
      <path strokeLinecap="round" strokeWidth={2} d="M8 21h8M12 17v4" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  )
}

const THEME_OPTIONS = [
  { id: 'light', label: 'Light', Icon: SunIcon },
  { id: 'system', label: 'Auto', Icon: MonitorIcon },
  { id: 'dark', label: 'Dark', Icon: MoonIcon },
]

export default function Sidebar({ selectedVideoId, onSelectVideo }) {
  const [videos, setVideos] = useState([])
  const [showModal, setShowModal] = useState(false)
  const { theme, setTheme } = useTheme()

  function loadVideos() {
    getVideos().then(setVideos)
  }

  useEffect(() => { loadVideos() }, [])

  function handleAdded(result) {
    setShowModal(false)
    loadVideos()
    onSelectVideo(result.id)
  }

  return (
    <>
      <aside className="w-[280px] flex-shrink-0 flex flex-col bg-surface h-screen">
        {/* Header */}
        <div className="px-4 pt-5 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#0070d1] flex items-center justify-center flex-shrink-0">
                <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <span className="text-sm font-semibold tracking-tight text-ink">Nibblify</span>
            </div>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="w-full flex items-center justify-center gap-2 bg-[#0070d1] hover:bg-[#0064b7] active:bg-[#005aa3] text-white text-sm font-medium rounded-full h-10 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Add Video
          </button>
        </div>

        <div className="h-px bg-edge mx-4" />

        {/* Video list */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          {videos.length === 0 && (
            <p className="text-ink-4 text-xs text-center py-8 px-4">
              No videos yet. Add your first YouTube video above.
            </p>
          )}
          {videos.map(v => (
            <VideoCard
              key={v.id}
              video={v}
              isSelected={v.id === selectedVideoId}
              onClick={() => onSelectVideo(v.id)}
            />
          ))}
        </div>

        {/* Theme toggle */}
        <div className="px-3 py-3 border-t border-edge flex-shrink-0">
          <div className="flex items-center bg-chip rounded-full p-0.5">
            {THEME_OPTIONS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setTheme(id)}
                title={`${label} theme`}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-full text-[10px] font-medium transition-colors ${
                  theme === id
                    ? 'bg-card text-ink shadow-sm'
                    : 'text-ink-3 hover:text-ink-2'
                }`}
              >
                <Icon />
                {label}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {showModal && (
        <AddVideoModal
          onClose={() => setShowModal(false)}
          onAdded={handleAdded}
        />
      )}
    </>
  )
}
