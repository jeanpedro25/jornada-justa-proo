import React from 'react';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import { Shield, Lock, Eye, Trash2, Database } from 'lucide-react';

const PrivacidadePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background pb-20">
      <AppHeader title="Privacidade" subtitle="Seus dados, suas regras" />
      <div className="px-4 -mt-3 max-w-lg mx-auto space-y-4">
        <div className="bg-card rounded-xl border border-border p-5 space-y-5">
          <div className="flex items-center gap-2 mb-2">
            <Shield size={18} className="text-accent" />
            <span className="font-semibold">Política de Privacidade — LGPD</span>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">
            O Hora Justa está em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 – LGPD).
          </p>

          <div className="space-y-4">
            <div className="flex gap-3">
              <Lock size={16} className="text-accent shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold">Criptografia</p>
                <p className="text-xs text-muted-foreground">
                  Seus dados são criptografados em trânsito (TLS/SSL) e em repouso nos nossos servidores cloud seguros.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Database size={16} className="text-accent shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold">Seus dados pertencem a você</p>
                <p className="text-xs text-muted-foreground">
                  Os dados inseridos são de propriedade exclusiva do usuário. Nenhuma informação é compartilhada com sua empresa empregadora, terceiros ou qualquer outra parte.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Eye size={16} className="text-accent shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold">Transparência total</p>
                <p className="text-xs text-muted-foreground">
                  Coletamos apenas os dados que você mesmo insere: nome, horários de trabalho e informações de jornada. Nunca coletamos dados sem seu conhecimento.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Trash2 size={16} className="text-accent shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold">Exclusão garantida</p>
                <p className="text-xs text-muted-foreground">
                  Você pode exportar ou deletar todos os seus dados a qualquer momento em Configurações. Após solicitação de exclusão, os dados serão removidos em até 30 dias.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-accent/5 rounded-lg p-3 border border-accent/20">
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Base legal para tratamento de dados: execução de contrato (Art. 7º, V da LGPD). 
              Utilizamos cookies e analytics exclusivamente para melhoria do serviço. 
              Contato: contato@horajusta.app
            </p>
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

export default PrivacidadePage;
