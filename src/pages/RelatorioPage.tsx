import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import { formatCurrency, calcHorasTrabalhadas, calcHoraExtra, calcValorHoraExtra } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { FileText, Shield, TrendingUp, Download, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';

type Registro = Tables<'registros_ponto'>;

const RelatorioPage: React.FC = () => {
  const { user, profile } = useAuth();
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!user) return;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const end = now.toISOString().split('T')[0];
    supabase
      .from('registros_ponto')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .gte('data', start)
      .lte('data', end)
      .then(({ data }) => setRegistros(data || []));
  }, [user]);

  const carga = profile?.carga_horaria_diaria ?? 8;
  const salario = profile?.salario_base ?? 0;
  const percentual = profile?.hora_extra_percentual ?? 50;

  const totalHoras = registros.reduce((sum, r) => {
    if (!r.saida) return sum;
    return sum + calcHorasTrabalhadas(r.entrada, r.saida, r.intervalo_minutos ?? 60);
  }, 0);

  const totalExtra = registros.reduce((sum, r) => {
    if (!r.saida) return sum;
    const ht = calcHorasTrabalhadas(r.entrada, r.saida, r.intervalo_minutos ?? 60);
    return sum + calcHoraExtra(ht, carga);
  }, 0);

  const valorHE = calcValorHoraExtra(salario, percentual);
  const valorTotal = totalExtra * valorHE;

  const diasExcessivos = registros.filter((r) => {
    if (!r.saida) return false;
    return calcHorasTrabalhadas(r.entrada, r.saida, r.intervalo_minutos ?? 60) > 10;
  }).length;

  const irregularidades = registros.filter((r) => {
    if (!r.saida) return false;
    const ht = calcHorasTrabalhadas(r.entrada, r.saida, r.intervalo_minutos ?? 60);
    return ht > 10 || (r.intervalo_minutos ?? 60) < 60;
  }).length;

  const handleGeneratePDF = async () => {
    setGenerating(true);
    try {
      const now = new Date();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Não autenticado');

      const response = await supabase.functions.invoke('gerar-relatorio', {
        body: { month: now.getMonth() + 1, year: now.getFullYear() },
      });

      if (response.error) throw response.error;

      const { html } = response.data;

      // Create a proper blob and open it
      const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url, '_blank');
      if (printWindow) {
        printWindow.addEventListener('afterprint', () => URL.revokeObjectURL(url));
        setTimeout(() => {
          printWindow.print();
        }, 800);
      } else {
        // Fallback: download as HTML
        const a = document.createElement('a');
        a.href = url;
        a.download = `relatorio-hora-justa-${new Date().toISOString().slice(0, 7)}.html`;
        a.click();
        URL.revokeObjectURL(url);
      }

      toast({ title: 'Relatório gerado!', description: 'Use Ctrl+P para salvar como PDF.' });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Erro ao gerar relatório', variant: 'destructive' });
    }
    setGenerating(false);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppHeader title="Relatório oficial" subtitle="Gerar prova para advogado" />
      <div className="px-4 -mt-3 max-w-lg mx-auto space-y-4">
        {/* Preview Card */}
        <div className="bg-primary text-primary-foreground rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <FileText size={18} />
            <span className="font-semibold text-sm">Resumo do mês</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="opacity-60 text-xs">Total trabalhado</p>
              <p className="font-bold">{totalHoras.toFixed(1)}h</p>
            </div>
            <div>
              <p className="opacity-60 text-xs">Horas extras</p>
              <p className="font-bold text-accent">{totalExtra.toFixed(1)}h</p>
            </div>
            <div>
              <p className="opacity-60 text-xs">O patrão te deve</p>
              <p className="font-bold text-accent">{formatCurrency(valorTotal)}</p>
            </div>
            <div>
              <p className="opacity-60 text-xs">Dias &gt; 10h</p>
              <p className="font-bold">{diasExcessivos}</p>
            </div>
          </div>
          {irregularidades > 0 && (
            <p className="text-xs text-warning mt-2">
              ⚠ {irregularidades} irregularidade{irregularidades > 1 ? 's' : ''} encontrada{irregularidades > 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Features */}
        <div className="bg-card rounded-2xl border border-border p-5">
          <p className="font-bold mb-3">O que o relatório inclui:</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <Shield size={14} className="text-accent shrink-0" />
              Todos os registros de entrada e saída
            </li>
            <li className="flex items-center gap-2">
              <TrendingUp size={14} className="text-accent shrink-0" />
              Cálculo automático de horas extras e valores
            </li>
            <li className="flex items-center gap-2">
              <FileText size={14} className="text-accent shrink-0" />
              Indicação de atestados anexados e edições manuais
            </li>
            <li className="flex items-center gap-2">
              <Shield size={14} className="text-accent shrink-0" />
              Aviso legal com base no Art. 74 da CLT
            </li>
          </ul>
        </div>

        {/* Generate Button */}
        <Button
          onClick={handleGeneratePDF}
          disabled={generating || registros.length === 0}
          className="w-full bg-accent hover:bg-accent/90 text-accent-foreground rounded-xl h-12 font-semibold gap-2"
        >
          {generating ? (
            <><Loader2 size={18} className="animate-spin" /> Gerando...</>
          ) : (
            <><Download size={18} /> Gerar prova para advogado (PDF)</>
          )}
        </Button>
        {registros.length === 0 && (
          <p className="text-xs text-muted-foreground text-center">Nenhum registro neste mês para gerar relatório.</p>
        )}
        <p className="text-[10px] text-muted-foreground/60 text-center mt-2">
          Os valores são estimativas. Consulte um advogado trabalhista para análise do seu caso.
        </p>
      </div>
      <BottomNav />
    </div>
  );
};

export default RelatorioPage;
