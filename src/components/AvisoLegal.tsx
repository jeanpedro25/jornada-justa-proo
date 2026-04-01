import React from 'react';
import { LEGAL_COPY } from '@/lib/legal-copy';

const AvisoLegal: React.FC = () => (
  <p className="text-[10px] text-muted-foreground/50 text-center mt-4 px-4 leading-relaxed">
    {LEGAL_COPY.general}
  </p>
);

export default AvisoLegal;
