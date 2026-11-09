import { useCallback, useEffect, useState } from 'react';
import { ApiError, clearTokens, hasSession, logoutSession, request } from './api/client';
import type { Company, Page, UserProfile } from './api/types';
import { AuthScreen } from './components/AuthScreen';
import { Brand } from './components/Brand';
import { CompanyDetailPanel } from './components/CompanyDetail';
import { CompanyQueue } from './components/CompanyQueue';
import { Overview, type QueueCounts } from './components/Overview';
import { statusLabel } from './lib/format';

type View = 'overview' | 'queue';
type Access = 'checking' | 'granted' | 'denied';

const STATUSES = ['draft', 'submitted', 'under_review', 'needs_correction', 'approved', 'rejected', 'suspended'];

function queueHeading(status: string, subscriptionStatus: string) {
  if (subscriptionStatus === 'pending_payment') {
    return {
      eyebrow: 'SUBSCRIÇÕES',
      title: 'Planos por ativar',
      description: 'Empresas aprovadas cujo pagamento requer confirmação da equipa.',
    };
  }
  switch (status) {
    case 'submitted':
      return { eyebrow: 'ONBOARDING', title: 'Submetidas', description: 'Empresas que concluíram o perfil e aguardam o início da revisão.' };
    case 'under_review':
      return { eyebrow: 'ONBOARDING', title: 'Em análise', description: 'Processos abertos para validação de documentos.' };
    case 'needs_correction':
      return { eyebrow: 'ONBOARDING', title: 'Correções pedidas', description: 'Processos devolvidos à empresa.' };
    case 'approved':
      return { eyebrow: 'OPERAÇÃO', title: 'Empresas aprovadas', description: 'Empresas com acesso operacional ao ERP.' };
    case 'rejected':
      return { eyebrow: 'OPERAÇÃO', title: 'Empresas rejeitadas', description: 'Processos encerrados pela plataforma.' };
    case 'suspended':
      return { eyebrow: 'OPERAÇÃO', title: 'Empresas suspensas', description: 'Empresas sem acesso operacional.' };
    case 'draft':
      return { eyebrow: 'ONBOARDING', title: 'Rascunhos', description: 'Registos criados que ainda não foram submetidos.' };
    default:
      return { eyebrow: 'PLATAFORMA', title: 'Empresas', description: 'Todos os registos de empresas do Ágata ERP.' };
  }
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(hasSession());
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [access, setAccess] = useState<Access>('checking');
  const [bootError, setBootError] = useState('');
  const [view, setView] = useState<View>('overview');
  const [statusFilter, setStatusFilter] = useState('');
  const [subscriptionFilter, setSubscriptionFilter] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [counts, setCounts] = useState<QueueCounts | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadCounts = useCallback(async () => {
    try {
      const totals = await Promise.all([
        ...STATUSES.map((status) => request<Page<Company>>(
          `/platform/companies?status=${status}&page=1&per_page=1`,
        ).then((page) => page.total)),
        request<Page<Company>>('/platform/companies?subscription_status=pending_payment&page=1&per_page=1')
          .then((page) => page.total),
      ]);
      setCounts({
        draft: totals[0],
        submitted: totals[1],
        under_review: totals[2],
        needs_correction: totals[3],
        approved: totals[4],
        rejected: totals[5],
        suspended: totals[6],
        pending_payment: totals[7],
      });
    } catch {
      // Os totais são informativos; uma falha não deve bloquear o console.
    }
  }, []);

  const loadSession = useCallback(async () => {
    setAccess('checking');
    setBootError('');
    try {
      setProfile(await request<UserProfile>('/auth/me'));
      await request<Page<Company>>('/platform/companies?page=1&per_page=1');
      setAccess('granted');
      void loadCounts();
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) {
        clearTokens();
        setProfile(null);
        setAuthenticated(false);
        setAccess('checking');
      } else if (reason instanceof ApiError && reason.status === 403) {
        setAccess('denied');
      } else {
        setBootError(reason instanceof Error ? reason.message : 'Não foi possível carregar a sessão.');
      }
    }
  }, [loadCounts]);

  useEffect(() => {
    if (authenticated) void loadSession();
  }, [authenticated, loadSession]);

  function refresh() {
    setRefreshKey((key) => key + 1);
    void loadCounts();
  }

  function openQueue(status: string, subscriptionStatus: string, companyId = '') {
    setStatusFilter(status);
    setSubscriptionFilter(subscriptionStatus);
    setSelectedCompanyId(companyId);
    setView('queue');
  }

  async function logout() {
    await logoutSession();
    setProfile(null);
    setCounts(null);
    setSelectedCompanyId('');
    setAccess('checking');
    setAuthenticated(false);
  }

  if (!authenticated) {
    return <AuthScreen initialError={bootError} onAuthenticated={() => setAuthenticated(true)} />;
  }

  if (access === 'checking') {
    return <main className="boot"><span className="spinner" />A validar acesso ao console…</main>;
  }

  if (access === 'denied') {
    return (
      <main className="denied">
        <Brand tagline="Console de operação · Nobug Labs" />
        <strong>Sem acesso ao Ágata Admin</strong>
        <p>
          A conta {profile?.email || 'atual'} está autenticada mas não tem privilégios de administrador
          da plataforma. As empresas usam o Ágata ERP; os administradores usam este console.
        </p>
        <button className="btn" type="button" onClick={() => void logout()}>Terminar sessão</button>
      </main>
    );
  }

  const heading = queueHeading(statusFilter, subscriptionFilter);
  const documentsCount = (counts?.submitted || 0) + (counts?.under_review || 0);

  return (
    <div className="console">
      <aside className="sidebar">
        <Brand />
        <nav className="sidebar__nav" aria-label="Navegação do console">
          <span className="sidebar__caption">OPERAÇÃO</span>
          <button
            className={view === 'overview' ? 'nav-item nav-item--active' : 'nav-item'}
            type="button"
            onClick={() => { setView('overview'); setSelectedCompanyId(''); }}
          >
            <span>Visão geral</span>
          </button>
          <button
            className={view === 'queue' && !statusFilter && !subscriptionFilter ? 'nav-item nav-item--active' : 'nav-item'}
            type="button"
            onClick={() => openQueue('', '')}
          >
            <span>Empresas</span>
          </button>

          <span className="sidebar__caption">FILAS</span>
          <button
            className={view === 'queue' && statusFilter === 'submitted' ? 'nav-item nav-item--active' : 'nav-item'}
            type="button"
            onClick={() => openQueue('submitted', '')}
          >
            <span>Submetidas</span>
            <span className="nav-item__count">{counts?.submitted ?? '—'}</span>
          </button>
          <button
            className={view === 'queue' && statusFilter === 'under_review' ? 'nav-item nav-item--active' : 'nav-item'}
            type="button"
            onClick={() => openQueue('under_review', '')}
          >
            <span>Em análise</span>
            <span className="nav-item__count">{counts?.under_review ?? '—'}</span>
          </button>
          <button
            className={view === 'queue' && statusFilter === 'needs_correction' ? 'nav-item nav-item--active' : 'nav-item'}
            type="button"
            onClick={() => openQueue('needs_correction', '')}
          >
            <span>Correções</span>
            <span className="nav-item__count">{counts?.needs_correction ?? '—'}</span>
          </button>
          <button
            className={view === 'queue' && subscriptionFilter === 'pending_payment' ? 'nav-item nav-item--active' : 'nav-item'}
            type="button"
            onClick={() => openQueue('', 'pending_payment')}
          >
            <span>Planos por ativar</span>
            <span className="nav-item__count">{counts?.pending_payment ?? '—'}</span>
          </button>
          <button
            className={view === 'queue' && statusFilter === 'suspended' ? 'nav-item nav-item--active' : 'nav-item'}
            type="button"
            onClick={() => openQueue('suspended', '')}
          >
            <span>Suspensas</span>
            <span className="nav-item__count">{counts?.suspended ?? '—'}</span>
          </button>
        </nav>

        <div className="sidebar__account">
          <div className="sidebar__user">
            <span className="avatar">{profile?.full_name?.slice(0, 1).toUpperCase() || 'N'}</span>
            <div>
              <strong>{profile?.full_name || 'Administrador'}</strong>
              <small>{profile?.email || ''}</small>
            </div>
          </div>
          <button className="btn btn--small btn--block" type="button" onClick={() => void logout()}>
            Terminar sessão
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="page-head">
          <div>
            <span className="eyebrow">{view === 'overview' ? 'PLATAFORMA' : heading.eyebrow}</span>
            <h1>{view === 'overview' ? 'Visão geral' : heading.title}</h1>
            <p>
              {view === 'overview'
                ? `${documentsCount} processos aguardam revisão · ${counts?.pending_payment ?? 0} pagamentos por registar`
                : heading.description}
            </p>
          </div>
          <div className="page-head__actions">
            <button className="btn" type="button" onClick={refresh}>↻ Atualizar</button>
          </div>
        </header>

        {bootError && <div className="notice notice--error" role="alert" style={{ marginBottom: 14 }}>{bootError}</div>}

        {view === 'overview' ? (
          <Overview counts={counts} refreshKey={refreshKey} onOpenQueue={openQueue} />
        ) : (
          <div className={selectedCompanyId ? 'workspace workspace--split' : 'workspace'}>
            <CompanyQueue
              key={`${statusFilter}:${subscriptionFilter}`}
              status={statusFilter}
              subscriptionStatus={subscriptionFilter}
              selectedId={selectedCompanyId}
              refreshKey={refreshKey}
              onSelect={setSelectedCompanyId}
            />
            {selectedCompanyId && (
              <CompanyDetailPanel
                key={selectedCompanyId}
                companyId={selectedCompanyId}
                onChanged={refresh}
                onClose={() => setSelectedCompanyId('')}
              />
            )}
          </div>
        )}

        {view === 'queue' && statusFilter && (
          <p style={{ margin: '14px 0 0', color: 'var(--faint)', fontSize: 11 }}>
            Filtro ativo: {statusLabel(statusFilter)} · {counts?.[statusFilter as keyof QueueCounts] ?? 0} registos
          </p>
        )}
      </main>
    </div>
  );
}
