import { useState } from 'react'
import { addVideo } from '../api.js'

export default function AddVideoModal({ onClose, onAdded }) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!url.trim()) return
    setLoading(true)
    setError('')
    try {
      const result = await addVideo(url.trim())
      onAdded(result)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#111] border border-[#222] rounded-lg w-full max-w-md shadow-2xl">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-full bg-[#0070d1] flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-medium text-white">Add YouTube Video</h2>
              <p className="text-xs text-[#555] mt-0.5">Claude will split it into daily episodes</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full bg-[#181818] border border-[#2a2a2a] text-white placeholder-[#444] rounded text-sm px-4 py-3 focus:outline-none focus:border-[#0070d1] transition-colors"
              disabled={loading}
              autoFocus
            />

            {error && (
              <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded px-3 py-2">
                {error}
              </p>
            )}

            {loading && (
              <div className="flex items-center gap-3 text-xs text-[#0070d1] bg-[#0070d1]/10 border border-[#0070d1]/20 rounded px-3 py-3">
                <svg className="animate-spin h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Fetching transcript and generating episodes with Claude… 30–60 sec
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 rounded-full border border-[#2a2a2a] text-[#666] hover:text-white hover:border-[#444] text-sm font-medium py-2.5 transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !url.trim()}
                className="flex-1 rounded-full bg-[#0070d1] hover:bg-[#0064b7] active:bg-[#005aa3] text-white text-sm font-medium py-2.5 transition-colors disabled:opacity-40"
              >
                {loading ? 'Processing…' : 'Add Video'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
