import { useCallback, useEffect, useMemo, useState } from 'react';
import { request } from '../api/client';
import type { Company, Page } from '../api/types';
import { dateOnly, errorMessage, statusLabel } from '../lib/format';

const PER_PAGE = 25;

export function CompanyQueue({
  status,
  subscriptionStatus,
  selectedId,
  refreshKey,
  onSelect,
}: {
  status: string;
  subscriptionStatus: string;
  selectedId: string;
  refreshKey: number;
  onSelect: (companyId: string) => void;
}) {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Page<Company> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({ page: String(page), per_page: String(PER_PAGE) });
      if (status) query.set('status', status);
      if (subscriptionStatus) query.set('subscription_status', subscriptionStatus);
      setResult(await request<Page<Company>>(`/platform/companies?${query.toString()}`));
    } catch (reason) {
      setError(errorMessage(reason, 'Não foi possível carregar as empresas.'));
    } finally {
      setLoading(false);
    }
  }, [page, status, subscriptionStatus]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const items = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term || !result) return result?.items || [];
    return result.items.filter((company) => [
      company.trade_name,
      company.legal_name,
      company.nif,
      company.email,
    ].some((value) => value?.toLowerCase().includes(term)));
  }, [result, search]);

  const pages = result ? Math.max(1, Math.ceil(result.total / PER_PAGE)) : 1;

  return (
    <section className="card">
      <div className="card__head">
        <div>
          <h2>Fila de empresas</h2>
          <p>Selecione um registo para abrir o processo completo.</p>
        </div>
      </div>

      <div className="queue__toolbar">
        <input
          className="input input--search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Filtrar nesta página por nome, NIF ou email"
          aria-label="Filtrar nesta página"
        />
        <button className="btn btn--small" type="button" onClick={() => void load()}>Recarregar</button>
      </div>

      {error && <div className="notice notice--error" role="alert">{error}</div>}

      {loading && !result ? (
        <div className="empty"><span className="spinner" /><p>A carregar empresas…</p></div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>NIF</th>
                  <th>Estado</th>
                  <th>Entrada</th>
                  <th aria-label="Abrir" />
                </tr>
              </thead>
              <tbody>
                {items.map((company) => (
                  <tr
                    className={selectedId === company.id ? 'is-selected' : ''}
                    key={company.id}
                    onClick={() => onSelect(company.id)}
                  >
                    <td>
                      <span className="table__primary">
                        <strong>{company.trade_name || company.legal_name}</strong>
                        <small>{company.email}</small>
                      </span>
                    </td>
                    <td>{company.nif}</td>
                    <td>
                      {subscriptionStatus === 'pending_payment'
                        ? <span className="pill pill--pending_payment">Plano por ativar</span>
                        : <span className={`pill pill--${company.status}`}>{statusLabel(company.status)}</span>}
                    </td>
                    <td>{dateOnly(company.submitted_at || company.created_at)}</td>
                    <td>
                      <button
                        className="table__arrow"
                        type="button"
                        aria-label={`Abrir ${company.legal_name}`}
                        onClick={(event) => { event.stopPropagation(); onSelect(company.id); }}
                      >
                        →
                      </button>
                    </td>
                  </tr>
                ))}
                {!items.length && (
                  <tr>
                    <td className="table__empty" colSpan={5}>
                      {search ? 'Nenhuma empresa corresponde ao filtro nesta página.' : 'Nenhuma empresa nesta fila.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="pager">
            <span>
              Página {page} de {pages} · {result?.total ?? 0} empresas
            </span>
            <span className="pager__actions">
              <button className="btn btn--small" type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>
                Anterior
              </button>
              <button className="btn btn--small" type="button" disabled={page >= pages || loading} onClick={() => setPage((value) => value + 1)}>
                Seguinte
              </button>
            </span>
          </div>
        </>
      )}
    </section>
  );
}
