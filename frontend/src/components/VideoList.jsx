import { useState, useEffect } from 'react'
import { getVideos } from '../api.js'
import AddVideoModal from './AddVideoModal.jsx'

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m} min`
}

export default function VideoList({ onSelectVideo }) {
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    getVideos()
      .then(setVideos)
      .finally(() => setLoading(false))
  }, [])

  function handleAdded(result) {
    setShowModal(false)
    // Refresh list and navigate to the new video
    getVideos().then(setVideos)
    onSelectVideo(result.id)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Video Learner</h1>
          <p className="text-sm text-gray-400 mt-0.5">Watch long videos in daily episodes</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Video
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-40 text-gray-400">
          <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading…
        </div>
      )}

      {!loading && videos.length === 0 && (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">🎬</div>
          <h2 className="text-lg font-semibold text-gray-700 mb-2">No videos yet</h2>
          <p className="text-sm text-gray-400 mb-6">
            Add a long YouTube video and Claude will break it into daily episodes.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="bg-indigo-600 text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-indigo-700"
          >
            Add your first video
          </button>
        </div>
      )}

      <div className="space-y-4">
        {videos.map(video => {
          const isComplete = video.progress === 100
          return (
            <button
              key={video.id}
              onClick={() => onSelectVideo(video.id)}
              className="w-full text-left bg-white rounded-2xl border border-gray-200 p-4 hover:border-indigo-300 hover:shadow-sm transition-all"
            >
              <div className="flex gap-4">
                <div className="relative flex-shrink-0">
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-28 h-18 object-cover rounded-lg"
                    style={{ height: '4.5rem' }}
                  />
                  {isComplete && (
                    <div className="absolute inset-0 bg-green-500/80 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">
                    {video.title}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDuration(video.total_duration)} · {video.total_chunks} episodes
                  </p>

                  <div className="mt-2.5">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400">
                        {video.completed_chunks}/{video.total_chunks} done
                      </span>
                      <span className={`font-semibold ${isComplete ? 'text-green-600' : 'text-indigo-600'}`}>
                        {video.progress}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isComplete ? 'bg-green-500' : 'bg-indigo-500'}`}
                        style={{ width: `${video.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {showModal && (
        <AddVideoModal
          onClose={() => setShowModal(false)}
          onAdded={handleAdded}
        />
      )}
    </div>
  )
}
