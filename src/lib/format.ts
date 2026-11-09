import { ApiError } from '../api/client';

export const DOCUMENT_TYPES = [
  'representative_id',
  'nif_certificate',
  'commercial_registry',
  'activity_license',
  'representation_powers',
  'incorporation_publication',
  'other',
] as const;

export const docTypeLabels: Record<string, string> = {
  representative_id: 'Identificação do representante',
  nif_certificate: 'Certificado de NIF',
  commercial_registry: 'Registo comercial',
  activity_license: 'Licença de atividade',
  representation_powers: 'Poderes de representação',
  incorporation_publication: 'Publicação de constituição',
  other: 'Outro documento',
};

export const statusLabels: Record<string, string> = {
  draft: 'Rascunho',
  submitted: 'Submetida',
  under_review: 'Em análise',
  needs_correction: 'Precisa de correções',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
  suspended: 'Suspensa',
  pending: 'Por validar',
  pending_payment: 'Plano por ativar',
  trialing: 'Teste grátis',
  active: 'Ativa',
  expired: 'Expirada',
  cancelled: 'Cancelada',
  valid: 'Validado',
  invalid: 'Inválido',
};

export const cycleLabels: Record<string, string> = {
  monthly: 'Mensal',
  annual: 'Anual',
  usage: 'Por utilização',
};

export function statusLabel(status: string): string {
  return statusLabels[status] || status;
}

export function money(cents: number, currency = 'AOA'): string {
  return new Intl.NumberFormat('pt-AO', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function dateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-AO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function dateOnly(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('pt-AO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function errorMessage(reason: unknown, fallback: string): string {
  if (reason instanceof ApiError && reason.status === 403) {
    return 'Esta conta não tem acesso à administração da plataforma.';
  }
  if (reason instanceof Error && reason.message) return reason.message;
  return fallback;
}
