import { useEffect, useState } from 'react'
import { getSettings, saveSettings, getOllamaModels } from '../api.js'

export default function SettingsModal({ onClose, onSaved }) {
  const [settings, setSettings] = useState(null)
  const [provider, setProvider] = useState('deepseek')

  // DeepSeek fields
  const [deepseekKey, setDeepseekKey] = useState('')

  // Ollama fields
  const [ollamaUrl, setOllamaUrl] = useState('')
  const [ollamaModel, setOllamaModel] = useState('')
  const [ollamaProbe, setOllamaProbe] = useState(null) // { available, models, error }
  const [probingOllama, setProbingOllama] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getSettings().then(s => {
      setSettings(s)
      setProvider(s.provider)
      setOllamaUrl(s.ollama?.base_url || '')
      setOllamaModel(s.ollama?.model || '')
    }).catch(() => {})
  }, [])

  async function refreshOllama() {
    setProbingOllama(true)
    try {
      const p = await getOllamaModels()
      setOllamaProbe(p)
      if (p.available && !ollamaModel && p.models?.length) {
        setOllamaModel(p.models[0])
      }
    } catch (e) {
      setOllamaProbe({ available: false, models: [], error: e.message })
    } finally {
      setProbingOllama(false)
    }
  }

  useEffect(() => {
    if (provider === 'ollama') refreshOllama()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const patch = { provider }
      if (provider === 'deepseek' && deepseekKey.trim()) {
        patch.deepseek_api_key = deepseekKey.trim()
      }
      if (provider === 'ollama') {
        if (ollamaUrl.trim()) patch.ollama_base_url = ollamaUrl.trim()
        if (ollamaModel.trim()) patch.ollama_model = ollamaModel.trim()
      }
      const result = await saveSettings(patch)
      setSettings(result)
      setSaved(true)
      setDeepseekKey('')
      if (onSaved) onSaved(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const deepseekSource = settings?.deepseek?.api_key_source
  const deepseekStatus = deepseekSource === 'env'
    ? 'from environment variable'
    : deepseekSource === 'config'
      ? 'saved in this app'
      : 'not set'

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-edge rounded-lg w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-full bg-[#0070d1] flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317a1 1 0 011.35 0l.72.66a1 1 0 00.9.24l.95-.2a1 1 0 011.19.66l.32.9a1 1 0 00.66.66l.9.32a1 1 0 01.66 1.19l-.2.95a1 1 0 00.24.9l.66.72a1 1 0 010 1.35l-.66.72a1 1 0 00-.24.9l.2.95a1 1 0 01-.66 1.19l-.9.32a1 1 0 00-.66.66l-.32.9a1 1 0 01-1.19.66l-.95-.2a1 1 0 00-.9.24l-.72.66a1 1 0 01-1.35 0l-.72-.66a1 1 0 00-.9-.24l-.95.2a1 1 0 01-1.19-.66l-.32-.9a1 1 0 00-.66-.66l-.9-.32a1 1 0 01-.66-1.19l.2-.95a1 1 0 00-.24-.9l-.66-.72a1 1 0 010-1.35l.66-.72a1 1 0 00.24-.9l-.2-.95a1 1 0 01.66-1.19l.9-.32a1 1 0 00.66-.66l.32-.9a1 1 0 011.19-.66l.95.2a1 1 0 00.9-.24l.72-.66z" />
                <circle cx="12" cy="12" r="3" strokeWidth={2} />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-medium text-ink">Settings</h2>
              <p className="text-xs text-ink-3 mt-0.5">Choose the LLM that generates episodes</p>
            </div>
          </div>

          {/* Provider toggle */}
          <div className="mb-5">
            <label className="block text-xs text-ink-3 mb-1.5">Provider</label>
            <div className="flex items-center bg-chip rounded-full p-0.5">
              {[
                { id: 'deepseek', label: 'DeepSeek (cloud)' },
                { id: 'ollama', label: 'Ollama (local)' },
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setProvider(opt.id)}
                  className={`flex-1 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    provider === opt.id
                      ? 'bg-card text-ink shadow-sm'
                      : 'text-ink-3 hover:text-ink-2'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {provider === 'deepseek' && (
              <div className="space-y-3">
                <div className="text-xs text-ink-3">
                  Current key: <span className="text-ink-2">{deepseekStatus}</span>
                </div>
                <div>
                  <label className="block text-xs text-ink-3 mb-1.5">
                    DeepSeek API key {deepseekSource ? <span className="text-ink-4">(leave blank to keep existing)</span> : null}
                  </label>
                  <input
                    type="password"
                    value={deepseekKey}
                    onChange={e => setDeepseekKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full bg-muted border border-edge-2 text-ink placeholder-ink-4 rounded text-sm px-4 py-3 focus:outline-none focus:border-[#0070d1] transition-colors font-mono"
                    disabled={saving}
                    autoFocus
                  />
                  <p className="text-[11px] text-ink-4 mt-1.5">
                    Get one at{' '}
                    <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noreferrer" className="text-[#0070d1] hover:underline">
                      platform.deepseek.com/api_keys
                    </a>. Stored locally at <code className="font-mono">~/Library/Application Support/Nibblify/config.json</code>.
                  </p>
                </div>
              </div>
            )}

            {provider === 'ollama' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-ink-3 mb-1.5">Ollama base URL</label>
                  <input
                    type="text"
                    value={ollamaUrl}
                    onChange={e => setOllamaUrl(e.target.value)}
                    placeholder="http://localhost:11434"
                    className="w-full bg-muted border border-edge-2 text-ink placeholder-ink-4 rounded text-sm px-4 py-3 focus:outline-none focus:border-[#0070d1] transition-colors font-mono"
                    disabled={saving}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs text-ink-3">Model</label>
                    <button
                      type="button"
                      onClick={refreshOllama}
                      disabled={probingOllama}
                      className="text-[11px] text-[#0070d1] hover:underline disabled:opacity-50"
                    >
                      {probingOllama ? 'Checking…' : 'Refresh from Ollama'}
                    </button>
                  </div>
                  {ollamaProbe?.available && ollamaProbe.models?.length > 0 ? (
                    <select
                      value={ollamaModel}
                      onChange={e => setOllamaModel(e.target.value)}
                      className="w-full bg-muted border border-edge-2 text-ink rounded text-sm px-4 py-3 focus:outline-none focus:border-[#0070d1] transition-colors font-mono"
                      disabled={saving}
                    >
                      {!ollamaProbe.models.includes(ollamaModel) && ollamaModel && (
                        <option value={ollamaModel}>{ollamaModel} (not installed)</option>
                      )}
                      {ollamaProbe.models.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={ollamaModel}
                      onChange={e => setOllamaModel(e.target.value)}
                      placeholder="llama3.1"
                      className="w-full bg-muted border border-edge-2 text-ink placeholder-ink-4 rounded text-sm px-4 py-3 focus:outline-none focus:border-[#0070d1] transition-colors font-mono"
                      disabled={saving}
                    />
                  )}

                  <div className="text-[11px] mt-1.5 space-y-0.5">
                    {ollamaProbe?.available && (
                      <p className="text-green-400">
                        ✓ Ollama reachable · {ollamaProbe.models.length} model{ollamaProbe.models.length === 1 ? '' : 's'} installed
                      </p>
                    )}
                    {ollamaProbe && !ollamaProbe.available && (
                      <p className="text-red-400">
                        Can’t reach Ollama: {ollamaProbe.error || 'unknown'}. Install from{' '}
                        <a href="https://ollama.com" target="_blank" rel="noreferrer" className="underline">ollama.com</a>{' '}
                        and run <code className="font-mono">ollama serve</code>.
                      </p>
                    )}
                    <p className="text-ink-4">
                      Missing a model? Run <code className="font-mono">ollama pull {ollamaModel || 'llama3.1'}</code> in Terminal.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded px-3 py-2 whitespace-pre-line">
                {error}
              </p>
            )}

            {saved && (
              <p className="text-xs text-green-400 bg-green-400/10 border border-green-400/20 rounded px-3 py-2">
                Saved. Provider: <b>{settings?.provider}</b> · Model: <b>{settings?.model}</b>
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="flex-1 rounded-full border border-edge-2 text-ink-3 hover:text-ink hover:border-elevated text-sm font-medium py-2.5 transition-colors disabled:opacity-40"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-full bg-[#0070d1] hover:bg-[#0064b7] active:bg-[#005aa3] text-white text-sm font-medium py-2.5 transition-colors disabled:opacity-40"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
