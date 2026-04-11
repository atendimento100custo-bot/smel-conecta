// src/components/ui/ConfirmDialog.jsx
import Modal from './Modal'
import Button from './Button'

export default function ConfirmDialog({ open, onClose, onConfirm, title, description }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-sm text-slate-600 mb-5">{description}</p>
      <div className="flex gap-2 justify-end">
        <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
        <Button variant="danger" size="sm" onClick={() => { onConfirm(); onClose() }}>Confirmar</Button>
      </div>
    </Modal>
  )
}
