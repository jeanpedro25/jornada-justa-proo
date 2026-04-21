import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import HoraJustaLogo from '@/components/HoraJustaLogo';


const AuthPage: React.FC = () => {
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const navigate = useNavigate();

  // Forgot / Reset password states
  const [view, setView] = useState<'auth' | 'forgot' | 'reset'>('auth');
  const [newPassword, setNewPassword] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  // Detecta o evento de recuperação de senha enviado pelo Supabase
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setView('reset');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);

    try {
      if (tab === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth` },
        });
        if (error) throw error;
        toast({ title: 'Conta criada!', description: 'Verifique seu email para confirmar.' });
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const { data: profile } = await supabase
          .from('profiles')
          .select('aceite_termos, onboarding_completo')
          .eq('id', data.user.id)
          .maybeSingle();

        if (!profile || !profile.aceite_termos) {
          navigate('/aceite-termos');
        } else if (profile?.onboarding_completo) {
          navigate('/app');
        } else {
          navigate('/onboarding');
        }
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Algo deu errado.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    const redirectTo = `${window.location.origin}/auth`;
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      if (error) throw error;
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Algo deu errado.', variant: 'destructive' });
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      toast({
        title: 'E-mail enviado!',
        description: 'Verifique sua caixa de entrada para redefinir sua senha.',
      });
      setView('auth');
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Algo deu errado.', variant: 'destructive' });
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast({ title: 'Senha muito curta', description: 'A senha deve ter pelo menos 6 caracteres.', variant: 'destructive' });
      return;
    }
    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast({ title: 'Senha atualizada!', description: 'Você já pode entrar com a nova senha.' });
      window.history.replaceState(null, '', window.location.pathname);
      setNewPassword('');
      setView('auth');
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Algo deu errado.', variant: 'destructive' });
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-primary flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-2">
        <HoraJustaLogo size={48} />
        <div className="flex flex-col">
          <span className="text-primary-foreground text-2xl font-bold leading-tight">Hora Justa</span>
          <span className="text-primary-foreground/50 text-xs leading-tight">Controle suas horas. Conheça seu valor.</span>
        </div>
      </div>

      {/* ── RESET PASSWORD VIEW (came from email link) ── */}
      {view === 'reset' && (
        <div className="bg-card rounded-2xl p-7 w-full max-w-[400px] shadow-2xl mt-4">
          <h2 className="text-lg font-bold text-foreground mb-1">Nova senha</h2>
          <p className="text-sm text-muted-foreground mb-5">Digite sua nova senha abaixo.</p>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Nova senha</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                className="rounded-xl h-12"
              />
            </div>
            <Button
              type="submit"
              disabled={forgotLoading}
              className="w-full bg-accent hover:bg-accent/90 text-accent-foreground rounded-xl h-12 text-base font-semibold uppercase tracking-wide"
            >
              {forgotLoading ? 'Salvando...' : 'Salvar nova senha'}
            </Button>
          </form>
        </div>
      )}

      {/* ── FORGOT PASSWORD VIEW ── */}
      {view === 'forgot' && (
        <div className="bg-card rounded-2xl p-7 w-full max-w-[400px] shadow-2xl mt-4">
          <h2 className="text-lg font-bold text-foreground mb-1">Recuperar senha</h2>
          <p className="text-sm text-muted-foreground mb-5">
            Digite seu e-mail e enviaremos um link para redefinir sua senha.
          </p>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">E-mail</label>
              <Input
                type="email"
                placeholder="nome@exemplo.com"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
                className="rounded-xl h-12"
              />
            </div>
            <Button
              type="submit"
              disabled={forgotLoading}
              className="w-full bg-accent hover:bg-accent/90 text-accent-foreground rounded-xl h-12 text-base font-semibold uppercase tracking-wide"
            >
              {forgotLoading ? 'Enviando...' : 'Enviar link de recuperação'}
            </Button>
          </form>
          <button
            type="button"
            onClick={() => setView('auth')}
            className="mt-4 w-full text-center text-sm text-accent hover:underline"
          >
            ← Voltar para o login
          </button>
        </div>
      )}

      {/* ── MAIN AUTH VIEW ── */}
      {view === 'auth' && (
        <div className="bg-card rounded-2xl p-7 w-full max-w-[400px] shadow-2xl mt-4">
          {/* Tabs */}
          <div className="flex mb-5 bg-secondary rounded-lg p-1">
            <button
              className={`flex-1 py-2.5 text-sm font-semibold rounded-md transition-colors ${
                tab === 'login' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
              onClick={() => setTab('login')}
            >
              Entrar
            </button>
            <button
              className={`flex-1 py-2.5 text-sm font-semibold rounded-md transition-colors ${
                tab === 'signup' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
              onClick={() => setTab('signup')}
            >
              Criar conta
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Email</label>
              <Input
                type="email"
                placeholder="nome@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="rounded-xl h-12"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Senha</label>
                {tab === 'login' && (
                  <button
                    type="button"
                    onClick={() => { setForgotEmail(email); setView('forgot'); }}
                    className="text-xs text-accent hover:underline"
                  >
                    Esqueceu a senha?
                  </button>
                )}
              </div>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="rounded-xl h-12"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-accent hover:bg-accent/90 text-accent-foreground rounded-xl h-12 text-base font-semibold uppercase tracking-wide"
            >
              {loading ? 'Aguarde...' : tab === 'login' ? 'Entrar' : 'Criar conta'}
            </Button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">Ou</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Google */}
          <Button
            type="button"
            variant="outline"
            disabled={googleLoading}
            onClick={handleGoogleLogin}
            className="w-full h-12 rounded-xl text-sm font-medium flex items-center justify-center gap-3 border-border"
          >
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.1 24.1 0 0 0 0 21.56l7.98-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            {googleLoading ? 'Aguarde...' : 'Entrar com Google'}
          </Button>
        </div>
      )}

      <p className="text-primary-foreground/40 text-xs text-center mt-6 max-w-[300px]">
        Seus dados ficam salvos com segurança. Ninguém além de você acessa.
      </p>
    </div>
  );
};

export default AuthPage;
