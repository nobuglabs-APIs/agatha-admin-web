import { useCallback, useEffect, useState } from 'react';
import { request } from '../api/client';
import type { Company, Page } from '../api/types';
import { dateOnly, errorMessage, statusLabel } from '../lib/format';

export interface QueueCounts {
  draft: number;
  submitted: number;
  under_review: number;
  needs_correction: number;
  approved: number;
  rejected: number;
  suspended: number;
  pending_payment: number;
}

export function Overview({
  counts,
  refreshKey,
  onOpenQueue,
}: {
  counts: QueueCounts | null;
  refreshKey: number;
  onOpenQueue: (status: string, subscriptionStatus: string, companyId?: string) => void;
}) {
  const [priority, setPriority] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [submitted, underReview] = await Promise.all([
        request<Page<Company>>('/platform/companies?status=submitted&page=1&per_page=6'),
        request<Page<Company>>('/platform/companies?status=under_review&page=1&per_page=6'),
      ]);
      const merged = [...underReview.items, ...submitted.items].sort((a, b) =>
        (a.submitted_at || a.created_at).localeCompare(b.submitted_at || b.created_at));
      setPriority(merged.slice(0, 8));
    } catch (reason) {
      setError(errorMessage(reason, 'Não foi possível carregar a fila prioritária.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const waiting = (counts?.submitted || 0) + (counts?.under_review || 0);

  return (
    <div className="workspace">
      {error && <div className="notice notice--error" role="alert">{error}</div>}

      <div className="metrics">
        <button className="metric metric--warn" type="button" onClick={() => onOpenQueue('submitted', '')}>
          <span className="metric__label">Aguardam revisão</span>
          <span className="metric__value">{counts ? waiting : '—'}</span>
          <span className="metric__hint">{counts?.submitted || 0} submetidas · {counts?.under_review || 0} em análise</span>
        </button>
        <button className="metric" type="button" onClick={() => onOpenQueue('needs_correction', '')}>
          <span className="metric__label">Correções pedidas</span>
          <span className="metric__value">{counts?.needs_correction ?? '—'}</span>
          <span className="metric__hint">À espera da empresa</span>
        </button>
        <button className="metric metric--done" type="button" onClick={() => onOpenQueue('approved', '')}>
          <span className="metric__label">Empresas aprovadas</span>
          <span className="metric__value">{counts?.approved ?? '—'}</span>
          <span className="metric__hint">A operar no ERP</span>
        </button>
        <button className="metric" type="button" onClick={() => onOpenQueue('', 'pending_payment')}>
          <span className="metric__label">Planos por ativar</span>
          <span className="metric__value">{counts?.pending_payment ?? '—'}</span>
          <span className="metric__hint">Pagamento confirmado a registar</span>
        </button>
        <button className="metric metric--danger" type="button" onClick={() => onOpenQueue('suspended', '')}>
          <span className="metric__label">Suspensas</span>
          <span className="metric__value">{counts?.suspended ?? '—'}</span>
          <span className="metric__hint">Sem acesso operacional</span>
        </button>
      </div>

      <section className="card">
        <div className="card__head">
          <div>
            <h2>Fila prioritária</h2>
            <p>Registos submetidos ou em análise, dos mais antigos para os mais recentes.</p>
          </div>
          <button className="btn btn--small" type="button" onClick={() => onOpenQueue('submitted', '')}>
            Ver fila completa
          </button>
        </div>

        {loading ? (
          <div className="empty"><span className="spinner" /><p>A carregar fila…</p></div>
        ) : priority.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>NIF</th>
                  <th>Estado</th>
                  <th>Submetida</th>
                </tr>
              </thead>
              <tbody>
                {priority.map((company) => (
                  <tr key={company.id} onClick={() => onOpenQueue(company.status, '', company.id)}>
                    <td>
                      <span className="table__primary">
                        <strong>{company.trade_name || company.legal_name}</strong>
                        <small>{company.email}</small>
                      </span>
                    </td>
                    <td>{company.nif}</td>
                    <td><span className={`pill pill--${company.status}`}>{statusLabel(company.status)}</span></td>
                    <td>{dateOnly(company.submitted_at || company.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            <strong>Nada à espera de revisão</strong>
            <p>Quando uma empresa submeter o processo de onboarding, aparece aqui.</p>
          </div>
        )}
      </section>
    </div>
  );
}
