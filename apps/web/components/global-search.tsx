'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronRight, FileText, Search, X } from 'lucide-react'

interface Task {
  id: string
  name: string
  statusName: string
  projectName: string
  assigneeNames: string[]
  itemNo: string
}

interface GlobalSearchProps {
  isOpen: boolean
  onClose: () => void
  projects: Array<{ id: string; name: string }>
  tasksByProjectId: Record<string, Task[]>
  onSelectTask: (taskId: string, projectId: string) => void
}

function getStatusColor(status: string): string {
  const s = status.toLowerCase()
  if (s.includes('done') || s.includes('complete') || s.includes('closed')) {
    return 'bg-emerald-100 text-emerald-700'
  }
  if (s.includes('progress') || s.includes('active') || s.includes('open')) {
    return 'bg-blue-100 text-blue-700'
  }
  if (s.includes('review') || s.includes('testing')) {
    return 'bg-purple-100 text-purple-700'
  }
  if (s.includes('block') || s.includes('hold') || s.includes('pause')) {
    return 'bg-red-100 text-red-700'
  }
  return 'bg-gray-100 text-gray-600'
}

export default function GlobalSearch({
  isOpen,
  onClose,
  projects,
  tasksByProjectId,
  onSelectTask,
}: GlobalSearchProps) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Build flat list of all tasks with their project id
  const allTasks: Array<Task & { projectId: string }> = projects.flatMap(
    (project) =>
      (tasksByProjectId[project.id] ?? []).map((task) => ({
        ...task,
        projectId: project.id,
      })),
  )

  const results = query.trim()
    ? allTasks.filter(
        (t) =>
          t.name.toLowerCase().includes(query.toLowerCase()) ||
          t.projectName.toLowerCase().includes(query.toLowerCase()) ||
          t.statusName.toLowerCase().includes(query.toLowerCase()) ||
          t.itemNo.toLowerCase().includes(query.toLowerCase()) ||
          t.assigneeNames.some((a) =>
            a.toLowerCase().includes(query.toLowerCase()),
          ),
      )
    : allTasks.slice(0, 20)

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setActiveIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const item = listRef.current.children[activeIndex] as HTMLElement | undefined
      item?.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, results.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const selected = results[activeIndex]
        if (selected) {
          onSelectTask(selected.id, selected.projectId)
          onClose()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, results, activeIndex, onSelectTask, onClose])

  if (!isOpen) return null

  const handleSelect = (task: Task & { projectId: string }) => {
    onSelectTask(task.id, task.projectId)
    onClose()
  }

  return (
    /* Overlay */
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Global search"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-2xl mx-4 rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 overflow-hidden flex flex-col max-h-[75vh]">
        {/* Search input row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <Search className="h-5 w-5 shrink-0 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks, projects, assignees…"
            className="flex-1 bg-transparent text-base text-gray-900 placeholder:text-gray-400 outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="flex h-6 w-6 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Results */}
        <div className="overflow-y-auto flex-1 scroll-thin">
          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-10 w-10 text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">No tasks found for &ldquo;{query}&rdquo;</p>
              <p className="text-xs text-gray-400 mt-1">Try a different keyword</p>
            </div>
          ) : (
            <>
              {query === '' && (
                <p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Recent tasks
                </p>
              )}
              <ul ref={listRef} role="listbox" className="py-1">
                {results.map((task, idx) => (
                  <li
                    key={`${task.projectId}-${task.id}`}
                    role="option"
                    aria-selected={idx === activeIndex}
                    onClick={() => handleSelect(task)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                      idx === activeIndex
                        ? 'bg-blue-50'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    {/* Icon */}
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                        idx === activeIndex ? 'bg-blue-100' : 'bg-gray-100'
                      }`}
                    >
                      <FileText
                        className={`h-3.5 w-3.5 ${idx === activeIndex ? 'text-blue-600' : 'text-gray-500'}`}
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {task.name}
                        </span>
                        <span className="text-xs text-gray-400 shrink-0">
                          #{task.itemNo}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {/* Project badge */}
                        <span className="inline-flex items-center rounded-md bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200 truncate max-w-[120px]">
                          {task.projectName}
                        </span>
                        {/* Status badge */}
                        <span
                          className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset ring-transparent ${getStatusColor(task.statusName)}`}
                        >
                          {task.statusName}
                        </span>
                        {/* Assignees */}
                        {task.assigneeNames.length > 0 && (
                          <span className="text-xs text-gray-400 truncate">
                            {task.assigneeNames.slice(0, 2).join(', ')}
                            {task.assigneeNames.length > 2 && ` +${task.assigneeNames.length - 2}`}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Chevron */}
                    <ChevronRight
                      className={`h-4 w-4 shrink-0 transition-colors ${
                        idx === activeIndex ? 'text-blue-400' : 'text-gray-300'
                      }`}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Footer keyboard hints */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-100 bg-gray-50">
          <span className="text-xs text-gray-400">
            <kbd className="rounded bg-white px-1.5 py-0.5 text-xs font-mono shadow-sm ring-1 ring-gray-200">↑</kbd>
            <kbd className="ml-1 rounded bg-white px-1.5 py-0.5 text-xs font-mono shadow-sm ring-1 ring-gray-200">↓</kbd>
            {' '}navigate
          </span>
          <span className="text-xs text-gray-400">
            <kbd className="rounded bg-white px-1.5 py-0.5 text-xs font-mono shadow-sm ring-1 ring-gray-200">Enter</kbd>
            {' '}select
          </span>
          <span className="text-xs text-gray-400">
            <kbd className="rounded bg-white px-1.5 py-0.5 text-xs font-mono shadow-sm ring-1 ring-gray-200">Esc</kbd>
            {' '}close
          </span>
          {results.length > 0 && (
            <span className="ml-auto text-xs text-gray-400">
              {results.length} result{results.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
