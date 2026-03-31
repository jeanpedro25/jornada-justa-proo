import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import { formatCurrency, calcHorasTrabalhadas, calcHoraExtra, calcValorHoraExtra } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { FileText, Shield, TrendingUp, Download, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import type { Tables } from '@/integrations/supabase/types';

type Registro = Tables<'registros_ponto'>;

const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
const meses = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function gerarPDF(registros: Registro[], perfil: any, periodoLabel: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const largura = doc.internal.pageSize.getWidth();
  const margem = 15;
  let y = 20;

  // Header
  doc.setFillColor(26, 26, 46);
  doc.rect(0, 0, largura, 35, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('HORA JUSTA', margem, 14);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Relatorio de Jornada de Trabalho', margem, 21);
  doc.setFontSize(9);
  doc.setTextColor(78, 205, 196);
  doc.text(`${periodoLabel} - ${perfil?.nome || 'Trabalhador'}`, margem, 28);
  doc.setTextColor(200, 200, 200);
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, largura - margem, 28, { align: 'right' });

  y = 45;

  // Legal notice
  doc.setFillColor(255, 248, 225);
  doc.setDrawColor(243, 156, 18);
  doc.roundedRect(margem, y, largura - margem * 2, 20, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 60, 0);
  doc.setFont('helvetica', 'bold');
  doc.text('AVISO LEGAL:', margem + 3, y + 5);
  doc.setFont('helvetica', 'normal');
  const avisoTexto = 'Este relatorio foi gerado com base nos registros inseridos pelo trabalhador. Os valores sao estimativas e nao constituem laudo pericial. Pode ser utilizado como prova complementar em processos trabalhistas, sujeito a avaliacao do juizo competente. Hora Justa nao presta assessoria juridica.';
  const avisoLinhas = doc.splitTextToSize(avisoTexto, largura - margem * 2 - 6);
  doc.text(avisoLinhas, margem + 3, y + 10);
  y += 26;

  // Calculate totals
  const carga = perfil?.carga_horaria_diaria ?? 8;
  const registrosValidos = registros.filter(r => r.entrada && r.saida);

  let totalMinutosTrabalhados = 0;
  let totalMinutosExtra = 0;
  let diasComExtra = 0;
  let diasAbuso = 0;

  registrosValidos.forEach(r => {
    const duracaoMin = (new Date(r.saida!).getTime() - new Date(r.entrada).getTime()) / 60000;
    const trabalhadoMin = Math.max(0, duracaoMin - (r.intervalo_minutos ?? 0));
    const horasTrabalhadas = trabalhadoMin / 60;
    const extraMin = Math.max(0, trabalhadoMin - carga * 60);
    totalMinutosTrabalhados += trabalhadoMin;
    totalMinutosExtra += extraMin;
    if (extraMin > 0) diasComExtra++;
    if (horasTrabalhadas > 10) diasAbuso++;
  });

  const totalH = Math.floor(totalMinutosTrabalhados / 60);
  const totalMin = Math.round(totalMinutosTrabalhados % 60);
  const extraH = Math.floor(totalMinutosExtra / 60);
  const extraMin2 = Math.round(totalMinutosExtra % 60);

  const valorHoraNormal = (perfil?.salario_base ?? 0) / 220;
  const valorHoraExtra = valorHoraNormal * (1 + (perfil?.hora_extra_percentual ?? 50) / 100);
  const valorAReceber = (totalMinutosExtra / 60) * valorHoraExtra;

  // Summary cards
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(26, 26, 46);
  doc.text('Resumo do Periodo', margem, y);
  y += 6;

  const cards = [
    { label: 'Total Trabalhado', valor: `${totalH}h ${totalMin}min`, cor: [39, 174, 96] as const },
    { label: 'Horas Extras', valor: totalMinutosExtra > 0 ? `+${extraH}h ${extraMin2}min` : '--', cor: [231, 76, 60] as const },
    { label: 'O Patrao Te Deve', valor: valorAReceber.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), cor: [26, 26, 46] as const },
    { label: 'Dias Registrados', valor: `${registrosValidos.length}`, cor: [52, 152, 219] as const },
  ];

  const cardLargura = (largura - margem * 2 - 9) / 4;
  cards.forEach((card, i) => {
    const x = margem + i * (cardLargura + 3);
    doc.setFillColor(248, 249, 255);
    doc.setDrawColor(220, 220, 230);
    doc.roundedRect(x, y, cardLargura, 20, 2, 2, 'FD');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 140);
    doc.text(card.label, x + cardLargura / 2, y + 6, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(card.cor[0], card.cor[1], card.cor[2]);
    doc.text(card.valor, x + cardLargura / 2, y + 14, { align: 'center' });
  });
  y += 26;

  // Table
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(26, 26, 46);
  doc.text('Registros Detalhados', margem, y);
  y += 5;

  const colunas = ['Data', 'Dia', 'Entrada', 'Saida', 'Intervalo', 'Trabalhado', 'Extra'];
  const larguras = [22, 14, 22, 22, 22, 26, 22];

  // Table header
  doc.setFillColor(26, 26, 46);
  doc.rect(margem, y, largura - margem * 2, 8, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  let xAtual = margem;
  colunas.forEach((col, i) => {
    doc.text(col, xAtual + larguras[i] / 2, y + 5.5, { align: 'center' });
    xAtual += larguras[i];
  });
  y += 8;

  // Table rows
  registrosValidos.forEach((r, idx) => {
    if (y > 260) { doc.addPage(); y = 20; }

    const entrada = new Date(r.entrada);
    const saida = new Date(r.saida!);
    const duracaoMin = (saida.getTime() - entrada.getTime()) / 60000;
    const trabalhadoMin = Math.max(0, duracaoMin - (r.intervalo_minutos ?? 0));
    const horasTrab = trabalhadoMin / 60;
    const extraMin = Math.max(0, trabalhadoMin - carga * 60);

    const hT = Math.floor(horasTrab);
    const mT = Math.round((horasTrab - hT) * 60);
    const hE = Math.floor(extraMin / 60);
    const mE = Math.round(extraMin % 60);

    if (horasTrab > 10) {
      doc.setFillColor(255, 235, 238);
    } else if (extraMin > 0) {
      doc.setFillColor(255, 253, 231);
    } else if (idx % 2 === 0) {
      doc.setFillColor(248, 249, 255);
    } else {
      doc.setFillColor(255, 255, 255);
    }
    doc.rect(margem, y, largura - margem * 2, 7, 'F');
    doc.setDrawColor(230, 230, 240);
    doc.line(margem, y + 7, largura - margem, y + 7);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');

    xAtual = margem;
    const valores = [
      entrada.toLocaleDateString('pt-BR'),
      diasSemana[entrada.getDay()],
      entrada.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      saida.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      `${r.intervalo_minutos ?? 0}min`,
      `${hT}h ${mT}min`,
      extraMin > 0 ? `+${hE}h ${mE}min` : '--'
    ];

    valores.forEach((val, i) => {
      if (i === 6 && extraMin > 0) doc.setTextColor(231, 76, 60);
      else if (i === 5 && horasTrab > 10) doc.setTextColor(231, 76, 60);
      else doc.setTextColor(26, 26, 46);
      doc.text(val, xAtual + larguras[i] / 2, y + 4.8, { align: 'center' });
      xAtual += larguras[i];
    });
    y += 7;
  });

  // Footer on all pages
  const totalPaginas = doc.getNumberOfPages();
  for (let p = 1; p <= totalPaginas; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Hora Justa — Protegendo o trabalhador brasileiro | Pagina ${p} de ${totalPaginas}`,
      largura / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' }
    );
  }

  doc.save(`relatorio-hora-justa-${new Date().toISOString().slice(0, 7)}.pdf`);
}

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
      .order('entrada', { ascending: true })
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

  const handleGeneratePDF = () => {
    setGenerating(true);
    try {
      const now = new Date();
      const periodoLabel = `${meses[now.getMonth()]} ${now.getFullYear()}`;
      gerarPDF(registros, profile, periodoLabel);
      toast({ title: 'PDF gerado!', description: 'Arquivo salvo no seu dispositivo.' });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Erro ao gerar PDF', variant: 'destructive' });
    }
    setGenerating(false);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppHeader title="Relatório de Jornada" subtitle="Gerar relatório para análise" />
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
            <><Download size={18} /> Baixar PDF oficial</>
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
