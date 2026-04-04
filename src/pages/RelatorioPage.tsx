import React, { useState, useEffect, useMemo } from 'react';
import { getCicloQuery } from '@/lib/ciclo-folha';
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
import { calcularINSS, calcularIRRF } from '@/lib/descontos';
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
import { startOfWeek, endOfWeek, subMonths } from 'date-fns';
import { getFeriadosDoAno, type Feriado } from '@/lib/feriados';

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
  origem: 'real' | 'reconstituido' | 'manual' | 'atestado' | 'feriado' | 'ferias';
  atestadoPeriodo?: string | null;
  feriadoNome?: string | null;
}

function classifyOrigin(marks: Marcacao[]): 'real' | 'reconstituido' | 'manual' {
  const origens = marks.map(m => (m as any).origem || 'manual');
  if (origens.every(o => o === 'importacao_automatica')) return 'reconstituido';
  if (origens.some(o => o === 'botao')) return 'real';
  return 'manual';
}

function getFeriadosNoPeriodo(startDate: string, endDate: string): Map<string, string> {
  const result = new Map<string, string>();
  const anoInicio = parseInt(startDate.substring(0, 4));
  const anoFim = parseInt(endDate.substring(0, 4));
  for (let ano = anoInicio; ano <= anoFim; ano++) {
    for (const f of getFeriadosDoAno(ano)) {
      if (f.data >= startDate && f.data <= endDate) {
        result.set(f.data, f.nome);
      }
    }
  }
  return result;
}

function buildDaySummaries(
  marcacoes: Marcacao[],
  cargaHoras: number,
  registrosPonto?: any[],
  feriadosMap?: Map<string, string>,
): DaySummary[] {
  const map = new Map<string, Marcacao[]>();
  marcacoes.forEach(m => {
    if (!map.has(m.data)) map.set(m.data, []);
    map.get(m.data)!.push(m);
  });

  // Build atestado map from registros_ponto
  const atestadoMap = new Map<string, string | null>();
  (registrosPonto || []).forEach((r: any) => {
    if (r.atestado_periodo) {
      atestadoMap.set(r.data, r.atestado_periodo);
    }
  });

  const summaries: DaySummary[] = [];
  const processedDates = new Set<string>();

  map.forEach((marks, data) => {
    processedDates.add(data);
    const cargaMin = cargaHoras * 60;
    const j = calcularJornada(marks, cargaMin);
    const atestado = atestadoMap.get(data);
    const feriado = feriadosMap?.get(data);
    summaries.push({
      data,
      marcacoes: marks,
      totalMin: j.totalTrabalhado,
      extraMin: j.horaExtraMin,
      intervaloMin: j.totalIntervalo,
      primeiraEntrada: j.primeiraEntrada,
      ultimaSaida: j.ultimaSaida,
      origem: atestado ? 'atestado' : feriado ? 'feriado' : classifyOrigin(marks),
      atestadoPeriodo: atestado,
      feriadoNome: feriado,
    });
  });

  // Add atestado-only days (no marcações)
  atestadoMap.forEach((periodo, data) => {
    if (!processedDates.has(data)) {
      processedDates.add(data);
      summaries.push({
        data,
        marcacoes: [],
        totalMin: 0,
        extraMin: 0,
        intervaloMin: 0,
        primeiraEntrada: null,
        ultimaSaida: null,
        origem: 'atestado',
        atestadoPeriodo: periodo,
      });
    }
  });

  // Add feriado days that don't have marcações (weekdays only)
  if (feriadosMap) {
    feriadosMap.forEach((nome, data) => {
      if (!processedDates.has(data)) {
        const dateObj = new Date(data + 'T12:00:00');
        const dow = dateObj.getDay();
        // Only add feriados on weekdays (not weekends)
        if (dow >= 1 && dow <= 5) {
          processedDates.add(data);
          summaries.push({
            data,
            marcacoes: [],
            totalMin: 0,
            extraMin: 0,
            intervaloMin: 0,
            primeiraEntrada: null,
            ultimaSaida: null,
            origem: 'feriado',
            feriadoNome: nome,
          });
        }
      }
    });
  }

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

function addWatermark(doc: jsPDF) {
  const totalPages = doc.getNumberOfPages();
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.saveGraphicsState();
    doc.setGState(new (doc as any).GState({ opacity: 0.06 }));
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(120, 120, 120);
    const text = 'EXTRATO PARA CONFERENCIA PESSOAL - SEM VALOR OFICIAL';
    const centerX = largura / 2;
    const centerY = altura / 2;
    (doc as any).text(text, centerX, centerY, { align: 'center', angle: 35 });
    (doc as any).text(text, centerX, centerY + 80, { align: 'center', angle: 35 });
    doc.restoreGraphicsState();
  }
}

const origemLabel: Record<string, string> = {
  real: 'Real',
  reconstituido: 'Reconstituido',
  manual: 'Manual',
  atestado: 'Atestado',
};

const origemColor: Record<string, [number, number, number]> = {
  real: [39, 174, 96],
  reconstituido: [52, 152, 219],
  manual: [243, 156, 18],
  atestado: [155, 89, 182],
};

// ── PDF generator ──

interface PDFOptions {
  tipo?: 'resumido' | 'completo';
  incluirEventos?: boolean;
  incluirReconstituidos?: boolean;
  incluirAtestados?: boolean;
  incluirFinanceiro?: boolean;
  incluirBancoHoras?: boolean;
}

function gerarExtratoPDF(
  days: DaySummary[],
  perfil: any,
  periodoLabel: string,
  bancoEntries: BancoHorasEntry[],
  carga: number,
  salario: number,
  percentual: number,
  totalCompensado: number,
  opcoes?: PDFOptions,
) {
  const isResumido = opcoes?.tipo === 'resumido';
  const incluirEventos = opcoes?.incluirEventos !== false;
  const incluirFinanceiro = opcoes?.incluirFinanceiro !== false;
  const incluirBH = opcoes?.incluirBancoHoras !== false;
  const incluirReconstituidos = opcoes?.incluirReconstituidos !== false;
  const incluirAtestados = opcoes?.incluirAtestados !== false;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const largura = doc.internal.pageSize.getWidth();
  const margem = 14;
  const contentW = largura - margem * 2;
  let y = 0;

  // Separate days by origin
  const daysReais = days.filter(d => d.origem === 'real' || d.origem === 'manual');
  const daysReconstituidos = days.filter(d => d.origem === 'reconstituido');
  const daysAtestado = days.filter(d => d.origem === 'atestado');

  // Only include reconstituídos in totals if option is on
  const daysForCalc = incluirReconstituidos ? days : daysReais.concat(daysAtestado);

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
  doc.text(`Usuario: ${perfil?.nome?.trim() || 'Trabalhador'}`, margem, 30);
  if (perfil?.empresa) {
    doc.text(`Empresa: ${perfil.empresa}`, margem, 35);
  }
  doc.setTextColor(200, 215, 225);
  doc.text(`Periodo: ${periodoLabel}`, largura - margem, 30, { align: 'right' });
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, largura - margem, 35, { align: 'right' });

  y = 52;

  // Summary calculations
  const totalMinTrab = daysForCalc.reduce((s, d) => s + d.totalMin, 0);
  const totalMinExtra = daysForCalc.reduce((s, d) => s + d.extraMin, 0);
  const totalMinReais = daysReais.reduce((s, d) => s + d.totalMin, 0);
  const totalMinReconst = daysReconstituidos.reduce((s, d) => s + d.totalMin, 0);
  const bhSummary = summarizeBancoHoras(bancoEntries, salario, percentual);
  const saldoInicial = perfil?.banco_horas_saldo_inicial ?? 0;
  const saldoFinalPDF = saldoInicial + bhSummary.saldo - totalCompensado;

  const valorHN = salario > 0 ? salario / 220 : 0;
  const valorHE = valorHN * (1 + percentual / 100);
  const valorExtras = (totalMinExtra / 60) * valorHE;

  // Summary cards
  y = addSectionTitle(doc, 'Resumo Geral', y, margem);

  const cards = [
    { label: 'Registros Reais', valor: `${daysReais.length} dias · ${fmtHM(totalMinReais)}`, cor: [39, 174, 96] as const },
    { label: 'Reconstituidos', valor: `${daysReconstituidos.length} dias · ${fmtHM(totalMinReconst)}`, cor: [52, 152, 219] as const },
    { label: 'Total Combinado', valor: `${daysForCalc.length} dias · ${fmtHM(totalMinTrab)}`, cor: [26, 26, 46] as const },
    { label: 'Horas Extras', valor: totalMinExtra > 0 ? `+${fmtHM(totalMinExtra)}` : '0h', cor: [78, 205, 196] as const },
    { label: 'Banco de Horas', valor: formatMinutosHoras(saldoFinalPDF), cor: saldoFinalPDF >= 0 ? [39, 174, 96] as const : [231, 76, 60] as const },
    { label: 'Atestados', valor: `${daysAtestado.length} dias`, cor: [155, 89, 182] as const },
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
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 140);
    doc.text(c.label, x + cardW / 2, cy + 7, { align: 'center' });
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(c.cor[0], c.cor[1], c.cor[2]);
    doc.text(c.valor, x + cardW / 2, cy + 15, { align: 'center' });
  });
  y += (cardH + 3) * 2 + 4;

  // ── DEMONSTRATIVO FINANCEIRO ──
  if (incluirFinanceiro && salario > 0) {
    y = checkPage(doc, y, 65);
    y = addSectionTitle(doc, 'Demonstrativo Financeiro Estimado', y, margem);

    const salarioBruto = salario + valorExtras;
    const inss = calcularINSS(salarioBruto);
    const irrf = calcularIRRF(salarioBruto, inss);
    const descontosFixos = Number(perfil?.descontos_fixos ?? 0);
    const planoSaude = Number(perfil?.plano_saude ?? 0);
    const adiantamentos = Number(perfil?.adiantamentos ?? 0);
    const outrosDesc = Number(perfil?.outros_descontos_detalhados ?? 0);
    const totalDescontosExtra = planoSaude + adiantamentos + outrosDesc + descontosFixos;
    const totalDescontos = inss + irrf + totalDescontosExtra;
    const salarioLiquido = Math.max(0, salarioBruto - totalDescontos);

    const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    interface FinLine { label: string; valor: string; bold: boolean; separator?: boolean; color?: [number, number, number] }
    const linhas: FinLine[] = [
      { label: 'Salario base', valor: fmtBRL(salario), bold: false },
      { label: `Horas extras (${fmtHM(totalMinExtra)} no periodo)`, valor: fmtBRL(valorExtras), bold: false },
      { label: 'SALARIO BRUTO', valor: fmtBRL(salarioBruto), bold: true, separator: true },
      { label: '(-) INSS (tabela progressiva 2025)', valor: `-${fmtBRL(inss)}`, bold: false, color: [231, 76, 60] },
      { label: '(-) IRRF (apos deducao INSS)', valor: `-${fmtBRL(irrf)}`, bold: false, color: [231, 76, 60] },
    ];

    if (totalDescontosExtra > 0) {
      linhas.push({ label: '(-) Outros descontos informados', valor: `-${fmtBRL(totalDescontosExtra)}`, bold: false, color: [231, 76, 60] });
    }

    linhas.push(
      { label: 'TOTAL DE DESCONTOS', valor: `-${fmtBRL(totalDescontos)}`, bold: true, separator: true, color: [231, 76, 60] },
      { label: 'SALARIO LIQUIDO ESTIMADO', valor: fmtBRL(salarioLiquido), bold: true, color: [39, 174, 96] },
    );

    doc.setFillColor(248, 249, 255);
    doc.setDrawColor(220, 220, 230);
    const boxH = linhas.length * 5.5 + 18;
    doc.roundedRect(margem, y, contentW, boxH, 2, 2, 'FD');
    y += 4;

    linhas.forEach((l: any) => {
      if (l.separator) {
        doc.setDrawColor(200, 200, 210);
        doc.line(margem + 3, y - 1, margem + contentW - 3, y - 1);
      }
      doc.setFontSize(8);
      doc.setFont('helvetica', l.bold ? 'bold' : 'normal');
      doc.setTextColor(80, 80, 90);
      doc.text(l.label, margem + 4, y + 3);
      if (l.color) doc.setTextColor(l.color[0], l.color[1], l.color[2]);
      else doc.setTextColor(26, 26, 46);
      doc.setFont('helvetica', 'bold');
      doc.text(l.valor, margem + contentW - 4, y + 3, { align: 'right' });
      y += 5.5;
    });

    y += 4;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 140);
    doc.text(`Valor hora normal: ${fmtBRL(valorHN)}  |  Valor hora extra (${percentual}%): ${fmtBRL(valorHE)}`, margem + 4, y);
    y += 4;
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(150, 150, 160);
    doc.text('* Calculo baseado nas tabelas INSS/IRRF 2025. Confira com o holerite oficial.', margem, y);
    y += 6;
  }

  // ── BANCO DE HORAS ──
  if (incluirBH) {
    y = checkPage(doc, y, 45);
    y = addSectionTitle(doc, 'Banco de Horas', y, margem);

    // Separate auto vs real banco entries
    const horasAutoMin = daysReconstituidos.reduce((s, d) => s + d.extraMin, 0);
    const horasReaisMin = daysReais.reduce((s, d) => s + d.extraMin, 0);

    const saldoInicialData = perfil?.banco_horas_saldo_inicial_data
      ? new Date(perfil.banco_horas_saldo_inicial_data + 'T12:00:00').toLocaleDateString('pt-BR')
      : '';

    const bhItems: { label: string; valor: string; bold?: boolean }[] = [
      { label: `Saldo anterior (informado no cadastro${saldoInicialData ? ' em ' + saldoInicialData : ''})`, valor: saldoInicial !== 0 ? formatMinutosHoras(saldoInicial) : '0h' },
      { label: 'Horas extras geradas (registros reais)', valor: formatMinutosHoras(horasReaisMin) },
      { label: 'Horas extras (reconstituidos)', valor: formatMinutosHoras(horasAutoMin) },
      { label: 'Compensacoes utilizadas', valor: `-${fmtHM(bhSummary.aCompensar + totalCompensado)}` },
      { label: 'Horas vencidas', valor: bhSummary.expirado > 0 ? fmtHM(bhSummary.expirado) : '0h' },
      { label: 'SALDO TOTAL ATUAL', valor: formatMinutosHoras(saldoFinalPDF), bold: true },
    ];

    if (saldoFinalPDF !== 0) {
      const eqDias = Math.floor(Math.abs(saldoFinalPDF) / (carga * 60));
      const eqH = Math.round(Math.abs(saldoFinalPDF) % (carga * 60) / 60);
      bhItems.push({ label: 'Equivalente a', valor: `${eqDias} dias e ${eqH}h` });
    }

    if (saldoInicial !== 0) {
      y += 2;
      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(120, 120, 140);
      doc.text(`Este saldo de ${formatMinutosHoras(saldoInicial)} foi informado por voce como horas acumuladas antes de usar o Hora Justa.`, margem, y + (bhItems.length * 5) + 5);
    }

    bhItems.forEach((item: any) => {
      y = checkPage(doc, y, 6);
      doc.setFontSize(9);
      doc.setFont('helvetica', item.bold ? 'bold' : 'normal');
      doc.setTextColor(80, 80, 90);
      doc.text(`${item.label}:`, margem, y);
      doc.setFont('helvetica', 'bold');
      if (item.bold) {
        doc.setTextColor(saldoFinalPDF >= 0 ? 39 : 231, saldoFinalPDF >= 0 ? 174 : 76, saldoFinalPDF >= 0 ? 96 : 60);
      } else {
        doc.setTextColor(26, 26, 46);
      }
      doc.text(item.valor, margem + 80, y);
      y += 5;
    });
    y += 3;
  }

  // ── REGISTROS DETALHADOS ──
  if (!isResumido) {
    y = checkPage(doc, y, 20);
    y = addSectionTitle(doc, 'Registros Detalhados', y, margem);

    // Filter based on options
    let filteredDays = [...daysReais];
    if (incluirReconstituidos) filteredDays = filteredDays.concat(daysReconstituidos);
    if (incluirAtestados) filteredDays = filteredDays.concat(daysAtestado);
    filteredDays.sort((a, b) => a.data.localeCompare(b.data));

    const tableBody = filteredDays.map(d => {
      const dateObj = new Date(d.data + 'T12:00:00');
      const hT = Math.floor(d.totalMin / 60);
      const mT = Math.round(d.totalMin % 60);
      const hE = Math.floor(d.extraMin / 60);
      const mE = Math.round(d.extraMin % 60);

      return [
        dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        diasSemana[dateObj.getDay()],
        d.primeiraEntrada ? formatarHoraLocal(d.primeiraEntrada) : '—',
        d.ultimaSaida ? formatarHoraLocal(d.ultimaSaida) : '—',
        d.intervaloMin > 0 ? `${d.intervaloMin}min` : '—',
        d.origem === 'atestado' ? 'Atestado' : `${hT}h${mT}min`,
        d.extraMin > 0 ? `+${hE}h${mE}m` : '—',
        origemLabel[d.origem] || 'Manual',
      ];
    });

    if (tableBody.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Data', 'Dia', 'Entrada', 'Saida', 'Interv.', 'Trabalhado', 'Extra', 'Tipo']],
        body: tableBody,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak', halign: 'center' },
        headStyles: { fillColor: [26, 26, 46], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
        alternateRowStyles: { fillColor: [248, 249, 255] },
        margin: { left: margem, right: margem },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 7) {
            const tipo = tableBody[data.row.index]?.[7];
            const cor = origemColor[Object.keys(origemLabel).find(k => origemLabel[k] === tipo) || 'manual'] || [80, 80, 90];
            data.cell.styles.textColor = cor;
            data.cell.styles.fontStyle = 'bold';
          }
          if (data.section === 'body' && data.column.index === 6) {
            const extra = tableBody[data.row.index]?.[6];
            if (extra !== '—') data.cell.styles.textColor = [231, 76, 60];
          }
        },
      });
      y = (doc as any).lastAutoTable.finalY + 4;
    }

    // Legend
    y = checkPage(doc, y, 15);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80, 80, 90);
    doc.text('Legenda:', margem, y);
    y += 3.5;
    const legendItems = [
      { label: 'Real — registrado em tempo real', cor: origemColor.real },
      { label: 'Reconstituido — gerado automaticamente', cor: origemColor.reconstituido },
      { label: 'Manual — inserido manualmente', cor: origemColor.manual },
      { label: 'Atestado — coberto por atestado medico', cor: origemColor.atestado },
    ];
    legendItems.forEach(l => {
      doc.setFillColor(l.cor[0], l.cor[1], l.cor[2]);
      doc.circle(margem + 1.5, y - 1, 1.2, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 90);
      doc.text(l.label, margem + 5, y);
      y += 3.5;
    });
    y += 3;
  }

  // ── REGISTROS RECONSTITUIDOS (seção separada) ──
  if (!isResumido && incluirReconstituidos && daysReconstituidos.length > 0) {
    y = checkPage(doc, y, 30);
    y = addSectionTitle(doc, 'Registros Reconstituidos', y, margem);

    const primeiroReconst = daysReconstituidos[0]?.data;
    const ultimoReconst = daysReconstituidos[daysReconstituidos.length - 1]?.data;
    const fmtData = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 90);
    const reconItems = [
      `Total de dias reconstituidos: ${daysReconstituidos.length} dias`,
      `Periodo: ${fmtData(primeiroReconst)} a ${fmtData(ultimoReconst)}`,
      `Horario declarado: ${(perfil?.horario_entrada_padrao || '08:00').substring(0, 5)} - ${(perfil?.horario_saida_padrao || '17:00').substring(0, 5)} · Intervalo: ${perfil?.intervalo_almoco ?? 60}min`,
    ];
    reconItems.forEach(item => {
      doc.text(item, margem, y);
      y += 4.5;
    });

    y += 2;
    doc.setFillColor(255, 248, 225);
    doc.setDrawColor(243, 156, 18);
    const avisoRecon = 'Estes registros foram gerados automaticamente com base na declaracao do trabalhador no momento do cadastro. Representam a jornada habitual declarada.';
    const avisoLines = doc.splitTextToSize(avisoRecon, contentW - 8);
    const avisoH = avisoLines.length * 3.5 + 8;
    doc.roundedRect(margem, y, contentW, avisoH, 2, 2, 'FD');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 60, 0);
    doc.text(avisoLines, margem + 4, y + 5);
    y += avisoH + 4;
  }

  // ── ATESTADOS ──
  if (!isResumido && incluirAtestados && daysAtestado.length > 0) {
    y = checkPage(doc, y, 25);
    y = addSectionTitle(doc, 'Atestados e Documentos', y, margem);

    const atestBody = daysAtestado.map(d => {
      const dateObj = new Date(d.data + 'T12:00:00');
      return [
        dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        d.atestadoPeriodo === 'manha' ? 'Manha' : d.atestadoPeriodo === 'tarde' ? 'Tarde' : 'Dia inteiro',
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [['Data', 'Periodo coberto']],
      body: atestBody,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2, halign: 'center' },
      headStyles: { fillColor: [155, 89, 182], textColor: [255, 255, 255], fontStyle: 'bold' },
      margin: { left: margem, right: margem },
    });
    y = (doc as any).lastAutoTable.finalY + 3;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 90);
    doc.text(`Total de dias com atestado: ${daysAtestado.length}`, margem, y);
    y += 6;
  }

  // Events
  if (incluirEventos) {
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
  }

  // Resumo Final
  y = checkPage(doc, y, 25);
  y = addSectionTitle(doc, 'Resumo Final', y, margem);

  const mediaPorDia = daysForCalc.length > 0 ? totalMinTrab / daysForCalc.length : 0;
  const resumoFinal = [
    { label: 'Total de dias trabalhados', valor: `${daysForCalc.length}` },
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
  y = checkPage(doc, y, 40);
  doc.setFillColor(255, 248, 225);
  doc.setDrawColor(243, 156, 18);
  const avisoTexto =
    'Este documento e um extrato matematico privado para organizacao pessoal. ' +
    'Nao possui valor de laudo pericial, nao substitui cartoes de ponto oficiais e nao constitui prova legal absoluta. ' +
    'O nome da empresa e demais dados sao informados pelo proprio usuario para fins de controle pessoal. ' +
    'O desenvolvedor isenta-se de responsabilidade por decisoes judiciais ou administrativas tomadas com base nestas estimativas. ' +
    'Para validacao juridica, consulte um advogado ou contador qualificado.';
  const avisoLines = doc.splitTextToSize(avisoTexto, contentW - 6);
  const avisoH = avisoLines.length * 3.5 + 10;
  doc.roundedRect(margem, y, contentW, avisoH, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 60, 0);
  doc.text('AVISO LEGAL — ISENCAO DE RESPONSABILIDADE:', margem + 3, y + 5);
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
    doc.text(`Hora Justa · Extrato pessoal · Pagina ${p} de ${totalPaginas}`, margem, pH - 6);
    doc.text(`Pagina ${p} de ${totalPaginas}`, largura - margem, pH - 6, { align: 'right' });
  }

  addWatermark(doc);

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

  const diaFechamento = (p?.dia_fechamento_folha as number) ?? 0;

  useEffect(() => {
    if (!user) return;
    const { start, end } = getCicloQuery(diaFechamento);
    fetchData(start, end);
  }, [user, diaFechamento]);

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
      case 'mes_anterior': {
        const prev = subMonths(now, 1);
        const s = new Date(prev.getFullYear(), prev.getMonth(), 1);
        const e = new Date(prev.getFullYear(), prev.getMonth() + 1, 0);
        return { start: fmt(s), end: fmt(e), label: `${meses[prev.getMonth()]} ${prev.getFullYear()}` };
      }
      case 'ciclo': {
        const ciclo = getCicloQuery(diaFechamento, now);
        return { start: ciclo.start, end: ciclo.end, label: `Ciclo de Apuracao: ${ciclo.label}` };
      }
      case 'personalizado': {
        const s = options.dataInicio!;
        const e = options.dataFim!;
        return { start: fmt(s), end: fmt(e), label: `${s.toLocaleDateString('pt-BR')} a ${e.toLocaleDateString('pt-BR')}` };
      }
      case 'tudo':
        return { start: '2000-01-01', end: fmt(now), label: 'Todo o historico' };
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
      // Always fetch fresh profile to get updated name
      const { data: freshProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user!.id)
        .single();
      const perfilAtual = freshProfile || profile;

      const { start, end, label } = getDateRange(options);

      // Fetch marcacoes for the period (include all origins)
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

      // Fetch registros_ponto for atestado info
      let regQuery = supabase
        .from('registros_ponto')
        .select('data, atestado_periodo')
        .eq('user_id', user!.id)
        .is('deleted_at', null)
        .not('atestado_periodo', 'is', null);

      if (start !== '2000-01-01') regQuery = regQuery.gte('data', start);
      regQuery = regQuery.lte('data', end);

      const { data: registrosPonto } = await regQuery;

      const periodDays = buildDaySummaries(marcacoes, carga, registrosPonto || []);

      if (periodDays.length === 0) {
        toast({ title: 'Sem dados', description: 'Nenhum registro encontrado no período selecionado.', variant: 'destructive' });
        setGenerating(false);
        return;
      }

      const bhEntries = options.incluirBancoHoras ? bancoEntries : [];

      gerarExtratoPDF(
        periodDays, perfilAtual, label, bhEntries, carga, salario, percentual, totalCompensado,
        {
          tipo: options.tipo,
          incluirEventos: options.incluirEventos,
          incluirReconstituidos: options.incluirReconstituidos,
          incluirAtestados: options.incluirAtestados,
          incluirFinanceiro: options.incluirFinanceiro,
          incluirBancoHoras: options.incluirBancoHoras,
        },
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
      <div className="px-4 mt-2 max-w-lg mx-auto space-y-4">
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
            <li className="flex items-center gap-2"><TrendingUp size={14} className="text-accent shrink-0" />Demonstrativo financeiro com INSS/IRRF</li>
            <li className="flex items-center gap-2"><Calendar size={14} className="text-accent shrink-0" />Tabela detalhada com tipo de registro</li>
            <li className="flex items-center gap-2"><FileText size={14} className="text-accent shrink-0" />Seção de atestados e reconstituídos</li>
            <li className="flex items-center gap-2"><Shield size={14} className="text-accent shrink-0" />Banco de horas detalhado e aviso legal</li>
          </ul>
        </div>

        {/* Generate Button */}
        <Button
          onClick={handleOpenOptions}
          className="w-full bg-accent hover:bg-accent/90 text-accent-foreground rounded-xl h-12 font-semibold gap-2"
        >
          <Download size={18} /> Gerar Relatório PDF
        </Button>
        <AvisoLegal />
      </div>
      <ReportOptionsModal open={showOptionsModal} onOpenChange={setShowOptionsModal} onGenerate={handleGeneratePDF} generating={generating} cicloLabel={diaFechamento > 0 ? getCicloQuery(diaFechamento).label : undefined} />
      <PaywallModal open={showPaywall} onOpenChange={setShowPaywall} estimatedValue={valorTotal} trigger="pdf" />
      <BottomNav />
    </div>
  );
};

export default RelatorioPage;
