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

export async function listNotes(videoId, chunkId) {
  const res = await fetch(`${BASE}/videos/${videoId}/chunks/${chunkId}/notes`)
  if (!res.ok) throw new Error('Failed to load notes')
  return res.json()
}

export async function createNote(videoId, chunkId, timestamp, content) {
  const res = await fetch(`${BASE}/videos/${videoId}/chunks/${chunkId}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ timestamp, content }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || 'Failed to create note')
  return data
}

export async function updateNote(noteId, patch) {
  const res = await fetch(`${BASE}/notes/${noteId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || 'Failed to update note')
  return data
}

export async function deleteNote(noteId) {
  const res = await fetch(`${BASE}/notes/${noteId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete note')
}

export async function getSettings() {
  const res = await fetch(`${BASE}/settings`)
  if (!res.ok) throw new Error('Failed to fetch settings')
  return res.json()
}

export async function saveSettings(patch) {
  const res = await fetch(`${BASE}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || 'Failed to save settings')
  return data
}

export async function getOllamaModels() {
  const res = await fetch(`${BASE}/settings/ollama-models`)
  if (!res.ok) throw new Error('Failed to fetch Ollama models')
  return res.json()
}
