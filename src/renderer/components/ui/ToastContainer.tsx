import { X, CheckCircle, XCircle, Info } from 'lucide-react'
import { useToastStore } from '../../store/toastStore'
import './ToastContainer.css'

export function ToastContainer() {
  const { toasts, remove } = useToastStore()
  if (toasts.length === 0) return null

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast--${t.type} ${t.onClick ? 'toast--clickable' : ''}`}
          onClick={t.onClick ? () => { t.onClick!(); remove(t.id) } : undefined}
        >
          <span className="toast-icon">
            {t.type === 'success' && <CheckCircle size={13} strokeWidth={2} />}
            {t.type === 'error'   && <XCircle    size={13} strokeWidth={2} />}
            {t.type === 'info'    && <Info        size={13} strokeWidth={2} />}
          </span>
          <span className="toast-text">{t.text}</span>
          <button className="toast-close" onClick={(e) => { e.stopPropagation(); remove(t.id) }}>
            <X size={11} strokeWidth={2} />
          </button>
        </div>
      ))}
    </div>
  )
}
