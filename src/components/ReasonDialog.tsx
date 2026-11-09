import { useState } from 'react';

export function ReasonDialog({
  title,
  description,
  confirmLabel,
  busy,
  destructive = false,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  busy: boolean;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const valid = reason.trim().length >= 3;

  return (
    <div className="modal-layer" role="presentation">
      <form
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) onConfirm(reason.trim());
        }}
      >
        <h2>{title}</h2>
        <p>{description}</p>
        <label className="fact" style={{ gap: 6 }}>
          <small>Motivo (mínimo 3 caracteres)</small>
          <textarea
            className="textarea"
            autoFocus
            maxLength={1000}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Explique à empresa o que deve ser feito."
          />
        </label>
        <div className="modal__actions">
          <button className="btn" type="button" onClick={onCancel} disabled={busy}>Cancelar</button>
          <button
            className={destructive ? 'btn btn--danger' : 'btn btn--primary'}
            type="submit"
            disabled={busy || !valid}
          >
            {busy ? 'A enviar…' : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
