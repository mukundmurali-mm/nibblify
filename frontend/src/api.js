const BASE = '/api'

export async function getVideos() {
  const res = await fetch(`${BASE}/videos`)
  if (!res.ok) throw new Error('Failed to fetch videos')
  return res.json()
}

export async function addVideo(url) {
  const res = await fetch(`${BASE}/videos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Failed to add video')
  return data
}

export async function getVideo(id) {
  const res = await fetch(`${BASE}/videos/${id}`)
  if (!res.ok) throw new Error('Failed to fetch video')
  return res.json()
}

export async function updateChunk(videoId, chunkId, completed) {
  const res = await fetch(`${BASE}/videos/${videoId}/chunks/${chunkId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completed }),
  })
  if (!res.ok) throw new Error('Failed to update episode')
  return res.json()
}

export async function deleteVideo(videoId) {
  const res = await fetch(`${BASE}/videos/${videoId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete video')
}
