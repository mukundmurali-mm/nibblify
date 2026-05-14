import { useState } from 'react'
import Sidebar from './components/Sidebar.jsx'
import MainContent from './components/MainContent.jsx'

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 select-none">
      <div className="w-16 h-16 rounded-full bg-[#0070d1]/10 flex items-center justify-center">
        <svg className="w-7 h-7 text-[#0070d1]" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-white font-light text-xl tracking-tight">Welcome to Nibblify</p>
        <p className="text-[#555] text-sm mt-1">Pick a video from your library to start nibbling</p>
      </div>
    </div>
  )
}

export default function App() {
  const [selectedVideoId, setSelectedVideoId] = useState(null)

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden">
      <Sidebar
        selectedVideoId={selectedVideoId}
        onSelectVideo={setSelectedVideoId}
      />
      <main className="flex-1 overflow-hidden border-l border-[#1a1a1a]">
        {selectedVideoId
          ? <MainContent key={selectedVideoId} videoId={selectedVideoId} />
          : <EmptyState />
        }
      </main>
    </div>
  )
}
