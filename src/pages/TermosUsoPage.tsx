import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { LEGAL_COPY } from '@/lib/legal-copy';

const TermosUsoPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="bg-primary px-4 py-5">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-primary-foreground">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-primary-foreground font-bold text-lg">Termos de Uso</h1>
        </div>
      </div>

      <div className="px-4 mt-4 max-w-lg mx-auto">
        <div className="bg-card rounded-xl border border-border p-5 space-y-4 text-sm text-muted-foreground leading-relaxed">
          <p>
            O aplicativo Hora Justa é uma ferramenta de controle de jornada de trabalho destinada ao registro de horários e geração de estimativas de horas trabalhadas e valores relacionados.
          </p>
          <p>Ao utilizar o aplicativo, o usuário declara estar ciente de que:</p>
          <ol className="list-decimal pl-5 space-y-2">
            <li>Todas as informações inseridas são de sua exclusiva responsabilidade.</li>
            <li>Os cálculos apresentados são estimativas baseadas nos dados informados, podendo não refletir valores reais ou oficiais.</li>
            <li>O aplicativo não substitui orientação jurídica, contábil ou profissional.</li>
            <li>Os relatórios gerados possuem caráter informativo e não constituem prova legal absoluta.</li>
            <li>O uso das informações em processos ou decisões legais deve ser feito com acompanhamento de profissional qualificado.</li>
          </ol>

          <div className="border-t border-border pt-4 mt-4">
            <p className="font-semibold text-foreground mb-2">Assinaturas e Pagamentos</p>
            <p>{LEGAL_COPY.subscription}</p>
          </div>

          <div className="border-t border-border pt-4 mt-4">
            <p className="font-semibold text-foreground mb-2">Limitação de Responsabilidade</p>
            <p>{LEGAL_COPY.liability}</p>
          </div>

          <p>
            O Hora Justa não se responsabiliza por decisões tomadas com base nas informações apresentadas no aplicativo.
          </p>
          <p>O uso contínuo do aplicativo implica na aceitação destes termos.</p>
        </div>

        <Button
          onClick={() => navigate(-1)}
          className="w-full mt-4 rounded-xl h-12 font-semibold"
        >
          Aceitar e continuar
        </Button>
      </div>
    </div>
  );
};

export default TermosUsoPage;
