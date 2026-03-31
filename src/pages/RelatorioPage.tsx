import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import { formatCurrency, calcHorasTrabalhadas, calcHoraExtra, calcValorHoraExtra } from '@/lib/formatters';
import { fetchBancoHorasEntries, summarizeBancoHoras, formatMinutosHoras, type BancoHorasEntry } from '@/lib/banco-horas';
import { Button } from '@/components/ui/button';
import { FileText, Shield, TrendingUp, Download, Loader2, AlertTriangle, Clock, Calendar } from 'lucide-react';
import AvisoLegal from '@/components/AvisoLegal';
import { toast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Tables } from '@/integrations/supabase/types';
import { usePaywall } from '@/hooks/usePaywall';
import PaywallModal from '@/components/PaywallModal';

type Registro = Tables<'registros_ponto'>;
type Alerta = Tables<'alertas'>;

const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

// ── PDF HELPERS ──

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

// ── MAIN PDF GENERATOR ──

function gerarExtratoPDF(
  registros: Registro[],
  perfil: any,
  periodoLabel: string,
  bancoEntries: BancoHorasEntry[],
  alertas: Alerta[],
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const largura = doc.internal.pageSize.getWidth();
  const margem = 14;
  const contentW = largura - margem * 2;
  let y = 0;

  // ════════════════════════════════════════
  // 1. CABEÇALHO PROFISSIONAL
  // ════════════════════════════════════════
  doc.setFillColor(26, 26, 46);
  doc.rect(0, 0, largura, 44, 'F');
  // accent line
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
  const nomeFunc = perfil?.nome || 'Trabalhador';
  const empresaStr = (perfil as any)?.empresa;
  doc.text(`Funcionario: ${nomeFunc}`, margem, 30);
  if (empresaStr) {
    doc.text(`Empresa: ${empresaStr}`, margem, 35);
    doc.setFontSize(6.5);
    doc.setTextColor(150, 170, 180);
    doc.text('Empresa informada pelo usuario para fins de organizacao pessoal', margem, 39);
  }
  doc.setFontSize(9);
  doc.setTextColor(200, 215, 225);
  doc.text(`Periodo: ${periodoLabel}`, largura - margem, 30, { align: 'right' });
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, largura - margem, 35, { align: 'right' });

  y = 52;

  // ════════════════════════════════════════
  // 2. RESUMO GERAL
  // ════════════════════════════════════════
  const carga = perfil?.carga_horaria_diaria ?? 8;
  const salario = perfil?.salario_base ?? 0;
  const percentual = perfil?.hora_extra_percentual ?? 50;
  const regValidos = registros.filter(r => r.entrada && r.saida);

  let totalMinTrab = 0;
  let totalMinExtra = 0;

  regValidos.forEach(r => {
    const dur = (new Date(r.saida!).getTime() - new Date(r.entrada).getTime()) / 60000;
    const trab = Math.max(0, dur - (r.intervalo_minutos ?? 0));
    const extra = Math.max(0, trab - carga * 60);
    totalMinTrab += trab;
    totalMinExtra += extra;
  });

  const bhSummary = summarizeBancoHoras(bancoEntries, salario, percentual);

  const valorHN = salario / 220;
  const valorHE = valorHN * (1 + percentual / 100);
  const valorTotal = (totalMinExtra / 60) * valorHE;

  const fmtHM = (min: number) => {
    const h = Math.floor(Math.abs(min) / 60);
    const m = Math.round(Math.abs(min) % 60);
    return `${min < 0 ? '-' : ''}${h}h ${m}min`;
  };

  y = addSectionTitle(doc, 'Resumo Geral', y, margem);

  const cards = [
    { label: 'Total Trabalhado', valor: fmtHM(totalMinTrab), cor: [39, 174, 96] as const },
    { label: 'Horas Extras', valor: totalMinExtra > 0 ? `+${fmtHM(totalMinExtra)}` : '0h', cor: [78, 205, 196] as const },
    { label: 'Banco de Horas', valor: formatMinutosHoras(bhSummary.saldo), cor: bhSummary.saldo >= 0 ? [39, 174, 96] as const : [231, 76, 60] as const },
    { label: 'Horas Compensadas', valor: fmtHM(bhSummary.aCompensar), cor: [52, 152, 219] as const },
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

  // Estimativa disclaimer
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(150, 150, 160);
  doc.text('* Estimativa baseada nos dados informados pelo usuario.', margem, y);
  y += 6;

  // ════════════════════════════════════════
  // 3. SEÇÃO BANCO DE HORAS
  // ════════════════════════════════════════
  y = checkPage(doc, y, 40);
  y = addSectionTitle(doc, 'Banco de Horas', y, margem);

  if (bancoEntries.length === 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 140);
    doc.text('Nenhum banco de horas registrado no periodo.', margem, y);
    y += 8;
  } else {
    const bhItems = [
      { label: 'Saldo atual', valor: formatMinutosHoras(bhSummary.saldo) },
      { label: 'Total acumulado', valor: fmtHM(bancoEntries.filter(e => e.tipo === 'acumulo').reduce((s, e) => s + e.minutos, 0)) },
      { label: 'Total compensado', valor: fmtHM(bhSummary.aCompensar) },
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

  // ════════════════════════════════════════
  // 4. REGISTRO COMPLETO (TABELA)
  // ════════════════════════════════════════
  y = checkPage(doc, y, 20);
  y = addSectionTitle(doc, 'Registros Detalhados', y, margem);

  // Build table data for autoTable
  const tableBody = registros.map(r => {
    const entrada = new Date(r.entrada);
    const saida = r.saida ? new Date(r.saida) : null;
    const durMin = saida ? (saida.getTime() - entrada.getTime()) / 60000 : 0;
    const trabMin = Math.max(0, durMin - (r.intervalo_minutos ?? 0));
    const extraMin = Math.max(0, trabMin - carga * 60);
    const hT = Math.floor(trabMin / 60);
    const mT = Math.round(trabMin % 60);
    const hE = Math.floor(extraMin / 60);
    const mE = Math.round(extraMin % 60);

    let tipo = 'Normal';
    if (r.anexo_url) tipo = 'Atestado';
    else if (extraMin > 0) tipo = 'Hora extra';
    else if (!saida) tipo = 'Incompleto';

    return [
      entrada.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      diasSemana[entrada.getDay()],
      entrada.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      saida ? saida.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—',
      `${r.intervalo_minutos ?? 0}min`,
      saida ? `${hT}h${mT}min` : '—',
      extraMin > 0 ? `+${hE}h${mE}m` : '—',
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
        const tipo = tableBody[data.row.index]?.[7];
        const extra = tableBody[data.row.index]?.[6];
        if (data.column.index === 6 && extra !== '—') {
          data.cell.styles.textColor = [231, 76, 60];
        }
        if (data.column.index === 7) {
          if (tipo === 'Hora extra') data.cell.styles.textColor = [243, 156, 18];
          else if (tipo === 'Atestado') data.cell.styles.textColor = [52, 152, 219];
        }
      }
    },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // ════════════════════════════════════════
  // 5. EVENTOS IMPORTANTES
  // ════════════════════════════════════════
  y = checkPage(doc, y, 20);
  y = addSectionTitle(doc, 'Eventos do Periodo', y, margem);

  const eventos: { data: string; descricao: string }[] = [];
  registros.forEach(r => {
    const dl = new Date(r.entrada).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    if (r.anexo_url) eventos.push({ data: dl, descricao: 'Atestado anexado' });
    if (r.editado_manualmente) eventos.push({ data: dl, descricao: 'Registro editado manualmente' });
  });
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

  // ════════════════════════════════════════
  // 6. ANEXOS
  // ════════════════════════════════════════
  y = checkPage(doc, y, 15);
  y = addSectionTitle(doc, 'Anexos', y, margem);

  const comAnexo = registros.filter(r => r.anexo_url);
  if (comAnexo.length === 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 140);
    doc.text('Sem anexos no periodo.', margem, y);
    y += 6;
  } else {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    comAnexo.forEach(r => {
      y = checkPage(doc, y, 5);
      const dl = new Date(r.entrada).toLocaleDateString('pt-BR');
      doc.setTextColor(26, 26, 46);
      doc.text(`${dl} — Atestado/documento anexado`, margem, y);
      y += 4.5;
    });
  }
  y += 3;

  // ════════════════════════════════════════
  // 7. ALERTAS
  // ════════════════════════════════════════
  const alertasPeriodo = alertas.filter(a => {
    const reg = registros.find(r => r.id === a.registro_id);
    return !!reg;
  });

  // Auto-generate alerts
  const autoAlertas: string[] = [];
  if (bhSummary.expirado > 0) autoAlertas.push('Voce possui horas de banco vencidas.');
  if (bhSummary.expirandoEm10Dias > 0) autoAlertas.push('Horas proximas de vencer no banco de horas.');
  if (bhSummary.saldo > 480) autoAlertas.push('Saldo de banco de horas elevado.');

  const hasAlertas = alertasPeriodo.length > 0 || autoAlertas.length > 0;

  if (hasAlertas) {
    y = checkPage(doc, y, 20);
    y = addSectionTitle(doc, 'Alertas', y, margem);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');

    autoAlertas.forEach(msg => {
      y = checkPage(doc, y, 5);
      doc.setTextColor(243, 156, 18);
      doc.text(`⚠ ${msg}`, margem, y);
      y += 4.5;
    });
    alertasPeriodo.forEach(a => {
      y = checkPage(doc, y, 5);
      doc.setTextColor(231, 76, 60);
      doc.text(`• ${a.mensagem}`, margem, y);
      y += 4.5;
    });
    y += 3;
  }

  // ════════════════════════════════════════
  // 8. RESUMO FINAL
  // ════════════════════════════════════════
  y = checkPage(doc, y, 25);
  y = addSectionTitle(doc, 'Resumo Final', y, margem);

  const mediaPorDia = regValidos.length > 0 ? totalMinTrab / regValidos.length : 0;

  const resumoFinal = [
    { label: 'Total de dias trabalhados', valor: `${regValidos.length}` },
    { label: 'Total de registros', valor: `${registros.length}` },
    { label: 'Media de horas por dia', valor: fmtHM(mediaPorDia) },
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

  // ════════════════════════════════════════
  // 9. RODAPÉ LEGAL
  // ════════════════════════════════════════
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

  // ════════════════════════════════════════
  // 10. FOOTER (all pages)
  // ════════════════════════════════════════
  const totalPaginas = doc.getNumberOfPages();
  for (let p = 1; p <= totalPaginas; p++) {
    doc.setPage(p);
    const pH = doc.internal.pageSize.getHeight();
    // separator line
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

// ── PAGE COMPONENT ──

interface Irregularidade {
  tipo: string;
  mensagem: string;
  rota: string;
}

const RelatorioPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [bancoEntries, setBancoEntries] = useState<BancoHorasEntry[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [generating, setGenerating] = useState(false);
  const { canExportPdf } = usePaywall();
  const [showPaywall, setShowPaywall] = useState(false);

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

    fetchBancoHorasEntries(user.id).then(setBancoEntries);

    supabase
      .from('alertas')
      .select('*')
      .eq('user_id', user.id)
      .then(({ data }) => setAlertas(data || []));
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
  const bhSummary = summarizeBancoHoras(bancoEntries, salario, percentual);

  const listaIrregularidades: Irregularidade[] = useMemo(() => {
    const lista: Irregularidade[] = [];
    if (!profile?.salario_base || profile.salario_base === 0) {
      lista.push({ tipo: 'config', mensagem: 'Salário base não configurado.', rota: '/configuracoes' });
    }
    if (!profile?.carga_horaria_diaria) {
      lista.push({ tipo: 'config', mensagem: 'Carga horária não configurada.', rota: '/configuracoes' });
    }
    registros.forEach((r) => {
      if (!r.saida) return;
      const ht = calcHorasTrabalhadas(r.entrada, r.saida, r.intervalo_minutos ?? 60);
      const dl = new Date(r.entrada).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      if (ht > 10) lista.push({ tipo: 'jornada', mensagem: `Jornada >10h em ${dl}`, rota: '/historico' });
      if ((r.intervalo_minutos ?? 60) < 60 && ht > 6) lista.push({ tipo: 'intervalo', mensagem: `Intervalo <1h em ${dl}`, rota: '/historico' });
    });
    const semSaida = registros.filter(r => !r.saida);
    if (semSaida.length > 0) lista.push({ tipo: 'sem_saida', mensagem: `${semSaida.length} registro(s) sem saída.`, rota: '/historico' });
    return lista;
  }, [registros, profile]);

  const handleGeneratePDF = () => {
    if (!canExportPdf) {
      setShowPaywall(true);
      return;
    }
    setGenerating(true);
    try {
      const now = new Date();
      const periodoLabel = `${meses[now.getMonth()]} ${now.getFullYear()}`;
      gerarExtratoPDF(registros, profile, periodoLabel, bancoEntries, alertas);
      toast({ title: 'PDF gerado!', description: 'Extrato salvo no seu dispositivo.' });
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
              <p className="font-bold">{totalHoras.toFixed(1)}h</p>
            </div>
            <div>
              <p className="opacity-60 text-xs">Horas extras</p>
              <p className="font-bold text-accent">{totalExtra.toFixed(1)}h</p>
            </div>
            <div>
              <p className="opacity-60 text-xs">Estimativa</p>
              <p className="font-bold text-accent">{formatCurrency(valorTotal)}</p>
            </div>
            <div>
              <p className="opacity-60 text-xs">Banco horas</p>
              <p className="font-bold">{formatMinutosHoras(bhSummary.saldo)}</p>
            </div>
            <div>
              <p className="opacity-60 text-xs">Compensado</p>
              <p className="font-bold">{formatMinutosHoras(bhSummary.aCompensar)}</p>
            </div>
            <div>
              <p className="opacity-60 text-xs">Registros</p>
              <p className="font-bold">{registros.length}</p>
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
            <li className="flex items-center gap-2"><Calendar size={14} className="text-accent shrink-0" />Tabela detalhada com tipo de registro</li>
            <li className="flex items-center gap-2"><FileText size={14} className="text-accent shrink-0" />Eventos, anexos e alertas do período</li>
            <li className="flex items-center gap-2"><Shield size={14} className="text-accent shrink-0" />Resumo final e aviso legal completo</li>
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
            <><Download size={18} /> Baixar Extrato PDF</>
          )}
        </Button>
        {registros.length === 0 && (
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
