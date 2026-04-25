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
  formatarDuracaoJornada, getCargaDiaria, hojeLocal, isDiaTrabalhoEscala,
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
import { analisarRadarTrabalhista, RADAR_ISENCAO_RODAPE, type AlertaRadar } from '@/lib/radar-trabalhista';

const diasSemana = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];

// Map JS getDay() (0=Sun..6=Sat) to our array index (0=Mon..6=Sun)
function getDiaSemanaIdx(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1;
}
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
  origem: 'real' | 'reconstituido' | 'manual' | 'atestado' | 'feriado' | 'ferias' | 'pendente' | 'fds' | 'folga';
  registroOrigem: 'real' | 'reconstituido' | 'manual' | null;
  atestadoPeriodo?: string | null;
  feriadoNome?: string | null;
  /** Necessário para o Radar Trabalhista (mesmo motor da tela /radar) */
  ehDiaTrabalho?: boolean;
}

interface ReportProfileConfig {
  tipo_jornada?: string | null;
  dias_trabalhados_semana?: number | null;
  escala_tipo?: string | null;
  escala_dias_trabalho?: number | null;
  escala_dias_folga?: number | null;
  escala_inicio?: string | null;
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

function isScheduledWorkday(dateStr: string, profile?: ReportProfileConfig): boolean {
  const date = new Date(dateStr + 'T12:00:00');
  const dow = date.getDay();

  if (profile?.tipo_jornada === 'escala' && profile.escala_inicio) {
    return isDiaTrabalhoEscala({
      tipo: profile.escala_tipo || 'personalizada',
      diasTrabalho: Number(profile.escala_dias_trabalho ?? 5),
      diasFolga: Number(profile.escala_dias_folga ?? 2),
      inicio: profile.escala_inicio,
    }, dateStr);
  }

  const diasTrabalhados = Math.min(7, Math.max(1, Number(profile?.dias_trabalhados_semana ?? 5)));
  if (diasTrabalhados === 7) return true;
  if (dow === 0) return false;
  return dow <= diasTrabalhados;
}

function getOffDayLabel(dateStr: string, profile?: ReportProfileConfig): string {
  const dow = new Date(dateStr + 'T12:00:00').getDay();
  if (dow === 0) return 'Domingo';
  if (dow === 6) return 'Sábado';
  if (profile?.tipo_jornada === 'escala') return 'Folga da escala';
  return 'Folga';
}

function buildDaySummaries(
  marcacoes: Marcacao[],
  cargaHoras: number,
  registrosPonto?: any[],
  feriadosMap?: Map<string, string>,
  startDate?: string,
  endDate?: string,
  feriasList?: any[],
  compensacoesList?: any[],
  profileConfig?: ReportProfileConfig,
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

  // Build férias set
  const feriasSet = new Set<string>();
  (feriasList || []).forEach((f: any) => {
    let d = new Date(f.data_inicio + 'T12:00:00');
    const end = new Date(f.data_fim + 'T12:00:00');
    while (d <= end) {
      feriasSet.add(d.toISOString().split('T')[0]);
      d.setDate(d.getDate() + 1);
    }
  });

  // Build compensações set
  const compSet = new Set<string>();
  (compensacoesList || []).forEach((c: any) => {
    compSet.add(c.data);
  });

  const summaries: DaySummary[] = [];

  // If we have start/end dates, iterate ALL days
  if (startDate && endDate) {
    let current = new Date(startDate + 'T12:00:00');
    const endD = new Date(endDate + 'T12:00:00');

    while (current <= endD) {
      const dataStr = current.toISOString().split('T')[0];
      const marks = map.get(dataStr) || [];
      const registroOrigem = marks.length > 0 ? classifyOrigin(marks) : null;
      const atestado = atestadoMap.get(dataStr);
      const feriado = feriadosMap?.get(dataStr);
      const ehFerias = feriasSet.has(dataStr);
      const ehComp = compSet.has(dataStr);
      const dow = current.getDay();
      const ehDiaTrabalho = isScheduledWorkday(dataStr, profileConfig);

      if (atestado) {
        // Atestado day
        const cargaMin = cargaHoras * 60;
        if (marks.length > 0) {
          const j = calcularJornada(marks, cargaMin);
          summaries.push({
            data: dataStr, marcacoes: marks,
            totalMin: j.totalTrabalhado, extraMin: j.horaExtraMin,
            intervaloMin: j.totalIntervalo,
            primeiraEntrada: j.primeiraEntrada, ultimaSaida: j.ultimaSaida,
            origem: 'atestado', registroOrigem, atestadoPeriodo: atestado,
            ehDiaTrabalho,
          });
        } else {
          summaries.push({
            data: dataStr, marcacoes: [],
            totalMin: 0, extraMin: 0, intervaloMin: 0,
            primeiraEntrada: null, ultimaSaida: null,
            origem: 'atestado', registroOrigem: null, atestadoPeriodo: atestado,
            ehDiaTrabalho,
          });
        }
      } else if (feriado) {
        // Feriado
        if (marks.length > 0) {
          const cargaMin = cargaHoras * 60;
          const j = calcularJornada(marks, cargaMin);
          summaries.push({
            data: dataStr, marcacoes: marks,
            totalMin: j.totalTrabalhado, extraMin: j.totalTrabalhado, // all extra on feriado
            intervaloMin: j.totalIntervalo,
            primeiraEntrada: j.primeiraEntrada, ultimaSaida: j.ultimaSaida,
            origem: 'feriado', registroOrigem, feriadoNome: feriado,
            ehDiaTrabalho: true,
          });
        } else {
          summaries.push({
            data: dataStr, marcacoes: [],
            totalMin: 0, extraMin: 0, intervaloMin: 0,
            primeiraEntrada: null, ultimaSaida: null,
            origem: 'feriado', registroOrigem: null, feriadoNome: feriado,
            ehDiaTrabalho,
          });
        }
      } else if (ehFerias) {
        summaries.push({
          data: dataStr, marcacoes: [],
          totalMin: 0, extraMin: 0, intervaloMin: 0,
          primeiraEntrada: null, ultimaSaida: null,
          origem: 'ferias', registroOrigem: null,
          ehDiaTrabalho: false,
        });
      } else if (ehComp) {
        summaries.push({
          data: dataStr, marcacoes: [],
          totalMin: 0, extraMin: 0, intervaloMin: 0,
          primeiraEntrada: null, ultimaSaida: null,
          origem: 'ferias', registroOrigem: null, // reuse ferias label for folga
          feriadoNome: 'Folga compensada',
          ehDiaTrabalho: false,
        });
      } else if (marks.length > 0) {
        const cargaMin = cargaHoras * 60;
        const j = calcularJornada(marks, cargaMin);
        summaries.push({
          data: dataStr, marcacoes: marks,
          totalMin: j.totalTrabalhado, extraMin: !ehDiaTrabalho ? j.totalTrabalhado : j.horaExtraMin,
          intervaloMin: j.totalIntervalo,
          primeiraEntrada: j.primeiraEntrada, ultimaSaida: j.ultimaSaida,
          origem: registroOrigem || 'manual', registroOrigem,
          ehDiaTrabalho,
        });
      } else if (!ehDiaTrabalho) {
        summaries.push({
          data: dataStr, marcacoes: [],
          totalMin: 0, extraMin: 0, intervaloMin: 0,
          primeiraEntrada: null, ultimaSaida: null,
          origem: dow === 0 || dow === 6 ? 'fds' : 'folga', registroOrigem: null,
          feriadoNome: getOffDayLabel(dataStr, profileConfig),
          ehDiaTrabalho: false,
        });
      } else {
        summaries.push({
          data: dataStr, marcacoes: [],
          totalMin: 0, extraMin: 0, intervaloMin: 0,
          primeiraEntrada: null, ultimaSaida: null,
          origem: 'pendente', registroOrigem: null,
          feriadoNome: 'Sem registro',
          ehDiaTrabalho: true,
        });
      }

      current.setDate(current.getDate() + 1);
    }
  } else {
    // Legacy: no date range, just use marcações
    map.forEach((marks, data) => {
      const cargaMin = cargaHoras * 60;
      const j = calcularJornada(marks, cargaMin);
      const atestado = atestadoMap.get(data);
      const feriado = feriadosMap?.get(data);
      const ehDiaTrabalho = isScheduledWorkday(data, profileConfig);
      summaries.push({
        data, marcacoes: marks,
        totalMin: j.totalTrabalhado, extraMin: j.horaExtraMin,
        intervaloMin: j.totalIntervalo,
        primeiraEntrada: j.primeiraEntrada, ultimaSaida: j.ultimaSaida,
        origem: atestado ? 'atestado' : feriado ? 'feriado' : classifyOrigin(marks),
        registroOrigem: classifyOrigin(marks),
        atestadoPeriodo: atestado, feriadoNome: feriado,
        ehDiaTrabalho,
      });
    });

    // Add atestado-only days
    atestadoMap.forEach((periodo, data) => {
      if (!map.has(data)) {
        summaries.push({
          data, marcacoes: [],
          totalMin: 0, extraMin: 0, intervaloMin: 0,
          primeiraEntrada: null, ultimaSaida: null,
          origem: 'atestado', registroOrigem: null, atestadoPeriodo: periodo,
          ehDiaTrabalho: isScheduledWorkday(data, profileConfig),
        });
      }
    });
  }

  return summaries.sort((a, b) => b.data.localeCompare(a.data));
}

const fmtHM = (min: number) => {
  const h = Math.floor(Math.abs(min) / 60);
  const m = Math.round(Math.abs(min) % 60);
  return `${min < 0 ? '-' : ''}${h}h ${m}min`;
};

// ── PDF helpers ──

function addSectionTitle(doc: jsPDF, title: string, y: number, margem: number): number {
  if (y > 250) { doc.addPage(); y = 20; }
  y += 8; // extra space before section
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(26, 26, 46);
  doc.text(title, margem, y);
  y += 3;
  doc.setDrawColor(78, 205, 196);
  doc.setLineWidth(0.8);
  doc.line(margem, y, margem + 40, y);
  doc.setLineWidth(0.2);
  return y + 7;
}

function checkPage(doc: jsPDF, y: number, need: number): number {
  if (y + need > 270) { doc.addPage(); return 20; }
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
  feriado: 'Feriado',
  ferias: 'Ferias',
  pendente: 'Pendente',
  fds: 'FDS',
  folga: 'Folga',
};

const origemColor: Record<string, [number, number, number]> = {
  real: [39, 174, 96],
  reconstituido: [52, 152, 219],
  manual: [243, 156, 18],
  atestado: [155, 89, 182],
  feriado: [231, 76, 60],
  ferias: [52, 152, 219],
  pendente: [243, 156, 18],
  fds: [149, 165, 166],
  folga: [46, 204, 113],
};

// ── PDF generator ──

interface PDFOptions {
  tipo?: 'resumido' | 'completo';
  incluirEventos?: boolean;
  incluirReconstituidos?: boolean;
  incluirAtestados?: boolean;
  incluirFinanceiro?: boolean;
  incluirBancoHoras?: boolean;
  /** Banco de horas completo para o Radar (mesmo se a seção BH estiver oculta no PDF) */
  bancoEntriesParaRadar?: BancoHorasEntry[];
}

type RadarNivel = 'perigo' | 'alerta' | 'info';

interface AlertaRadarPDF {
  nivel: RadarNivel;
  titulo: string;
  dataFormatada: string;
  descricao: string;
  baseLegal: string;
  impacto: string;
  /** Minutos (legado) */
  valorEstimadoMin?: number;
  /** Valor em R$ (motor radar-trabalhista.ts) */
  valorEstimadoReais?: number;
}

interface RadarResultado {
  alertas: AlertaRadarPDF[];
  valorTotal: number;
}

function stripEmoji(s: string) {
  return s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}]/gu, '').replace(/\s+/g, ' ').trim();
}

function mapAlertaRadarParaPdf(a: AlertaRadar): AlertaRadarPDF {
  const nivel: RadarNivel = a.nivel === 'alto' ? 'perigo' : a.nivel === 'medio' ? 'alerta' : 'info';
  let desc = a.narrativa;
  if (a.ocorrencias && a.ocorrencias.length > 0) {
    desc += '\n\nRegistros identificados: ' + a.ocorrencias.join(' | ');
  }
  return {
    nivel,
    titulo: stripEmoji(a.titulo) || a.titulo,
    dataFormatada: a.periodo,
    descricao: desc,
    baseLegal: a.clt,
    impacto: `Recomendacao: ${a.recomendacao}`,
    valorEstimadoReais: a.valorEstimado != null && a.valorEstimado > 0 ? a.valorEstimado : undefined,
  };
}

/** Mesmo motor da tela /radar (lib/radar-trabalhista.ts) */
function gerarRadarParaPdf(
  days: DaySummary[],
  bancoEntriesRadar: BancoHorasEntry[],
  saldoBancoMin: number,
  perfil: any,
  cargaHoras: number,
  salario: number,
  percentual: number,
): RadarResultado {
  const sorted = [...days].sort((a, b) => a.data.localeCompare(b.data));
  const semReconst = sorted.filter(d => d.registroOrigem !== 'reconstituido');
  const daysComRadar = semReconst.map(d => ({
    ...d,
    ehDiaTrabalho: d.ehDiaTrabalho ?? isScheduledWorkday(d.data, perfil),
  }));
  const bancoDataPrimeiro =
    bancoEntriesRadar.length > 0
      ? bancoEntriesRadar.filter(e => e.tipo === 'acumulo').sort((a, b) => a.data.localeCompare(b.data))[0]?.data ?? null
      : null;
  const alertasLib = analisarRadarTrabalhista({
    days: daysComRadar,
    bancoSaldoMin: saldoBancoMin,
    bancoDataPrimeiro,
    created_at: perfil?.created_at,
    data_admissao: perfil?.data_admissao || perfil?.historico_inicio,
    salario,
    percentualHE: percentual,
    cargaHoras,
    excluirReconstituidos: true,
  });
  const alertas = alertasLib.map(a => mapAlertaRadarParaPdf(a));
  const valorTotal = alertas.reduce((s, a) => s + (a.valorEstimadoReais ?? 0), 0);
  return { alertas, valorTotal };
}

function adicionarRadarNoPDF(
  doc: jsPDF,
  alertas: AlertaRadarPDF[],
  y: number,
  valorHoraNormal: number,
  margem: number,
  contentW: number,
): { y: number; totalEstimado: number } {
  y = checkPage(doc, y, 42);

  doc.setFillColor(26, 26, 46);
  doc.rect(margem, y, contentW, 10, 'F');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(78, 205, 196);
  doc.text('RADAR TRABALHISTA — ANALISE CLT', margem + contentW / 2, y + 6.8, { align: 'center' });
  y += 14;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 110);
  const introRadar =
    'Bloco informativo: le os registros de ponto reais ou manuais (nao inclui historico reconstituido por importacao automatica) e destaca padroes com base em dispositivos legais gerais — sem valor de auditoria, pericia ou parecer juridico.';
  const introLinhas = doc.splitTextToSize(introRadar, contentW - 8);
  introLinhas.forEach((linha: string) => {
    if (y > 255) {
      doc.addPage();
      y = 20;
    }
    doc.text(linha, margem + contentW / 2, y, { align: 'center' });
    y += 3.8;
  });
  y += 4;

  let totalEstimado = 0;
  const cores: Record<RadarNivel, { fundo: [number, number, number]; borda: [number, number, number]; texto: [number, number, number]; badge: string }> = {
    perigo: { fundo: [255, 235, 238], borda: [239, 83, 80], texto: [198, 40, 40], badge: 'PERIGO' },
    alerta: { fundo: [255, 243, 224], borda: [255, 167, 38], texto: [230, 81, 0], badge: 'ALERTA' },
    info: { fundo: [227, 242, 253], borda: [66, 165, 245], texto: [21, 101, 192], badge: 'INFO' },
  };

  alertas.forEach((alerta) => {
    const cor = cores[alerta.nivel];
    const descLinhas = doc.splitTextToSize(alerta.descricao, contentW - 10);
    const baseLinhas = doc.splitTextToSize(`${alerta.baseLegal} | ${alerta.impacto}`, contentW - 10);
    const temValorReais = alerta.valorEstimadoReais != null && alerta.valorEstimadoReais > 0;
    const cardH = Math.max(34, 18 + descLinhas.length * 3.8 + baseLinhas.length * 3.2 + (temValorReais ? 5 : 0));
    y = checkPage(doc, y, cardH + 6);

    doc.setFillColor(cor.fundo[0], cor.fundo[1], cor.fundo[2]);
    doc.setDrawColor(cor.borda[0], cor.borda[1], cor.borda[2]);
    doc.roundedRect(margem, y, contentW, cardH, 2, 2, 'FD');

    doc.setFillColor(cor.borda[0], cor.borda[1], cor.borda[2]);
    doc.roundedRect(margem + 3, y + 3, 24, 6.5, 1.5, 1.5, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(cor.badge, margem + 15, y + 7.5, { align: 'center' });

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(alerta.dataFormatada, margem + contentW - 3, y + 7.5, { align: 'right' });

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(cor.texto[0], cor.texto[1], cor.texto[2]);
    doc.text(alerta.titulo, margem + 3, y + 14);

    doc.setFontSize(8.2);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text(descLinhas, margem + 3, y + 18);

    doc.setFontSize(7.6);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(95, 95, 95);
    const baseY = temValorReais ? y + cardH - 10 : y + cardH - 3.5;
    doc.text(baseLinhas, margem + 3, baseY);

    if (temValorReais) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(39, 174, 96);
      doc.text(
        `Estimativa: ${(alerta.valorEstimadoReais as number).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
        margem + contentW - 3,
        y + cardH - 3.5,
        { align: 'right' },
      );
      totalEstimado += alerta.valorEstimadoReais as number;
    } else if (alerta.valorEstimadoMin && alerta.valorEstimadoMin > 0) {
      totalEstimado += (alerta.valorEstimadoMin / 60) * valorHoraNormal * 1.5;
    }
    y += cardH + 4;
  });

  return { y, totalEstimado };
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
  const bancoEntriesRadar = opcoes?.bancoEntriesParaRadar ?? bancoEntries;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const largura = doc.internal.pageSize.getWidth();
  const margem = 14;
  const contentW = largura - margem * 2;
  let y = 0;

  // Separate days by origin
  const daysReais = days.filter(d => d.registroOrigem === 'real' || d.registroOrigem === 'manual');
  const daysReconstituidos = days.filter(d => d.registroOrigem === 'reconstituido');
  const daysAtestado = days.filter(d => d.origem === 'atestado');
  const daysFeriado = days.filter(d => d.origem === 'feriado');
  const daysFerias = days.filter(d => d.origem === 'ferias');
  const daysPendentes = days.filter(d => d.origem === 'pendente');
  // Only include days with actual work in hour calculations
  const daysForCalc = days.filter(d => d.totalMin > 0 && (incluirReconstituidos || d.registroOrigem !== 'reconstituido'));

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
  const dataInicioMes = daysForCalc.length > 0 ? daysForCalc.map(d => d.data).sort()[0] : '9999-12-31';
  const bancoEntriesHistorico = bancoEntries.filter(e => e.data < dataInicioMes);
  const bhSummaryHistorico = summarizeBancoHoras(bancoEntriesHistorico, salario, percentual);
  
  const saldoInicial = perfil?.banco_horas_saldo_inicial ?? 0;
  
  // Projetamos o saldo: Histórico real (DB) + Horas Extras do período atual (independentemente da config)
  const saldoFinalPDF = saldoInicial + bhSummaryHistorico.saldo - totalCompensado + totalMinExtra;
  
  // Mantemos o bhSummary original apenas para exibir as horas vencidas/a compensar no PDF
  const bhSummary = summarizeBancoHoras(bancoEntries, salario, percentual);

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
    { label: 'Feriados', valor: `${daysFeriado.length} dias`, cor: [231, 76, 60] as const },
    ...(daysPendentes.length > 0 ? [{ label: 'Pendentes', valor: `${daysPendentes.length} dias`, cor: [243, 156, 18] as const }] : []),
    ...(daysFerias.length > 0 ? [{ label: 'Ferias/Folgas', valor: `${daysFerias.length} dias`, cor: [52, 152, 219] as const }] : []),
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
  y += (cardH + 3) * Math.ceil(cards.length / 3) + 4;

  // ── DEMONSTRATIVO FINANCEIRO ──
  if (incluirFinanceiro && salario > 0) {
    y = checkPage(doc, y, 65);
    const tituloFinanceiro = modoTrabalho === 'banco_horas' 
      ? 'Demonstrativo Financeiro (Se pagas em dinheiro)' 
      : 'Demonstrativo Financeiro Estimado';
    y = addSectionTitle(doc, tituloFinanceiro, y, margem);

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
      { label: modoTrabalho !== 'banco_horas' ? 'SALDO TOTAL (Se convertidas em banco)' : 'SALDO TOTAL ATUAL', valor: formatMinutosHoras(saldoFinalPDF), bold: true },
    ];

    if (saldoFinalPDF !== 0) {
      const eqDias = Math.floor(Math.abs(saldoFinalPDF) / (carga * 60));
      const eqH = Math.round(Math.abs(saldoFinalPDF) % (carga * 60) / 60);
      bhItems.push({ label: 'Equivalente a', valor: `${eqDias} dias e ${eqH}h` });
    }
    
    if (saldoFinalPDF > 0 && salario > 0) {
      const estimativaBanco = (saldoFinalPDF / 60) * valorHE;
      bhItems.push({ label: 'Valor estimado do Banco (em dinheiro)', valor: estimativaBanco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) });
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

    // Show ALL days - filter only by user options
    let filteredDays = [...days];
    if (!incluirReconstituidos) filteredDays = filteredDays.filter(d => d.registroOrigem !== 'reconstituido');
    if (!incluirAtestados) filteredDays = filteredDays.filter(d => d.origem !== 'atestado');
    // Remove duplicates by date
    const seenDates = new Set<string>();
    filteredDays = filteredDays.filter(d => {
      if (seenDates.has(d.data)) return false;
      seenDates.add(d.data);
      return true;
    });
    filteredDays.sort((a, b) => b.data.localeCompare(a.data));

    const tableBody = filteredDays.map(d => {
      const dateObj = new Date(d.data + 'T12:00:00');
      const hT = Math.floor(d.totalMin / 60);
      const mT = Math.round(d.totalMin % 60);
      const hE = Math.floor(d.extraMin / 60);
      const mE = Math.round(d.extraMin % 60);

      const trabLabel = d.origem === 'atestado' ? 'Atestado'
        : d.origem === 'feriado' ? (d.feriadoNome || 'Feriado')
        : d.origem === 'ferias' ? (d.feriadoNome || 'Férias')
        : d.origem === 'folga' ? (d.feriadoNome || 'Folga')
        : d.origem === 'fds' ? (d.feriadoNome || 'FDS')
        : d.totalMin === 0 && d.marcacoes.length === 0 ? (d.feriadoNome || '—')
        : `${hT}h${mT}min`;

      const tipoLabel = origemLabel[d.registroOrigem || d.origem] || 'Manual';

      return [
        dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        diasSemana[getDiaSemanaIdx(dateObj.getDay())],
        d.primeiraEntrada ? formatarHoraLocal(d.primeiraEntrada) : '—',
        d.ultimaSaida ? formatarHoraLocal(d.ultimaSaida) : '—',
        d.intervaloMin > 0 ? `${d.intervaloMin}min` : '—',
        trabLabel,
        d.extraMin > 0 ? `+${hE}h${mE}m` : '—',
        tipoLabel,
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
      { label: 'Feriado — feriado nacional/local', cor: origemColor.feriado },
      { label: 'FDS — fim de semana ou descanso sem expediente', cor: origemColor.fds },
      { label: 'Pendente — dia de trabalho sem registro', cor: origemColor.pendente },
      { label: 'Ferias/Folga — ferias ou folga compensada', cor: origemColor.ferias },
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

    const sortedReconst = [...daysReconstituidos].sort((a, b) => b.data.localeCompare(a.data));
    const primeiroReconst = sortedReconst[sortedReconst.length - 1]?.data;
    const ultimoReconst = sortedReconst[0]?.data;
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

  // Radar Trabalhista (mesmo motor da tela /radar)
  const radar = gerarRadarParaPdf(
    days,
    bancoEntriesRadar,
    saldoFinalPDF,
    perfil,
    carga,
    salario,
    percentual,
  );

  const alertasParaRender = radar.alertas.length > 0
    ? radar.alertas
    : [{
      nivel: 'info' as const,
      titulo: 'Tudo certo por aqui',
      dataFormatada: 'Periodo analisado',
      descricao:
        'Nao foram identificados padroes relevantes nos registros reais/manuais deste periodo (pontos reconstituidos excluidos da analise).',
      baseLegal: 'Indicador meramente informativo',
      impacto: 'Nenhuma estimativa financeira adicional neste bloco',
      valorEstimadoMin: 0,
    }];

  const radarRender = adicionarRadarNoPDF(doc, alertasParaRender, y, valorHN, margem, contentW);
  y = radarRender.y + 1;

  const perigos = radar.alertas.filter(a => a.nivel === 'perigo').length;
  const atencao = radar.alertas.filter(a => a.nivel === 'alerta').length;
  const totalRadar = Math.max(radar.valorTotal, radarRender.totalEstimado);

  y = checkPage(doc, y, 34);
  doc.setDrawColor(200, 200, 200);
  doc.line(margem, y, largura - margem, y);
  y += 5;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(26, 26, 46);
  doc.text('RESUMO DO RADAR', margem, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(198, 40, 40);
  doc.text(`Irregularidades criticas: ${perigos}`, margem, y);
  y += 4.5;
  doc.setTextColor(230, 81, 0);
  doc.text(`Irregularidades de atencao: ${atencao}`, margem, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(26, 26, 46);
  doc.text('Total estimado a receber:', margem, y);
  doc.setTextColor(39, 174, 96);
  doc.text(
    totalRadar.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    largura - margem,
    y,
    { align: 'right' },
  );
  y += 7;

  // Legal footer (unico — inclui Radar e extrato)
  y = checkPage(doc, y, 52);
  doc.setFillColor(255, 248, 225);
  doc.setDrawColor(243, 156, 18);
  const avisoTexto =
    'Este documento e um extrato matematico privado para organizacao pessoal. ' +
    'Nao possui valor de laudo pericial, nao substitui cartoes de ponto oficiais e nao constitui prova legal absoluta. ' +
    'O nome da empresa e demais dados sao informados pelo proprio usuario para fins de controle pessoal. ' +
    'O bloco Radar Trabalhista utiliza apenas registros de ponto reais ou manuais informados pelo usuario; nao incorpora dados meramente reconstituidos por importacao automatica. ' +
    'Os indicadores do Radar traduzem dispositivos legais gerais para leitura educativa e nao imputam conduta a empregador ou terceiros, nem substituem assessoria juridica. ' +
    RADAR_ISENCAO_RODAPE +
    ' O desenvolvedor do aplicativo e seus licenciados isentam-se de responsabilidade por decisoes judiciais ou administrativas tomadas com base nestas estimativas. ' +
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

  const safeSlug = (s: string) =>
    s.replace(/[^\w-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'extrato';
  const dataSlug = new Date().toISOString().slice(0, 10);
  const nomeArquivo = `extrato-jornada-${safeSlug(periodoLabel)}-${dataSlug}.pdf`;

  const blob = doc.output('blob') as Blob;
  const pdfBlob =
    blob.type === 'application/pdf'
      ? blob
      : new Blob([blob], { type: 'application/pdf' });

  const url = URL.createObjectURL(pdfBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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

  const [registrosPonto, setRegistrosPonto] = useState<any[]>([]);
  const [feriasPeriodo, setFeriasPeriodo] = useState<any[]>([]);
  const [compPeriodo, setCompPeriodo] = useState<any[]>([]);

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

    const bhRes = await fetchBancoHorasEntries(user.id);
    setBancoEntries(bhRes);

    const { data: compData } = await supabase
      .from('compensacoes_banco_horas')
      .select('minutos')
      .eq('user_id', user.id);
    const total = (compData as any[] || []).reduce((acc: number, c: any) => acc + c.minutos, 0);
    setTotalCompensado(total);

    // Fetch atestados
    let regQuery = supabase.from('registros_ponto').select('data, atestado_periodo')
      .eq('user_id', user.id).is('deleted_at', null)
      .not('atestado_periodo', 'is', null);
    if (startDate) regQuery = regQuery.gte('data', startDate);
    if (endDate) regQuery = regQuery.lte('data', endDate);
    const { data: regData } = await regQuery;
    setRegistrosPonto(regData || []);

    // Fetch férias
    const { data: feriasData } = await supabase.from('ferias').select('*')
      .eq('user_id', user.id).in('status', ['ativa', 'agendada', 'concluida']);
    setFeriasPeriodo(feriasData || []);

    // Fetch compensações do período
    let compPQuery = supabase.from('compensacoes_banco_horas').select('*').eq('user_id', user.id);
    if (startDate) compPQuery = compPQuery.gte('data', startDate);
    if (endDate) compPQuery = compPQuery.lte('data', endDate);
    const { data: compPData } = await compPQuery;
    setCompPeriodo(compPData || []);
  };

  const diaFechamento = (p?.dia_fechamento_folha as number) ?? 0;

  useEffect(() => {
    if (!user) return;
    const { start, end } = getCicloQuery(diaFechamento);
    fetchData(start, end);
  }, [user, diaFechamento]);

  const days = useMemo(() => {
    const { start, end } = getCicloQuery(diaFechamento);
    const feriadosMap = getFeriadosNoPeriodo(start, end);
    return buildDaySummaries(allMarcacoes, carga, registrosPonto, feriadosMap, start, end, feriasPeriodo, compPeriodo, p);
  }, [allMarcacoes, carga, p, registrosPonto, feriasPeriodo, compPeriodo, diaFechamento]);

  const totalHoras = days.reduce((s, d) => s + d.totalMin / 60, 0);
  const totalExtra = days.reduce((s, d) => s + d.extraMin / 60, 0);
  const valorHE = salario > 0 ? (salario / 220) * (1 + percentual / 100) : 0;
  const valorTotal = totalExtra * valorHE;
  
  const dataInicioMesUI = days.length > 0 ? days.map(d => d.data).sort()[0] : '9999-12-31';
  const bancoEntriesHistorico = bancoEntries.filter(e => e.data < dataInicioMesUI);
  const bhSummaryHistorico = summarizeBancoHoras(bancoEntriesHistorico, salario, percentual);
  
  const saldoInicial = p?.banco_horas_saldo_inicial ?? 0;
  // UI Saldo projetado
  const saldoFinal = saldoInicial + bhSummaryHistorico.saldo - totalCompensado + (totalExtra * 60);

  const listaIrregularidades: Irregularidade[] = useMemo(() => {
    const lista: Irregularidade[] = [];
    if (!profile?.salario_base || profile.salario_base === 0) {
      lista.push({ tipo: 'config', mensagem: 'Salário base não configurado.', rota: '/config' });
    }
    if (!profile?.carga_horaria_diaria) {
      lista.push({ tipo: 'config', mensagem: 'Carga horária não configurada.', rota: '/config' });
    }
    
    // Erros operacionais que o usuário deve corrigir:
    const incompletos = days.filter(d => !d.ultimaSaida && d.marcacoes.length > 0);
    if (incompletos.length > 0) {
      lista.push({ tipo: 'sem_saida', mensagem: `${incompletos.length} dia(s) com ponto aberto (esqueceu de bater a saída?).`, rota: '/historico' });
    }

    // Registros absurdos (provável erro de digitação)
    days.forEach(d => {
      if (d.totalMin > 18 * 60) {
        const dl = new Date(d.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        lista.push({ tipo: 'jornada', mensagem: `Aviso: Registradas ${Math.floor(d.totalMin/60)}h em ${dl}. Corrija se for erro.`, rota: '/historico' });
      }
    });

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
      case 'tudo': {
        const admissao = (profile as any)?.historico_inicio || (profile as any)?.data_admissao;
        const createdAt = (profile as any)?.created_at ? new Date((profile as any).created_at).toISOString().split('T')[0] : null;
        const startTudo = admissao || createdAt || `${now.getFullYear()}-01-01`;
        return { start: startTudo, end: fmt(now), label: 'Todo o historico' };
      }
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

      query = query.gte('data', start).lte('data', end);

      const { data } = await query;
      const marcacoes = (data as Marcacao[]) || [];

      // Fetch registros_ponto for atestado info
      const { data: registrosPonto } = await supabase
        .from('registros_ponto')
        .select('data, atestado_periodo')
        .eq('user_id', user!.id)
        .is('deleted_at', null)
        .not('atestado_periodo', 'is', null)
        .gte('data', start)
        .lte('data', end);

      // Fetch férias for the period
      const { data: feriasPeriodo } = await supabase
        .from('ferias')
        .select('*')
        .eq('user_id', user!.id)
        .lte('data_inicio', end)
        .gte('data_fim', start);

      // Fetch compensações for the period
      const { data: compPeriodo } = await supabase
        .from('compensacoes_banco_horas')
        .select('*')
        .eq('user_id', user!.id)
        .gte('data', start)
        .lte('data', end);

      const feriadosMap = getFeriadosNoPeriodo(start, end);
      const periodDays = buildDaySummaries(
        marcacoes, carga, registrosPonto || [], feriadosMap,
        start, end, feriasPeriodo || [], compPeriodo || [], perfilAtual,
      );

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
          bancoEntriesParaRadar: bancoEntries,
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
              {saldoFinal > 0 && <p className="text-[10px] text-accent mt-0.5">{formatCurrency((saldoFinal / 60) * valorHE)}</p>}
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
