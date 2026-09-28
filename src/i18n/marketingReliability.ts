import type { SupportedLanguage } from './languages';

const pl: Record<string, string> = {
  'Trust & control': 'Zaufanie i kontrola',
  'Reliability, recovery, and honest limits': 'Niezawodność, odzyskiwanie i jasne ograniczenia',
  'That only works if you can see what ran, what failed, and what still needs your decision.': 'To działa tylko wtedy, gdy widzisz, co zostało wykonane, co się nie udało i co nadal wymaga Twojej decyzji.',
  'Approval before impact': 'Zatwierdzenie przed działaniem',
  'Client-facing sends, charges, and high-risk actions can require explicit approval. You choose where automation stops and review begins.': 'Wiadomości do klientów, obciążenia i działania podwyższonego ryzyka mogą wymagać wyraźnej zgody. Ty decydujesz, gdzie kończy się automatyzacja, a zaczyna kontrola.',
  'Retries and visibility': 'Ponowne próby i widoczność',
  'Background jobs and automations use retry logic for transient failures. Platform status and health endpoints support operational transparency — see': 'Zadania w tle i automatyzacje ponawiają działanie po przejściowych błędach. Stan platformy i punkty kontroli sprawności zwiększają przejrzystość — sprawdź',
  'platform status': 'stan platformy',
  'for current availability.': ', aby poznać bieżącą dostępność.',
  'Provider and integration limits': 'Ograniczenia dostawców i integracji',
  'Email deliverability, social APIs, and payment providers impose their own limits. AlphaClone surfaces readiness checks before execution where supported — success still depends on connected accounts and external services.': 'Dostarczanie poczty, API serwisów społecznościowych i dostawcy płatności mają własne ograniczenia. Tam, gdzie to możliwe, AlphaClone sprawdza gotowość przed wykonaniem; wynik nadal zależy od połączonych kont i usług zewnętrznych.',
  'Current product limits (public catalog)': 'Aktualne ograniczenia produktu (katalog publiczny)',
  'Beta:': 'Wersja beta:', 'Coming soon:': 'Wkrótce:',
  'not marketed as fully available until status changes in our': 'nie są przedstawiane jako w pełni dostępne, dopóki ich status nie zmieni się w naszym',
  'integrations overview': 'katalogu integracji',
  'We do not guarantee revenue, lead volume, or unattended operation of your entire business. Security and data handling practices are described in our': 'Nie gwarantujemy przychodów, liczby leadów ani działania całej firmy bez nadzoru. Zasady bezpieczeństwa i przetwarzania danych opisano w naszej',
  'security policy': 'polityce bezpieczeństwa', 'privacy policy': 'polityce prywatności', 'and': 'i',
};

const es: Record<string, string> = {
  'Trust & control': 'Confianza y control',
  'Reliability, recovery, and honest limits': 'Fiabilidad, recuperación y límites claros',
  'That only works if you can see what ran, what failed, and what still needs your decision.': 'Esto solo funciona si puedes ver qué se ejecutó, qué falló y qué sigue requiriendo tu decisión.',
  'Approval before impact': 'Aprobación antes de actuar',
  'Client-facing sends, charges, and high-risk actions can require explicit approval. You choose where automation stops and review begins.': 'Los envíos a clientes, los cobros y las acciones de alto riesgo pueden requerir aprobación explícita. Tú decides dónde termina la automatización y empieza la revisión.',
  'Retries and visibility': 'Reintentos y visibilidad',
  'Background jobs and automations use retry logic for transient failures. Platform status and health endpoints support operational transparency — see': 'Las tareas en segundo plano y las automatizaciones reintentan los fallos temporales. El estado de la plataforma y los controles de salud aportan transparencia; consulta el',
  'platform status': 'estado de la plataforma',
  'for current availability.': 'para conocer la disponibilidad actual.',
  'Provider and integration limits': 'Límites de proveedores e integraciones',
  'Email deliverability, social APIs, and payment providers impose their own limits. AlphaClone surfaces readiness checks before execution where supported — success still depends on connected accounts and external services.': 'La entrega de correo, las API sociales y los proveedores de pago tienen sus propios límites. AlphaClone muestra comprobaciones de preparación cuando es posible; el resultado sigue dependiendo de las cuentas conectadas y los servicios externos.',
  'Current product limits (public catalog)': 'Límites actuales del producto (catálogo público)',
  'Beta:': 'Beta:', 'Coming soon:': 'Próximamente:',
  'not marketed as fully available until status changes in our': 'no se presentan como totalmente disponibles hasta que cambie su estado en nuestro',
  'integrations overview': 'catálogo de integraciones',
  'We do not guarantee revenue, lead volume, or unattended operation of your entire business. Security and data handling practices are described in our': 'No garantizamos ingresos, volumen de leads ni el funcionamiento de todo tu negocio sin supervisión. Las prácticas de seguridad y tratamiento de datos se describen en nuestra',
  'security policy': 'política de seguridad', 'privacy policy': 'política de privacidad', 'and': 'y',
};

export function marketingReliabilityTranslate(lang: SupportedLanguage, text: string): string | undefined {
  return lang === 'pl' ? pl[text] : lang === 'es' ? es[text] : undefined;
}
