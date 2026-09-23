import { useEffect } from 'react'
import { X } from 'lucide-react'
import './Modal.css'

interface ModalProps {
  title: string
  onClose: () => void
  children: React.ReactNode
  width?: number
  footer?: React.ReactNode
}

export function Modal({ title, onClose, children, width = 400, footer }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ width }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onClose} title="Close">
            <X size={14} strokeWidth={2} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}
