"use client"

import { useState, useEffect } from "react"
import { Settings, LogIn, CheckCircle } from "lucide-react"
import { toast } from "sonner"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:6002"

export default function GreythrIntegration({
  realtime,
}: {
  realtime: { totalHours: string; currentStatus: string } | null
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [hasCredentials, setHasCredentials] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`${API_BASE}/api/greythr/credentials`)
      .then((res) => res.json())
      .then((data: { hasCredentials?: boolean; username?: string }) => {
        // API now only returns { hasCredentials, username } — never the password
        if (data.username) setUsername(data.username)
        if (data.hasCredentials) setHasCredentials(true)
      })
      .catch((err) => console.error("Could not fetch greythr creds", err))
  }, [])

  const handleSaveCreds = async () => {
    if (!username.trim() || !password.trim()) {
      toast.error("Enter both username and password")
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/api/greythr/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      })
      if (!res.ok) throw new Error("Failed to save credentials")
      setHasCredentials(true)
      setPassword("") // clear password from UI memory after save
      setIsOpen(false)
      toast.success("GreytHR credentials saved")
    } catch (err) {
      toast.error("Could not save credentials")
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="relative flex items-center gap-3">
      {realtime && (
        <div className="flex flex-col items-end mr-1">
          <div className="text-[9px] font-bold text-gray-400 uppercase leading-tight tracking-wider">
            GreytHR Today
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div
              className={`h-2 w-2 rounded-full ${realtime.currentStatus === "IN" ? "bg-emerald-500 shadow-sm shadow-emerald-300" : "bg-red-400"}`}
            />
            <div className="text-sm font-bold text-gray-800 leading-none tabular-nums">
              {realtime.totalHours}
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
        title="GreytHR Settings"
        type="button"
      >
        <Settings className="h-4 w-4" />
        {hasCredentials && (
          <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-emerald-500">
            <CheckCircle className="h-2 w-2 text-white" />
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-10 w-72 rounded-xl bg-white border border-gray-200 shadow-xl z-50 overflow-hidden animate-slide-up">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
            <LogIn className="h-4 w-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-800">GreytHR Credentials</h3>
          </div>
          <div className="flex flex-col gap-3 p-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Username / Email</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your.email@company.com"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Password {hasCredentials && <span className="text-emerald-600 font-normal">(already saved)</span>}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={hasCredentials ? "Enter to change…" : "Your GreytHR password"}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <button
              onClick={handleSaveCreds}
              disabled={saving}
              type="button"
              className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : "Save Credentials"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
