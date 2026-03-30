import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';

const AuthPage: React.FC = () => {
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);

    try {
      if (tab === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast({ title: 'Conta criada!', description: 'Verifique seu email para confirmar.' });
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Check onboarding
        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarding_completo')
          .eq('id', data.user.id)
          .single();
        if (profile?.onboarding_completo) {
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

  return (
    <div className="min-h-screen bg-primary flex flex-col items-center justify-center px-4">
      <div className="text-center mb-8">
        <h1 className="text-primary-foreground text-[28px] font-bold">Hora Justa</h1>
        <p className="text-primary-foreground/60 text-sm mt-1">Seu ponto, sua prova.</p>
      </div>

      <div className="bg-card rounded-[20px] p-8 w-full max-w-[380px] shadow-xl">
        <div className="flex mb-6 bg-secondary rounded-lg p-1">
          <button
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === 'login' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
            onClick={() => setTab('login')}
          >
            Entrar
          </button>
          <button
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === 'signup' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
            onClick={() => setTab('signup')}
          >
            Criar conta
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            placeholder="Seu email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="rounded-xl"
          />
          <Input
            type="password"
            placeholder="Sua senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="rounded-xl"
          />
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground rounded-xl h-12 text-base font-semibold"
          >
            {loading ? 'Aguarde...' : tab === 'login' ? 'Entrar' : 'Criar conta'}
          </Button>
        </form>
      </div>

      <p className="text-primary-foreground/40 text-xs text-center mt-6 max-w-[300px]">
        Seus dados ficam salvos com segurança. Ninguém além de você acessa.
      </p>
    </div>
  );
};

export default AuthPage;
