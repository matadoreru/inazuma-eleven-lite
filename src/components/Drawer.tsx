import { useEffect } from 'react'
import Icon from './Icon'

interface Props {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
  width?: string
  headerActions?: React.ReactNode
}

export default function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  width = 'w-96',
  headerActions,
}: Props) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        className={`fixed top-0 right-0 h-full z-50 flex flex-col bg-dark-900/95 border-l border-gold-600/30 shadow-2xl
          ${width} transition-transform duration-200 ease-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gold-600/20 shrink-0">
          <div>
            <h2 className="text-white font-bold text-base">{title}</h2>
            {subtitle && <p className="text-gray-400 text-xs mt-0.5">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-1 ml-3 -mr-1 -mt-0.5">
            {headerActions}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-dark-700/60 transition-colors"
              aria-label="Cerrar"
            >
              <Icon name="close" size="sm" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </>
  )
}
