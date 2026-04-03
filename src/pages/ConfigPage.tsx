import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { LogOut, Download, User, CreditCard, Info, Trash2, Shield } from 'lucide-react';
import BancoHorasConfig from '@/components/BancoHorasConfig';
import JornadaConfig from '@/components/JornadaConfig';
import FeriasConfig from '@/components/FeriasConfig';
import FeriadosLocaisConfig from '@/components/FeriadosLocaisConfig';
import AvisoLegal from '@/components/AvisoLegal';

const ConfigPage: React.FC = () => {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const [nome, setNome] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [salario, setSalario] = useState('');
  const [carga, setCarga] = useState('');
  const [percentual, setPercentual] = useState('');
  const [almoco, setAlmoco] = useState('60');
  const [saving, setSaving] = useState(false);

  // Banco de Horas
  const [modoTrabalho, setModoTrabalho] = useState('horas_extras');
  const [prazoComp, setPrazoComp] = useState('180');
  const [regraConv, setRegraConv] = useState('1.5x');
  const [limiteBH, setLimiteBH] = useState('');

  // Jornada
  const [tipoJornada, setTipoJornada] = useState('jornada_fixa');
  const [diasTrabalhados, setDiasTrabalhados] = useState('5');
  const [horarioEntrada, setHorarioEntrada] = useState('');
  const [horarioSaida, setHorarioSaida] = useState('');
  const [escalaTipo, setEscalaTipo] = useState('');
  const [escalaDiasTrabalho, setEscalaDiasTrabalho] = useState('');
  const [escalaDiasFolga, setEscalaDiasFolga] = useState('');
  const [escalaInicio, setEscalaInicio] = useState('');
  const [turnoAInicio, setTurnoAInicio] = useState('');
  const [turnoAFim, setTurnoAFim] = useState('');
  const [turnoBInicio, setTurnoBInicio] = useState('');
  const [turnoBFim, setTurnoBFim] = useState('');
  const [turnoCInicio, setTurnoCInicio] = useState('');
  const [turnoCFim, setTurnoCFim] = useState('');
  const [alternanciaTurno, setAlternanciaTurno] = useState('manual');

  useEffect(() => {
    if (profile) {
      const p = profile as any;
      setNome(p.nome || '');
      setEmpresa(p.empresa || '');
      setSalario(String(p.salario_base || ''));
      setCarga(String(p.carga_horaria_diaria || ''));
      setPercentual(String(p.hora_extra_percentual || ''));
      setAlmoco(String(p.intervalo_almoco ?? 60));
      setModoTrabalho(p.modo_trabalho || 'horas_extras');
      setPrazoComp(String(p.prazo_compensacao_dias || 180));
      setRegraConv(p.regra_conversao || '1.5x');
      setLimiteBH(p.limite_banco_horas ? String(p.limite_banco_horas / 60) : '');
      setTipoJornada(p.tipo_jornada || 'jornada_fixa');
      setDiasTrabalhados(String(p.dias_trabalhados_semana || 5));
      setHorarioEntrada(p.horario_entrada_padrao || '');
      setHorarioSaida(p.horario_saida_padrao || '');
      setEscalaTipo(p.escala_tipo || '');
      setEscalaDiasTrabalho(p.escala_dias_trabalho ? String(p.escala_dias_trabalho) : '');
      setEscalaDiasFolga(p.escala_dias_folga ? String(p.escala_dias_folga) : '');
      setEscalaInicio(p.escala_inicio || '');
      setTurnoAInicio(p.turno_a_inicio || '');
      setTurnoAFim(p.turno_a_fim || '');
      setTurnoBInicio(p.turno_b_inicio || '');
      setTurnoBFim(p.turno_b_fim || '');
      setTurnoCInicio(p.turno_c_inicio || '');
      setTurnoCFim(p.turno_c_fim || '');
      setAlternanciaTurno(p.alternancia_turno || 'manual');
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      nome: nome.trim(),
      empresa: empresa.trim() || null,
      salario_base: Number(salario),
      carga_horaria_diaria: Number(carga),
      hora_extra_percentual: Number(percentual),
      intervalo_almoco: Number(almoco),
      modo_trabalho: modoTrabalho,
      prazo_compensacao_dias: prazoComp === 'custom' ? Number(limiteBH) || 180 : Number(prazoComp),
      regra_conversao: regraConv,
      limite_banco_horas: limiteBH ? Number(limiteBH) * 60 : null,
      tipo_jornada: tipoJornada,
      dias_trabalhados_semana: Number(diasTrabalhados) || 5,
      horario_entrada_padrao: horarioEntrada || null,
      horario_saida_padrao: horarioSaida || null,
      escala_tipo: escalaTipo || null,
      escala_dias_trabalho: escalaDiasTrabalho ? Number(escalaDiasTrabalho) : null,
      escala_dias_folga: escalaDiasFolga ? Number(escalaDiasFolga) : null,
      escala_inicio: escalaInicio || null,
      turno_a_inicio: turnoAInicio || null,
      turno_a_fim: turnoAFim || null,
      turno_b_inicio: turnoBInicio || null,
      turno_b_fim: turnoBFim || null,
      turno_c_inicio: turnoCInicio || null,
      turno_c_fim: turnoCFim || null,
      alternancia_turno: alternanciaTurno,
    } as any).eq('id', user.id);
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
    try {
      toast({ title: '📊 Gerando planilha profissional...', description: 'Aguarde alguns segundos.' });
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Sessão expirada. Faça login novamente.');

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gerar-excel`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao gerar planilha');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hora-justa-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: '✅ Planilha baixada!', description: 'Abra no Excel para ver os dados formatados.' });
    } catch (err: any) {
      toast({ title: 'Erro ao exportar', description: err.message, variant: 'destructive' });
    }
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
        <div className="bg-card rounded-xl border border-border p-4 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <User size={16} className="text-accent" />
            <span className="font-semibold text-sm">Dados pessoais</span>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Seu nome</label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" className="rounded-xl" />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Empresa (opcional)</label>
            <Input value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Nome da empresa" className="rounded-xl" />
            <p className="text-[10px] text-muted-foreground mt-1">
              Informado pelo usuário para fins de organização pessoal.
            </p>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Salário base (R$)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
              <Input type="number" value={salario} onChange={(e) => setSalario(e.target.value)} className="rounded-xl pl-9" placeholder="Ex: 2500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Carga horária/dia</label>
              <Input type="number" value={carga} onChange={(e) => setCarga(e.target.value)} className="rounded-xl" placeholder="Ex: 8" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">% hora extra</label>
              <Input type="number" value={percentual} onChange={(e) => setPercentual(e.target.value)} className="rounded-xl" placeholder="Ex: 50" />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">⏰ Horário de almoço (minutos)</label>
            <Input type="number" value={almoco} onChange={(e) => setAlmoco(e.target.value)} className="rounded-xl" placeholder="Ex: 60" />
            <p className="text-[10px] text-muted-foreground mt-1">
              Tempo de intervalo padrão. CLT exige mínimo de 1h para jornadas &gt; 6h.
            </p>
          </div>
        </div>

        {/* Jornada */}
        <JornadaConfig
          tipoJornada={tipoJornada} setTipoJornada={setTipoJornada}
          diasTrabalhados={diasTrabalhados} setDiasTrabalhados={setDiasTrabalhados}
          horarioEntrada={horarioEntrada} setHorarioEntrada={setHorarioEntrada}
          horarioSaida={horarioSaida} setHorarioSaida={setHorarioSaida}
          escalaTipo={escalaTipo} setEscalaTipo={setEscalaTipo}
          escalaDiasTrabalho={escalaDiasTrabalho} setEscalaDiasTrabalho={setEscalaDiasTrabalho}
          escalaDiasFolga={escalaDiasFolga} setEscalaDiasFolga={setEscalaDiasFolga}
          escalaInicio={escalaInicio} setEscalaInicio={setEscalaInicio}
          turnoAInicio={turnoAInicio} setTurnoAInicio={setTurnoAInicio}
          turnoAFim={turnoAFim} setTurnoAFim={setTurnoAFim}
          turnoBInicio={turnoBInicio} setTurnoBInicio={setTurnoBInicio}
          turnoBFim={turnoBFim} setTurnoBFim={setTurnoBFim}
          turnoCInicio={turnoCInicio} setTurnoCInicio={setTurnoCInicio}
          turnoCFim={turnoCFim} setTurnoCFim={setTurnoCFim}
          alternanciaTurno={alternanciaTurno} setAlternanciaTurno={setAlternanciaTurno}
        />

        {/* Banco de Horas */}
        <BancoHorasConfig
          modoTrabalho={modoTrabalho} setModoTrabalho={setModoTrabalho}
          prazo={prazoComp} setPrazo={setPrazoComp}
          conversao={regraConv} setConversao={setRegraConv}
          limite={limiteBH} setLimite={setLimiteBH}
        />

        {/* Férias */}
        <FeriasConfig />

        {/* Feriados Locais */}
        <div className="bg-card rounded-xl border border-border p-4">
          <FeriadosLocaisConfig />
        </div>

        {/* Save */}
        <Button onClick={handleSave} disabled={saving} className="w-full rounded-xl bg-primary text-primary-foreground">
          {saving ? 'Salvando...' : 'Salvar configurações'}
        </Button>

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
              Exportar Excel
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

        {/* Privacy */}
        <div className="bg-card rounded-xl border border-border p-4">
          <button onClick={() => navigate('/privacidade')} className="flex items-center gap-2 w-full">
            <Shield size={16} className="text-accent" />
            <span className="font-semibold text-sm">Privacidade</span>
            <span className="ml-auto text-xs text-muted-foreground">→</span>
          </button>
        </div>

        {/* Sign out */}
        <Button onClick={handleSignOut} variant="destructive" className="w-full rounded-xl h-12 font-semibold gap-2">
          <LogOut size={16} />
          Sair
        </Button>

        {/* Delete account */}
        <Button
          onClick={async () => {
            if (!confirm('Tem certeza? Isso vai deletar TODOS os seus dados permanentemente. Essa ação não pode ser desfeita.')) return;
            setDeleting(true);
            try {
              const { error } = await supabase.rpc('delete_my_account' as never);
              if (error) throw error;
              await signOut();
              navigate('/auth');
            } catch (e: any) {
              toast({ title: 'Erro', description: e.message, variant: 'destructive' });
              setDeleting(false);
            }
          }}
          disabled={deleting}
          variant="ghost"
          className="w-full rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10 gap-2 text-xs"
        >
          <Trash2 size={14} />
          {deleting ? 'Deletando...' : 'Deletar minha conta e todos os dados'}
        </Button>
      </div>
      <BottomNav />
    </div>
  );
};

export default ConfigPage;
