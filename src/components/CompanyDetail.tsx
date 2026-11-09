import { useCallback, useEffect, useState } from 'react';
import { mediaUrl, request } from '../api/client';
import type {
  CompanyDetail,
  DocumentRequirement,
  SubscriptionPaymentAttempt,
} from '../api/types';
import {
  DOCUMENT_TYPES,
  cycleLabels,
  dateOnly,
  dateTime,
  docTypeLabels,
  errorMessage,
  money,
  statusLabel,
} from '../lib/format';
import { ReasonDialog } from './ReasonDialog';

type Tab = 'process' | 'documents' | 'requirements' | 'subscription' | 'history';
type ReasonAction = 'correction' | 'reject' | 'suspend';

const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'process', label: 'Processo' },
  { id: 'documents', label: 'Documentos' },
  { id: 'requirements', label: 'Requisitos' },
  { id: 'subscription', label: 'Subscrição' },
  { id: 'history', label: 'Histórico' },
];

const REQUIREMENT_EDITABLE = ['draft', 'submitted', 'under_review', 'needs_correction'];
const ACTIVATABLE = ['pending_payment', 'trialing', 'active', 'expired'];

function normalizeRequirements(list: DocumentRequirement[]): DocumentRequirement[] {
  return DOCUMENT_TYPES.map((docType) =>
    list.find((item) => item.doc_type === docType)
    ?? { doc_type: docType, is_required: false, note: null });
}

export function CompanyDetailPanel({
  companyId,
  onChanged,
  onClose,
}: {
  companyId: string;
  onChanged: () => void;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<CompanyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<Tab>('process');
  const [reasonAction, setReasonAction] = useState<ReasonAction | null>(null);
  const [rejectingDoc, setRejectingDoc] = useState('');
  const [rejectNote, setRejectNote] = useState('');
  const [requirements, setRequirements] = useState<DocumentRequirement[]>([]);
  const [reference, setReference] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const data = await request<CompanyDetail>(`/platform/companies/${companyId}`);
      setDetail(data);
      setRequirements(normalizeRequirements(data.document_requirements));
    } catch (reason) {
      setError(errorMessage(reason, 'Não foi possível carregar o processo da empresa.'));
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { void load(); }, [load]);

  async function call(path: string, method: string, body: unknown, success: string): Promise<boolean> {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await request<unknown>(path, { method, body });
      setNotice(success);
      await load(true);
      onChanged();
      return true;
    } catch (reason) {
      setError(errorMessage(reason, 'Não foi possível concluir a operação.'));
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <section className="card"><div className="empty"><span className="spinner" /><p>A carregar processo…</p></div></section>;
  }

  if (!detail) {
    return (
      <section className="card">
        <div className="empty">
          <strong>Não foi possível abrir o processo</strong>
          <p>{error || 'Tente novamente.'}</p>
          <button className="btn btn--small" type="button" onClick={onClose}>Fechar</button>
        </div>
      </section>
    );
  }

  const company = detail.company;
  const subscription = detail.subscription;
  const canReview = company.status === 'under_review';
  const canEditRequirements = REQUIREMENT_EDITABLE.includes(company.status);
  const requiredDocs = detail.document_requirements.filter((item) => item.is_required);
  const validDocs = detail.documents.filter((doc) => doc.status === 'valid'
    && requiredDocs.some((req) => req.doc_type === doc.doc_type));
  const canActivate = Boolean(subscription?.plan_selected_at)
    && company.status === 'approved'
    && ACTIVATABLE.includes(subscription?.status || '');

  async function reviewDocument(documentId: string, status: 'valid' | 'invalid') {
    const notes = status === 'invalid' ? rejectNote.trim() : null;
    const done = await call(
      `/platform/documents/${documentId}/review`,
      'PATCH',
      { status, notes },
      status === 'valid' ? 'Documento validado.' : 'Pedido de correção registado no documento.',
    );
    if (done) {
      setRejectingDoc('');
      setRejectNote('');
    }
  }

  async function activateSubscription() {
    const value = reference.trim();
    if (!value) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const payment = await request<SubscriptionPaymentAttempt>(
        `/platform/companies/${company.id}/subscription/activate`,
        { method: 'POST', body: { payment_reference: value } },
      );
      setReference('');
      setNotice(`Pagamento de ${money(payment.amount_cents, payment.currency)} registado. Referência: ${payment.provider_reference || value}.`);
      await load(true);
      onChanged();
    } catch (reason) {
      setError(errorMessage(reason, 'Não foi possível registar o pagamento.'));
    } finally {
      setBusy(false);
    }
  }

  async function submitReason(reason: string) {
    if (!reasonAction) return;
    const config = {
      correction: {
        path: `/platform/companies/${company.id}/request-correction`,
        success: 'Pedido de correção enviado à empresa.',
      },
      reject: {
        path: `/platform/companies/${company.id}/reject`,
        success: 'Empresa rejeitada.',
      },
      suspend: {
        path: `/platform/companies/${company.id}/suspend`,
        success: 'Empresa suspensa.',
      },
    }[reasonAction];
    const done = await call(config.path, 'POST', { reason }, config.success);
    if (done) setReasonAction(null);
  }

  const reasonDialog = reasonAction && {
    correction: {
      title: 'Solicitar correções',
      description: 'A empresa recebe o motivo e volta a submeter o processo depois de corrigir.',
      confirmLabel: 'Enviar pedido',
    },
    reject: {
      title: 'Rejeitar empresa',
      description: 'A rejeição encerra o processo de onboarding. O motivo fica visível para a empresa.',
      confirmLabel: 'Rejeitar',
    },
    suspend: {
      title: 'Suspender empresa',
      description: 'Enquanto suspensa, a empresa não pode operar no ERP.',
      confirmLabel: 'Suspender',
    },
  }[reasonAction];

  return (
    <section className="card">
      <div className="detail__head">
        <div>
          <span className={`pill pill--${company.status}`}>{statusLabel(company.status)}</span>
          <h2>{company.trade_name || company.legal_name}</h2>
          <p>{company.legal_name} · NIF {company.nif}</p>
        </div>
        <button className="icon-btn" type="button" onClick={onClose} aria-label="Fechar processo">×</button>
      </div>

      <div className="tabs" role="tablist" aria-label="Secções do processo">
        {tabs.map((item) => (
          <button
            key={item.id}
            className={tab === item.id ? 'tab tab--active' : 'tab'}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {(error || notice) && (
        <div className="notice-stack">
          {error && <div className="notice notice--error" role="alert">{error}</div>}
          {notice && <div className="notice notice--success" role="status">{notice}</div>}
        </div>
      )}

      {tab === 'process' && (
        <>
          {company.status_reason && (
            <div className="notice notice--warn" style={{ marginBottom: 14 }}>
              <strong>Motivo do estado atual:</strong> {company.status_reason}
            </div>
          )}
          <div className="facts">
            <div className="fact"><small>Email</small><strong>{company.email}</strong></div>
            <div className="fact"><small>Telefone</small><strong>{company.phone || '—'}</strong></div>
            <div className="fact">
              <small>Localização</small>
              <strong>{[company.municipality || company.city, company.province, company.country].filter(Boolean).join(', ') || '—'}</strong>
            </div>
            <div className="fact"><small>Atividade</small><strong>{company.business_activity || '—'}</strong></div>
            <div className="fact"><small>Forma legal</small><strong>{company.legal_form || '—'}</strong></div>
            <div className="fact"><small>Registo comercial</small><strong>{company.registration_number || '—'}</strong></div>
            <div className="fact"><small>Constituição</small><strong>{dateOnly(company.incorporation_date)}</strong></div>
            <div className="fact"><small>Aprovada em</small><strong>{dateOnly(company.approved_at)}</strong></div>
          </div>

          <div className="section-title">
            <h3>Progresso documental</h3>
            <span>{validDocs.length} de {requiredDocs.length} obrigatórios validados</span>
          </div>
          <div className={`notice ${validDocs.length >= requiredDocs.length && requiredDocs.length > 0 ? 'notice--success' : 'notice--warn'}`}>
            {requiredDocs.length === 0
              ? 'Esta empresa não tem requisitos documentais definidos.'
              : validDocs.length >= requiredDocs.length
                ? 'Todos os documentos obrigatórios estão validados.'
                : 'A aprovação exige que todos os documentos obrigatórios estejam validados.'}
          </div>

          <div className="section-title"><h3>Ações do processo</h3></div>
          <div className="form-row">
            {company.status === 'submitted' && (
              <button
                className="btn btn--primary"
                type="button"
                disabled={busy}
                onClick={() => void call(`/platform/companies/${company.id}/start-review`, 'POST', undefined, 'Revisão iniciada.')}
              >
                Iniciar revisão
              </button>
            )}
            {company.status === 'under_review' && (
              <>
                <button
                  className="btn btn--primary"
                  type="button"
                  disabled={busy || validDocs.length < requiredDocs.length}
                  onClick={() => void call(`/platform/companies/${company.id}/approve`, 'POST', undefined, 'Empresa aprovada.')}
                >
                  Aprovar empresa
                </button>
                <button className="btn" type="button" disabled={busy} onClick={() => setReasonAction('correction')}>
                  Solicitar correções
                </button>
                <button className="btn btn--danger" type="button" disabled={busy} onClick={() => setReasonAction('reject')}>
                  Rejeitar
                </button>
              </>
            )}
            {company.status === 'approved' && (
              <button className="btn btn--danger" type="button" disabled={busy} onClick={() => setReasonAction('suspend')}>
                Suspender
              </button>
            )}
            {company.status === 'suspended' && (
              <button
                className="btn btn--primary"
                type="button"
                disabled={busy}
                onClick={() => void call(`/platform/companies/${company.id}/reinstate`, 'POST', undefined, 'Empresa reativada.')}
              >
                Reativar empresa
              </button>
            )}
            {company.status === 'needs_correction' && (
              <span className="notice notice--warn" style={{ flex: '1 1 100%' }}>
                À espera que a empresa corrija e volte a submeter o processo.
              </span>
            )}
            {['draft', 'rejected'].includes(company.status) && (
              <span className="notice" style={{ flex: '1 1 100%' }}>
                Este processo não tem ações disponíveis no estado atual.
              </span>
            )}
          </div>
        </>
      )}

      {tab === 'documents' && (
        <>
          <div className="section-title">
            <h3>Documentos submetidos</h3>
            <span>{detail.documents.length} ficheiros</span>
          </div>
          {detail.documents.map((doc) => (
            <div className="doc" key={doc.id}>
              <div className="doc__top">
                <div className="doc__title">
                  <strong>{docTypeLabels[doc.doc_type] || doc.doc_type}</strong>
                  <small>{doc.file_name || doc.document_number || 'Ficheiro submetido'} · {dateTime(doc.created_at)}</small>
                  {doc.review_notes && <small className="doc__note">{doc.review_notes}</small>}
                </div>
                <span className={`pill pill--${doc.status}`}>{statusLabel(doc.status)}</span>
              </div>
              <div className="doc__actions">
                {doc.reference && (
                  <a className="btn btn--small" href={mediaUrl(doc.reference)} target="_blank" rel="noreferrer">
                    Ver ficheiro
                  </a>
                )}
                {canReview && (
                  <>
                    <button className="btn btn--small btn--primary" type="button" disabled={busy} onClick={() => void reviewDocument(doc.id, 'valid')}>
                      Validar
                    </button>
                    <button
                      className="btn btn--small"
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setRejectingDoc(rejectingDoc === doc.id ? '' : doc.id);
                        setRejectNote('');
                      }}
                    >
                      Pedir correção
                    </button>
                  </>
                )}
              </div>
              {rejectingDoc === doc.id && (
                <div className="doc__review">
                  <textarea
                    className="textarea"
                    autoFocus
                    maxLength={1000}
                    value={rejectNote}
                    onChange={(event) => setRejectNote(event.target.value)}
                    placeholder="Indique o que a empresa deve corrigir neste documento."
                  />
                  <div className="doc__actions">
                    <button className="btn btn--small" type="button" onClick={() => setRejectingDoc('')}>Cancelar</button>
                    <button
                      className="btn btn--small btn--danger"
                      type="button"
                      disabled={busy || !rejectNote.trim()}
                      onClick={() => void reviewDocument(doc.id, 'invalid')}
                    >
                      Registar correção
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {!detail.documents.length && (
            <div className="empty"><strong>Ainda sem documentos</strong><p>A empresa não enviou ficheiros para este processo.</p></div>
          )}
        </>
      )}

      {tab === 'requirements' && (
        <>
          <div className="section-title">
            <h3>Requisitos documentais</h3>
            <span>{canEditRequirements ? 'Editável neste estado' : 'Bloqueado neste estado'}</span>
          </div>
          {requirements.map((requirement) => (
            <div className="requirement" key={requirement.doc_type}>
              <label className="requirement__toggle">
                <input
                  type="checkbox"
                  checked={requirement.is_required}
                  disabled={!canEditRequirements || busy}
                  onChange={(event) => setRequirements((current) => current.map((item) =>
                    item.doc_type === requirement.doc_type
                      ? { ...item, is_required: event.target.checked }
                      : item))}
                />
                {docTypeLabels[requirement.doc_type] || requirement.doc_type}
              </label>
              <input
                className="input"
                aria-label={`Nota para ${docTypeLabels[requirement.doc_type] || requirement.doc_type}`}
                value={requirement.note || ''}
                disabled={!canEditRequirements || busy}
                maxLength={500}
                placeholder="Nota para a empresa (opcional)"
                onChange={(event) => setRequirements((current) => current.map((item) =>
                  item.doc_type === requirement.doc_type
                    ? { ...item, note: event.target.value || null }
                    : item))}
              />
            </div>
          ))}
          {canEditRequirements && (
            <div className="form-row" style={{ marginTop: 14 }}>
              <button
                className="btn btn--primary"
                type="button"
                disabled={busy || !requirements.some((item) => item.is_required)}
                onClick={() => void call(
                  `/platform/companies/${company.id}/document-requirements`,
                  'PUT',
                  { requirements },
                  'Requisitos documentais atualizados.',
                )}
              >
                Guardar requisitos
              </button>
              <span className="notice" style={{ flex: '1 1 240px' }}>
                Pelo menos um documento tem de continuar obrigatório.
              </span>
            </div>
          )}
        </>
      )}

      {tab === 'subscription' && (
        <>
          {subscription ? (
            <>
              <div className="sub-grid">
                <div className="sub-cell"><small>Plano</small><strong>{subscription.plan_code.toUpperCase()}</strong></div>
                <div className="sub-cell"><small>Periodicidade</small><strong>{cycleLabels[subscription.billing_cycle] || subscription.billing_cycle}</strong></div>
                <div className="sub-cell"><small>Estado</small><strong>{statusLabel(subscription.status)}</strong></div>
                <div className="sub-cell"><small>Início</small><strong>{dateOnly(subscription.starts_at)}</strong></div>
                <div className="sub-cell"><small>Fim</small><strong>{dateOnly(subscription.expires_at)}</strong></div>
                <div className="sub-cell"><small>Plano escolhido</small><strong>{dateOnly(subscription.plan_selected_at)}</strong></div>
              </div>
              {canActivate ? (
                <div className="form-row">
                  <label className="fact" style={{ gap: 6 }}>
                    <small>Referência do pagamento</small>
                    <input
                      className="input"
                      value={reference}
                      maxLength={200}
                      onChange={(event) => setReference(event.target.value)}
                      placeholder="Ex.: referência bancária ou recibo"
                    />
                  </label>
                  <button
                    className="btn btn--primary"
                    type="button"
                    disabled={busy || !reference.trim()}
                    onClick={() => void activateSubscription()}
                  >
                    {['active', 'expired'].includes(subscription.status) ? 'Registar pagamento e renovar' : 'Registar pagamento e ativar'}
                  </button>
                </div>
              ) : (
                <div className="notice">
                  {company.status !== 'approved'
                    ? 'A subscrição só pode ser ativada depois da aprovação da empresa.'
                    : 'Esta subscrição não está em condições de ativação.'}
                </div>
              )}
              {subscription.modules.length > 0 && (
                <>
                  <div className="section-title"><h3>Módulos incluídos</h3></div>
                  <div className="notice">{subscription.modules.join(' · ')}</div>
                </>
              )}
            </>
          ) : (
            <div className="empty"><strong>Sem subscrição</strong><p>A empresa ainda não escolheu um plano.</p></div>
          )}
        </>
      )}

      {tab === 'history' && (
        <>
          <div className="section-title"><h3>Histórico do processo</h3><span>{detail.status_history.length} alterações</span></div>
          <div className="timeline">
            {detail.status_history.map((entry) => (
              <div className="timeline__item" key={entry.id}>
                <span className="timeline__dot" aria-hidden="true" />
                <div className="timeline__body">
                  <strong>{statusLabel(entry.to_status)}</strong>
                  <small>{dateTime(entry.created_at)}</small>
                  {entry.reason && <p>{entry.reason}</p>}
                </div>
              </div>
            ))}
          </div>
          {!detail.status_history.length && (
            <div className="empty"><strong>Sem alterações registadas</strong><p>O processo ainda não mudou de estado.</p></div>
          )}
        </>
      )}

      {reasonAction && reasonDialog && (
        <ReasonDialog
          title={reasonDialog.title}
          description={reasonDialog.description}
          confirmLabel={reasonDialog.confirmLabel}
          busy={busy}
          destructive={reasonAction !== 'correction'}
          onCancel={() => setReasonAction(null)}
          onConfirm={(reason) => void submitReason(reason)}
        />
      )}
    </section>
  );
}
