import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import { formatCurrency } from '@/lib/formatters';
import {
  fetchBancoHorasEntries, summarizeBancoHoras, formatMinutosHoras,
  type BancoHorasEntry,
} from '@/lib/banco-horas';
import {
  calcularJornada, formatarHoraLocal,
  formatarDuracaoJornada, getCargaDiaria, hojeLocal,
  type Marcacao,
} from '@/lib/jornada';
import { Button } from '@/components/ui/button';
import {
  FileText, Shield, TrendingUp, Download, Loader2, AlertTriangle,
  Clock, Calendar,
} from 'lucide-react';
import AvisoLegal from '@/components/AvisoLegal';
import ReportOptionsModal, { type ReportOptions } from '@/components/ReportOptionsModal';
import { toast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { usePaywall } from '@/hooks/usePaywall';
import PaywallModal from '@/components/PaywallModal';
import { startOfWeek, endOfWeek } from 'date-fns';

const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

// ── helpers ──

interface DaySummary {
  data: string;
  marcacoes: Marcacao[];
  totalMin: number;
  extraMin: number;
  intervaloMin: number;
  primeiraEntrada: string | null;
  ultimaSaida: string | null;
}

function buildDaySummaries(
  marcacoes: Marcacao[],
  cargaHoras: number,
): DaySummary[] {
  const map = new Map<string, Marcacao[]>();
  marcacoes.forEach(m => {
    if (!map.has(m.data)) map.set(m.data, []);
    map.get(m.data)!.push(m);
  });

  const summaries: DaySummary[] = [];
  map.forEach((marks, data) => {
    const cargaMin = cargaHoras * 60;
    const j = calcularJornada(marks, cargaMin);
    summaries.push({
      data,
      marcacoes: marks,
      totalMin: j.totalTrabalhado,
      extraMin: j.horaExtraMin,
      intervaloMin: j.totalIntervalo,
      primeiraEntrada: j.primeiraEntrada,
      ultimaSaida: j.ultimaSaida,
    });
  });

  return summaries.sort((a, b) => a.data.localeCompare(b.data));
}

const fmtHM = (min: number) => {
  const h = Math.floor(Math.abs(min) / 60);
  const m = Math.round(Math.abs(min) % 60);
  return `${min < 0 ? '-' : ''}${h}h ${m}min`;
};

// ── PDF helpers ──

function addSectionTitle(doc: jsPDF, title: string, y: number, margem: number): number {
  if (y > 260) { doc.addPage(); y = 20; }
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(26, 26, 46);
  doc.text(title, margem, y);
  y += 2;
  doc.setDrawColor(78, 205, 196);
  doc.setLineWidth(0.8);
  doc.line(margem, y, margem + 40, y);
  doc.setLineWidth(0.2);
  return y + 5;
}

function checkPage(doc: jsPDF, y: number, need: number): number {
  if (y + need > 275) { doc.addPage(); return 20; }
  return y;
}

// ── PDF generator ──

function gerarExtratoPDF(
  days: DaySummary[],
  perfil: any,
  periodoLabel: string,
  bancoEntries: BancoHorasEntry[],
  carga: number,
  salario: number,
  percentual: number,
  totalCompensado: number,
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const largura = doc.internal.pageSize.getWidth();
  const margem = 14;
  const contentW = largura - margem * 2;
  let y = 0;

  // Header
  doc.setFillColor(26, 26, 46);
  doc.rect(0, 0, largura, 44, 'F');
  doc.setFillColor(78, 205, 196);
  doc.rect(0, 44, largura, 1.5, 'F');

  doc.setTextColor(78, 205, 196);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('HORA JUSTA', margem, 12);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text('Extrato de Jornada de Trabalho', margem, 22);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 215, 225);
  doc.text(`Funcionario: ${perfil?.nome || 'Trabalhador'}`, margem, 30);
  if (perfil?.empresa) {
    doc.text(`Empresa: ${perfil.empresa}`, margem, 35);
    doc.setFontSize(6.5);
    doc.setTextColor(150, 170, 180);
    doc.text('Empresa informada pelo usuario para fins de organizacao pessoal', margem, 39);
  }
  doc.setFontSize(9);
  doc.setTextColor(200, 215, 225);
  doc.text(`Periodo: ${periodoLabel}`, largura - margem, 30, { align: 'right' });
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, largura - margem, 35, { align: 'right' });

  y = 52;

  // Summary calculations
  const totalMinTrab = days.reduce((s, d) => s + d.totalMin, 0);
  const totalMinExtra = days.reduce((s, d) => s + d.extraMin, 0);
  const bhSummary = summarizeBancoHoras(bancoEntries, salario, percentual);
  const saldoInicial = perfil?.banco_horas_saldo_inicial ?? 0;
  const saldoFinalPDF = saldoInicial + bhSummary.saldo - totalCompensado;

  const valorHN = salario / 220;
  const valorHE = valorHN * (1 + percentual / 100);
  const valorTotal = (totalMinExtra / 60) * valorHE;

  // Summary cards
  y = addSectionTitle(doc, 'Resumo Geral', y, margem);

  const cards = [
    { label: 'Total Trabalhado', valor: fmtHM(totalMinTrab), cor: [39, 174, 96] as const },
    { label: 'Horas Extras', valor: totalMinExtra > 0 ? `+${fmtHM(totalMinExtra)}` : '0h', cor: [78, 205, 196] as const },
    { label: 'Banco de Horas', valor: formatMinutosHoras(saldoFinalPDF), cor: saldoFinalPDF >= 0 ? [39, 174, 96] as const : [231, 76, 60] as const },
    { label: 'Horas Compensadas', valor: fmtHM(bhSummary.aCompensar + totalCompensado), cor: [52, 152, 219] as const },
    { label: 'Horas Vencidas', valor: bhSummary.expirado > 0 ? fmtHM(bhSummary.expirado) : '0h', cor: [243, 156, 18] as const },
    { label: 'Estimativa (R$)', valor: valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), cor: [26, 26, 46] as const },
  ];

  const cardW = (contentW - 6) / 3;
  const cardH = 20;
  cards.forEach((c, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = margem + col * (cardW + 3);
    const cy = y + row * (cardH + 3);
    doc.setFillColor(248, 249, 255);
    doc.setDrawColor(220, 220, 230);
    doc.roundedRect(x, cy, cardW, cardH, 2, 2, 'FD');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 140);
    doc.text(c.label, x + cardW / 2, cy + 7, { align: 'center' });
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(c.cor[0], c.cor[1], c.cor[2]);
    doc.text(c.valor, x + cardW / 2, cy + 15, { align: 'center' });
  });
  y += (cardH + 3) * 2 + 4;

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(150, 150, 160);
  doc.text('* Estimativa baseada nos dados informados pelo usuario.', margem, y);
  y += 6;

  // Banco de Horas section
  y = checkPage(doc, y, 40);
  y = addSectionTitle(doc, 'Banco de Horas', y, margem);

  if (bancoEntries.length === 0 && saldoInicial === 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 140);
    doc.text('Nenhum banco de horas registrado no periodo.', margem, y);
    y += 8;
  } else {
    const bhItems = [
      { label: 'Saldo inicial', valor: saldoInicial !== 0 ? formatMinutosHoras(saldoInicial) : '0h' },
      { label: 'Saldo do período', valor: formatMinutosHoras(bhSummary.saldo) },
      { label: 'Saldo total', valor: formatMinutosHoras(saldoFinalPDF) },
      { label: 'Total compensado', valor: fmtHM(bhSummary.aCompensar + totalCompensado) },
      { label: 'Horas vencidas', valor: bhSummary.expirado > 0 ? fmtHM(bhSummary.expirado) : '0h' },
      { label: 'Expirando em 10 dias', valor: bhSummary.expirandoEm10Dias > 0 ? fmtHM(bhSummary.expirandoEm10Dias) : '0h' },
    ];
    bhItems.forEach(item => {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 90);
      doc.text(`${item.label}:`, margem, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(26, 26, 46);
      doc.text(item.valor, margem + 55, y);
      y += 5;
    });
    y += 3;
  }

  // Detailed table using marcacoes_ponto data
  y = checkPage(doc, y, 20);
  y = addSectionTitle(doc, 'Registros Detalhados', y, margem);

  const tableBody = days.map(d => {
    const dateObj = new Date(d.data + 'T12:00:00');
    const hT = Math.floor(d.totalMin / 60);
    const mT = Math.round(d.totalMin % 60);
    const hE = Math.floor(d.extraMin / 60);
    const mE = Math.round(d.extraMin % 60);

    let tipo = 'Normal';
    if (d.extraMin > 0) tipo = 'Hora extra';
    else if (!d.ultimaSaida) tipo = 'Incompleto';

    return [
      dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      diasSemana[dateObj.getDay()],
      d.primeiraEntrada ? formatarHoraLocal(d.primeiraEntrada) : '—',
      d.ultimaSaida ? formatarHoraLocal(d.ultimaSaida) : '—',
      d.intervaloMin > 0 ? `${d.intervaloMin}min` : '—',
      `${hT}h${mT}min`,
      d.extraMin > 0 ? `+${hE}h${mE}m` : '—',
      tipo,
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['Data', 'Dia', 'Entrada', 'Saída', 'Intervalo', 'Trabalhado', 'Extra', 'Tipo']],
    body: tableBody,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak', halign: 'center' },
    headStyles: { fillColor: [26, 26, 46], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
    alternateRowStyles: { fillColor: [248, 249, 255] },
    margin: { left: margem, right: margem },
    didParseCell: (data) => {
      if (data.section === 'body') {
        const extra = tableBody[data.row.index]?.[6];
        const tipo = tableBody[data.row.index]?.[7];
        if (data.column.index === 6 && extra !== '—') {
          data.cell.styles.textColor = [231, 76, 60];
        }
        if (data.column.index === 7) {
          if (tipo === 'Hora extra') data.cell.styles.textColor = [243, 156, 18];
        }
      }
    },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // Events
  y = checkPage(doc, y, 20);
  y = addSectionTitle(doc, 'Eventos do Periodo', y, margem);

  const eventos: { data: string; descricao: string }[] = [];
  bancoEntries.forEach(e => {
    const dl = new Date(e.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    if (e.tipo === 'compensacao') eventos.push({ data: dl, descricao: `Folga (compensacao banco de horas)${e.nota ? ' — ' + e.nota : ''}` });
    if (e.tipo === 'acumulo') eventos.push({ data: dl, descricao: `Acumulo banco de horas: ${formatMinutosHoras(e.minutos)}` });
  });

  if (eventos.length === 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 140);
    doc.text('Nenhum evento relevante no periodo.', margem, y);
    y += 6;
  } else {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    eventos.forEach(ev => {
      y = checkPage(doc, y, 5);
      doc.setTextColor(78, 205, 196);
      doc.text(ev.data, margem, y);
      doc.setTextColor(60, 60, 70);
      doc.text(` — ${ev.descricao}`, margem + 14, y);
      y += 4.5;
    });
  }
  y += 3;

  // Summary
  y = checkPage(doc, y, 25);
  y = addSectionTitle(doc, 'Resumo Final', y, margem);

  const mediaPorDia = days.length > 0 ? totalMinTrab / days.length : 0;
  const resumoFinal = [
    { label: 'Total de dias trabalhados', valor: `${days.length}` },
    { label: 'Media de horas por dia', valor: fmtHM(mediaPorDia) },
    { label: 'Saldo banco de horas', valor: formatMinutosHoras(saldoFinalPDF) },
  ];

  doc.setFontSize(9);
  resumoFinal.forEach(item => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 90);
    doc.text(`${item.label}:`, margem, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 26, 46);
    doc.text(item.valor, margem + 60, y);
    y += 5;
  });
  y += 4;

  // Legal footer
  y = checkPage(doc, y, 30);
  doc.setFillColor(255, 248, 225);
  doc.setDrawColor(243, 156, 18);
  const avisoTexto =
    'Este documento foi gerado com base em informacoes fornecidas pelo usuario no aplicativo Hora Justa. ' +
    'O nome da empresa e demais dados sao informados pelo proprio usuario para fins de controle pessoal. ' +
    'Os dados apresentados possuem carater estimativo e informativo, nao sendo considerados documentos oficiais ou prova legal absoluta. ' +
    'Recomenda-se a validacao das informacoes com um profissional qualificado antes de qualquer utilizacao legal.';
  const avisoLines = doc.splitTextToSize(avisoTexto, contentW - 6);
  const avisoH = avisoLines.length * 3.5 + 10;
  doc.roundedRect(margem, y, contentW, avisoH, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 60, 0);
  doc.text('AVISO LEGAL:', margem + 3, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(avisoLines, margem + 3, y + 10);

  // Page footers
  const totalPaginas = doc.getNumberOfPages();
  for (let p = 1; p <= totalPaginas; p++) {
    doc.setPage(p);
    const pH = doc.internal.pageSize.getHeight();
    doc.setDrawColor(220, 220, 230);
    doc.setLineWidth(0.3);
    doc.line(margem, pH - 12, largura - margem, pH - 12);
    doc.setFontSize(7);
    doc.setTextColor(170, 170, 180);
    doc.setFont('helvetica', 'normal');
    doc.text('Hora Justa · Controle de Jornada Inteligente', margem, pH - 6);
    doc.text(`Pagina ${p} de ${totalPaginas}`, largura - margem, pH - 6, { align: 'right' });
  }

  doc.save(`extrato-jornada-${new Date().toISOString().slice(0, 7)}.pdf`);
}

// ── Irregularidade type ──

interface Irregularidade {
  tipo: string;
  mensagem: string;
  rota: string;
}

// ── PAGE COMPONENT ──

const RelatorioPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [allMarcacoes, setAllMarcacoes] = useState<Marcacao[]>([]);
  const [bancoEntries, setBancoEntries] = useState<BancoHorasEntry[]>([]);
  const [totalCompensado, setTotalCompensado] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const { canExportPdf } = usePaywall();
  const [showPaywall, setShowPaywall] = useState(false);

  const p = profile as any;
  const carga = getCargaDiaria(
    (p?.tipo_jornada || 'jornada_fixa') as any,
    p?.escala_tipo || null,
    p?.carga_horaria_diaria ?? 8,
  );
  const salario = profile?.salario_base ?? 0;
  const percentual = profile?.hora_extra_percentual ?? 50;

  const fetchData = async (startDate?: string, endDate?: string) => {
    if (!user) return;
    let query = supabase
      .from('marcacoes_ponto')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('horario', { ascending: true });

    if (startDate) query = query.gte('data', startDate);
    if (endDate) query = query.lte('data', endDate);

    const { data } = await query;
    setAllMarcacoes((data as Marcacao[]) || []);

    await fetchBancoHorasEntries(user.id).then(setBancoEntries);

    const { data: compData } = await supabase
      .from('compensacoes_banco_horas')
      .select('minutos')
      .eq('user_id', user.id);
    const total = (compData as any[] || []).reduce((acc: number, c: any) => acc + c.minutos, 0);
    setTotalCompensado(total);
  };

  useEffect(() => {
    if (!user) return;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const end = now.toISOString().split('T')[0];
    fetchData(start, end);
  }, [user]);

  const days = useMemo(
    () => buildDaySummaries(allMarcacoes, carga),
    [allMarcacoes, carga],
  );

  const totalHoras = days.reduce((s, d) => s + d.totalMin / 60, 0);
  const totalExtra = days.reduce((s, d) => s + d.extraMin / 60, 0);
  const valorHE = salario > 0 ? (salario / 220) * (1 + percentual / 100) : 0;
  const valorTotal = totalExtra * valorHE;
  const bhSummary = summarizeBancoHoras(bancoEntries, salario, percentual);
  const saldoInicial = p?.banco_horas_saldo_inicial ?? 0;
  const saldoFinal = saldoInicial + bhSummary.saldo - totalCompensado;

  const listaIrregularidades: Irregularidade[] = useMemo(() => {
    const lista: Irregularidade[] = [];
    if (!profile?.salario_base || profile.salario_base === 0) {
      lista.push({ tipo: 'config', mensagem: 'Salário base não configurado.', rota: '/configuracoes' });
    }
    if (!profile?.carga_horaria_diaria) {
      lista.push({ tipo: 'config', mensagem: 'Carga horária não configurada.', rota: '/configuracoes' });
    }
    days.forEach(d => {
      const dl = new Date(d.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      if (d.totalMin > 600) lista.push({ tipo: 'jornada', mensagem: `Jornada >10h em ${dl}`, rota: '/historico' });
      if (d.intervaloMin < 60 && d.totalMin > 360) lista.push({ tipo: 'intervalo', mensagem: `Intervalo <1h em ${dl}`, rota: '/historico' });
    });
    const incompletos = days.filter(d => !d.ultimaSaida && d.marcacoes.length > 0);
    if (incompletos.length > 0) lista.push({ tipo: 'sem_saida', mensagem: `${incompletos.length} dia(s) sem saída registrada.`, rota: '/historico' });
    return lista;
  }, [days, profile]);

  const getDateRange = (options: ReportOptions): { start: string; end: string; label: string } => {
    const now = new Date();
    const fmt = (d: Date) => d.toISOString().split('T')[0];

    switch (options.periodo) {
      case 'hoje':
        return { start: fmt(now), end: fmt(now), label: `Hoje — ${now.toLocaleDateString('pt-BR')}` };
      case 'semana': {
        const s = startOfWeek(now, { weekStartsOn: 1 });
        const e = endOfWeek(now, { weekStartsOn: 1 });
        return { start: fmt(s), end: fmt(e), label: `Semana ${s.toLocaleDateString('pt-BR')} a ${e.toLocaleDateString('pt-BR')}` };
      }
      case 'mes': {
        const s = new Date(now.getFullYear(), now.getMonth(), 1);
        return { start: fmt(s), end: fmt(now), label: `${meses[now.getMonth()]} ${now.getFullYear()}` };
      }
      case 'personalizado': {
        const s = options.dataInicio!;
        const e = options.dataFim!;
        return { start: fmt(s), end: fmt(e), label: `${s.toLocaleDateString('pt-BR')} a ${e.toLocaleDateString('pt-BR')}` };
      }
      case 'tudo':
        return { start: '2000-01-01', end: fmt(now), label: 'Todo o histórico' };
      default:
        return { start: fmt(now), end: fmt(now), label: '' };
    }
  };

  const handleOpenOptions = () => {
    if (!canExportPdf) {
      setShowPaywall(true);
      return;
    }
    setShowOptionsModal(true);
  };

  const handleGeneratePDF = async (options: ReportOptions) => {
    setGenerating(true);
    try {
      const { start, end, label } = getDateRange(options);

      // Re-fetch data for the selected period
      let query = supabase
        .from('marcacoes_ponto')
        .select('*')
        .eq('user_id', user!.id)
        .is('deleted_at', null)
        .order('horario', { ascending: true });

      if (start !== '2000-01-01') query = query.gte('data', start);
      query = query.lte('data', end);

      const { data } = await query;
      const marcacoes = (data as Marcacao[]) || [];
      const periodDays = buildDaySummaries(marcacoes, carga);

      if (periodDays.length === 0) {
        toast({ title: 'Sem dados', description: 'Nenhum registro encontrado no período selecionado.', variant: 'destructive' });
        setGenerating(false);
        return;
      }

      const bhEntries = options.incluirBancoHoras ? bancoEntries : [];

      gerarExtratoPDF(
        periodDays, profile, label, bhEntries, carga, salario, percentual, totalCompensado,
        { tipo: options.tipo, incluirEventos: options.incluirEventos },
      );
      toast({ title: 'PDF gerado!', description: 'Extrato salvo no seu dispositivo.' });
      setShowOptionsModal(false);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Erro ao gerar PDF', variant: 'destructive' });
    }
    setGenerating(false);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppHeader title="Extrato de Jornada" subtitle="Relatório completo da sua jornada" />
      <div className="px-4 -mt-3 max-w-lg mx-auto space-y-4">
        {/* Preview Card */}
        <div className="bg-primary text-primary-foreground rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <FileText size={18} />
            <span className="font-semibold text-sm">Resumo do mês</span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="opacity-60 text-xs">Trabalhado</p>
              <p className="font-bold">{formatarDuracaoJornada(Math.round(totalHoras * 60))}</p>
            </div>
            <div>
              <p className="opacity-60 text-xs">Horas extras</p>
              <p className="font-bold text-accent">{formatarDuracaoJornada(Math.round(totalExtra * 60))}</p>
            </div>
            <div>
              <p className="opacity-60 text-xs">Estimativa</p>
              <p className="font-bold text-accent">{formatCurrency(valorTotal)}</p>
            </div>
            <div>
              <p className="opacity-60 text-xs">Banco horas</p>
              <p className="font-bold">{formatMinutosHoras(saldoFinal)}</p>
            </div>
            <div>
              <p className="opacity-60 text-xs">Compensado</p>
              <p className="font-bold">{formatMinutosHoras(bhSummary.aCompensar + totalCompensado)}</p>
            </div>
            <div>
              <p className="opacity-60 text-xs">Dias</p>
              <p className="font-bold">{days.length}</p>
            </div>
          </div>
          {listaIrregularidades.length > 0 && (
            <div className="mt-2 space-y-1.5">
              <p className="text-xs text-warning font-semibold">
                ⚠ {listaIrregularidades.length} irregularidade{listaIrregularidades.length > 1 ? 's' : ''}
              </p>
              {listaIrregularidades.slice(0, 4).map((irr, i) => (
                <button
                  key={`${irr.tipo}-${i}`}
                  onClick={() => navigate(irr.rota)}
                  className="w-full text-left flex items-start gap-2 bg-warning/10 rounded-lg px-3 py-2 hover:bg-warning/20 transition-colors"
                >
                  <AlertTriangle size={13} className="text-warning shrink-0 mt-0.5" />
                  <span className="text-[11px] text-warning underline">{irr.mensagem}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* What's included */}
        <div className="bg-card rounded-2xl border border-border p-5">
          <p className="font-bold mb-3 text-sm">O extrato completo inclui:</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2"><Clock size={14} className="text-accent shrink-0" />Resumo geral com totais e estimativas</li>
            <li className="flex items-center gap-2"><TrendingUp size={14} className="text-accent shrink-0" />Seção completa de banco de horas</li>
            <li className="flex items-center gap-2"><Calendar size={14} className="text-accent shrink-0" />Tabela detalhada por dia com marcações</li>
            <li className="flex items-center gap-2"><FileText size={14} className="text-accent shrink-0" />Eventos e compensações do período</li>
            <li className="flex items-center gap-2"><Shield size={14} className="text-accent shrink-0" />Resumo final e aviso legal completo</li>
          </ul>
        </div>

        {/* Generate Button */}
        <Button
          onClick={handleGeneratePDF}
          disabled={generating || days.length === 0}
          className="w-full bg-accent hover:bg-accent/90 text-accent-foreground rounded-xl h-12 font-semibold gap-2"
        >
          {generating ? (
            <><Loader2 size={18} className="animate-spin" /> Gerando...</>
          ) : (
            <><Download size={18} /> Baixar Extrato PDF</>
          )}
        </Button>
        {days.length === 0 && (
          <p className="text-xs text-muted-foreground text-center">Nenhum registro neste mês.</p>
        )}
        <AvisoLegal />
      </div>
      <PaywallModal open={showPaywall} onOpenChange={setShowPaywall} estimatedValue={valorTotal} trigger="pdf" />
      <BottomNav />
    </div>
  );
};

export default RelatorioPage;
