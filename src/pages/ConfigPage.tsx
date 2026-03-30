import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { LogOut, Download, User, CreditCard, Info } from 'lucide-react';

const ConfigPage: React.FC = () => {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [nome, setNome] = useState('');
  const [salario, setSalario] = useState('');
  const [carga, setCarga] = useState('');
  const [percentual, setPercentual] = useState('');
  const [almoco, setAlmoco] = useState('60');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setNome(profile.nome || '');
      setSalario(String(profile.salario_base || ''));
      setCarga(String(profile.carga_horaria_diaria || ''));
      setPercentual(String(profile.hora_extra_percentual || ''));
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      nome: nome.trim(),
      salario_base: Number(salario),
      carga_horaria_diaria: Number(carga),
      hora_extra_percentual: Number(percentual),
    }).eq('id', user.id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      await refreshProfile();
      toast({ title: 'Perfil atualizado!' });
    }
    setSaving(false);
  };

  const handleExport = async () => {
    if (!user) return;
    const { data: registros } = await supabase
      .from('registros_ponto')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null);
    const blob = new Blob([JSON.stringify({ profile, registros }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hora-justa-dados.json';
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Dados exportados!' });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppHeader title="Configurações" />
      <div className="px-4 -mt-3 max-w-lg mx-auto space-y-4">
        {/* Profile */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <User size={16} className="text-accent" />
            <span className="font-semibold text-sm">Meu perfil</span>
          </div>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" className="rounded-xl" />
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
              <Input type="number" value={salario} onChange={(e) => setSalario(e.target.value)} className="rounded-xl pl-9" placeholder="Salário" />
            </div>
            <Input type="number" value={carga} onChange={(e) => setCarga(e.target.value)} className="rounded-xl" placeholder="Horas/dia" />
          </div>
          <Input type="number" value={percentual} onChange={(e) => setPercentual(e.target.value)} className="rounded-xl" placeholder="% hora extra" />
          <Button onClick={handleSave} disabled={saving} className="w-full rounded-xl bg-primary text-primary-foreground">
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>

        {/* Plan */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2">
            <CreditCard size={16} className="text-accent" />
            <span className="font-semibold text-sm">Plano atual</span>
            <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${
              profile?.plano === 'pro' ? 'bg-accent/20 text-accent' : 'bg-secondary text-muted-foreground'
            }`}>
              {profile?.plano === 'pro' ? 'PRO' : 'FREE'}
            </span>
          </div>
        </div>

        {/* Export */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Download size={16} className="text-accent" />
              <span className="font-semibold text-sm">Meus dados</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleExport} className="rounded-lg text-xs">
              Exportar JSON
            </Button>
          </div>
        </div>

        {/* About */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2">
            <Info size={16} className="text-accent" />
            <span className="font-semibold text-sm">Sobre</span>
            <span className="ml-auto text-xs text-muted-foreground">v1.0.0</span>
          </div>
        </div>

        {/* Sign out */}
        <Button
          onClick={handleSignOut}
          variant="destructive"
          className="w-full rounded-xl h-12 font-semibold gap-2"
        >
          <LogOut size={16} />
          Sair
        </Button>
      </div>
      <BottomNav />
    </div>
  );
};

export default ConfigPage;
