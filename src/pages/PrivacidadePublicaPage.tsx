import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Shield } from 'lucide-react';
import { LEGAL_COPY } from '@/lib/legal-copy';

const PrivacidadePublicaPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="bg-primary px-4 py-5">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-primary-foreground">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-primary-foreground font-bold text-lg">Política de Privacidade</h1>
        </div>
      </div>

      <div className="px-4 mt-4 max-w-lg mx-auto">
        <div className="bg-card rounded-xl border border-border p-5 space-y-4 text-sm text-muted-foreground leading-relaxed">
          <div className="flex items-center gap-2 mb-2">
            <Shield size={18} className="text-accent" />
            <span className="font-semibold text-foreground">Política de Privacidade — LGPD</span>
          </div>

          <p>
            O aplicativo Hora Justa respeita a privacidade dos usuários e está em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 – LGPD).
          </p>

          <div>
            <p className="font-semibold text-foreground mb-1">Coleta de dados:</p>
            <p>Podemos coletar informações fornecidas pelo usuário, como:</p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>Nome</li>
              <li>Horários de trabalho</li>
              <li>Informações de jornada</li>
              <li>Dados inseridos manualmente</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-foreground mb-1">Uso dos dados:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Funcionamento do aplicativo</li>
              <li>Cálculo de estimativas</li>
              <li>Geração de relatórios</li>
              <li>Melhoria da experiência</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-foreground mb-1">Compartilhamento:</p>
            <p>Os dados não são vendidos, podendo ser usados apenas para funcionamento técnico (armazenamento em nuvem).</p>
          </div>

          <div>
            <p className="font-semibold text-foreground mb-1">Armazenamento e retenção:</p>
            <p>{LEGAL_COPY.privacy}</p>
          </div>

          <div>
            <p className="font-semibold text-foreground mb-1">Dados sensíveis:</p>
            <p>{LEGAL_COPY.sensitiveData}</p>
          </div>

          <div>
            <p className="font-semibold text-foreground mb-1">Direitos do usuário:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Solicitar exclusão dos dados</li>
              <li>Solicitar acesso aos dados</li>
              <li>Corrigir informações</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-foreground mb-1">Base legal:</p>
            <p>Execução de contrato (Art. 7º, V da LGPD).</p>
          </div>

          <div>
            <p className="font-semibold text-foreground mb-1">Contato:</p>
            <p>contato@horajusta.app</p>
          </div>

          <p className="text-xs text-muted-foreground/60">
            Você pode exportar ou deletar seus dados a qualquer momento em Configurações.
          </p>
        </div>

        <Button
          onClick={() => navigate(-1)}
          className="w-full mt-4 rounded-xl h-12 font-semibold"
        >
          Li e concordo
        </Button>
      </div>
    </div>
  );
};

export default PrivacidadePublicaPage;
