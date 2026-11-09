import { useState, type FormEvent } from 'react';
import { ApiError, login } from '../api/client';
import { Brand } from './Brand';

export function AuthScreen({ onAuthenticated, initialError = '' }: {
  onAuthenticated: () => void;
  initialError?: string;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email.trim(), password);
      onAuthenticated();
    } catch (reason) {
      setError(reason instanceof ApiError
        ? reason.message
        : 'Não foi possível contactar a API. Verifique a ligação e tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <section className="login__story">
        <Brand tagline="Console de operação · Nobug Labs" />
        <div className="login__story-body">
          <span className="eyebrow">ACESSO RESTRITO</span>
          <h1>Onde cada empresa entra no sistema.</h1>
          <p>
            Acompanhe registos, valide documentos e ative subscrições do Ágata ERP.
            Este console é independente do espaço de trabalho das empresas.
          </p>
        </div>
        <div className="login__story-foot">
          Ágata Admin · Todos os direitos reservados · Nobug Labs
        </div>
      </section>

      <section className="login__panel">
        <div>
          <span className="eyebrow">CONSOLE DA PLATAFORMA</span>
          <h2 style={{ margin: '8px 0 6px', fontSize: 24, letterSpacing: '-.035em' }}>
            Entrar no Ágata Admin
          </h2>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: 12 }}>
            Use uma conta com privilégios de administrador da plataforma.
          </p>
        </div>

        <form className="login__form" onSubmit={submit}>
          <label className="fact" style={{ gap: 6 }}>
            <small>Email</small>
            <input
              className="input"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nome@nobuglabs.com"
            />
          </label>
          <label className="fact" style={{ gap: 6 }}>
            <small>Palavra-passe</small>
            <input
              className="input"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="A sua palavra-passe"
            />
          </label>
          {error && <div className="notice notice--error" role="alert">{error}</div>}
          <button className="btn btn--primary btn--block" type="submit" disabled={busy}>
            {busy ? 'A validar…' : 'Entrar no console'}
          </button>
        </form>
      </section>
    </main>
  );
}
