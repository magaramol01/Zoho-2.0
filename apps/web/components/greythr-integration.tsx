"use client"

import { useState, useEffect } from "react"
import { Settings, LogIn } from "lucide-react"

export default function GreythrIntegration({ 
  realtime,
}: { 
  realtime: { totalHours: string, currentStatus: string } | null
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("http://localhost:3001/api/greythr/credentials")
      .then(res => res.json())
      .then(data => {
        if (data.username) setUsername(data.username)
        if (data.password) setPassword(data.password)
      })
      .catch(err => console.error("Could not fetch greythr creds", err))
  }, [])

  const handleSaveCreds = async () => {
    setSaving(true)
    try {
      await fetch("http://localhost:3001/api/greythr/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      })
      setIsOpen(false)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="relative flex items-center gap-3">
      {realtime && (
        <div className="flex flex-col items-end mr-2">
           <div className="text-[10px] font-bold text-gray-500 uppercase leading-tight">GreytHR Today</div>
           <div className="flex items-center gap-1.5">
             <div className={`h-1.5 w-1.5 rounded-full ${realtime.currentStatus === 'IN' ? 'bg-green-500' : 'bg-red-500'}`}></div>
             <div className="text-sm font-bold text-gray-900 leading-none">{realtime.totalHours}</div>
           </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-8 w-8 items-center justify-center rounded hover:bg-gray-100 text-gray-600 transition"
        title="GreytHR Settings"
      >
        <Settings className="h-4 w-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-10 w-72 p-4 bg-white border border-gray-200 rounded-lg shadow-xl z-50">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-gray-800">
            <LogIn className="h-4 w-4" /> GreytHR Credentials
          </h3>
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
              />
            </div>
            <button
              onClick={handleSaveCreds}
              disabled={saving}
              className="mt-1 w-full rounded bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Credentials"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
