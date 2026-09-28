import type { SupportedLanguage } from './languages';

const pl: Record<string, string> = {
  'Monthly': 'Miesięcznie', 'Annual': 'Rocznie', 'Save up to 20% with annual billing': 'Oszczędź do 20% przy płatności rocznej',
  'Same platform. Different execution power.': 'Ta sama platforma. Różna skala działania.',
  'One system. Choose your execution power.': 'Jeden system. Wybierz skalę działania.',
  'Starter $15/month · Pro $45/month · Enterprise $80/month. Choose the execution capacity that fits your business.': 'Starter 15 USD/mies. · Pro 45 USD/mies. · Enterprise 80 USD/mies. Wybierz plan dla swojej firmy.',
  'Starter $144/year · Pro $432/year · Enterprise $768/year. Save 20% compared with monthly billing. Contact us to confirm annual setup.': 'Starter 144 USD/rok · Pro 432 USD/rok · Enterprise 768 USD/rok. Oszczędź 20% względem płatności miesięcznej. Skontaktuj się z nami, aby potwierdzić plan roczny.',
  'Recommended for active founders': 'Polecany aktywnym założycielom',
  'Essential execution capacity for solo founders getting their core workflows connected.': 'Podstawowa skala działania dla samodzielnych założycieli łączących kluczowe procesy.',
  'Serious daily operating capacity for solo founders and small teams running real workflows.': 'Większa codzienna skala działania dla założycieli i małych zespołów.',
  'Truly unlimited AlphaClone execution — only external provider and safety limits apply.': 'Bez limitów działań po stronie AlphaClone. Obowiązują limity dostawców zewnętrznych i zasady bezpieczeństwa.',
  'no AlphaClone usage ceiling': 'bez limitu użycia AlphaClone', '/mo billed annually': '/mies. przy płatności rocznej', 'Billed monthly': 'Płatność miesięczna', '/year': '/rok', '/month': '/mies.',
  'Discuss annual billing': 'Porozmawiaj o planie rocznym', 'Choose Starter': 'Wybierz Starter', 'Go Pro': 'Wybierz Pro', 'Choose Enterprise': 'Wybierz Enterprise',
  '*Enterprise execution remains subject to external provider API restrictions, anti-spam rules, and platform safety safeguards.': '*Działania w planie Enterprise podlegają ograniczeniom API dostawców, zasadom antyspamowym i zabezpieczeniom platformy.',
  'Detailed Breakdown': 'Szczegóły planów', 'Compare Execution Power Across Plans': 'Porównaj możliwości planów',
  'The same connected platform, with capacity and support that scale from Starter to Enterprise.': 'Ta sama połączona platforma, z rosnącą skalą działania i wsparcia od Starter do Enterprise.',
  'AlphaClone plan comparison': 'Porównanie planów AlphaClone', 'Execution Capability': 'Możliwości działania',
  'Daily Execution Limits (per action category)': 'Dzienne limity działań (na kategorię)', 'Platform Access': 'Dostęp do platformy', 'Support & Infrastructure': 'Wsparcie i infrastruktura',
  'Emails Sent': 'Wysłane e-maile', 'Leads Added': 'Dodane leady', 'CRM Create / Update Actions': 'Tworzenie i aktualizacja w CRM', 'Outreach Actions': 'Działania w kontakcie z klientami',
  'Social Publishing Actions': 'Publikacje w mediach społecznościowych', 'Documents / Contracts / Proposals / Invoices': 'Dokumenty, umowy, oferty i faktury',
  'Automation Executions': 'Działania automatyzacji', 'MCP Write / Execution Actions': 'Działania i zapisy MCP', 'Bulk Lead Import Maximum': 'Maksymalny import leadów',
  'CRM & Lead Management': 'CRM i zarządzanie leadami', 'Contracts & E-Signatures': 'Umowy i podpisy elektroniczne', 'Invoices & Quotations': 'Faktury i wyceny',
  'Projects & Delivery Tasks': 'Projekty i zadania', 'Native Calendar & Booking': 'Kalendarz i rezerwacje', 'Model Context Protocol (MCP) Access': 'Dostęp do MCP',
  'Bonnie AI Assistant': 'Asystentka Bonnie AI', 'Read-Only Views (CRM, reports, inbox)': 'Widoki tylko do odczytu (CRM, raporty, skrzynka)',
  'Priority Processing & Support': 'Priorytetowa obsługa i wsparcie', 'Connected Integrations': 'Połączone integracje', 'Dedicated + SLA': 'Dedykowane wsparcie i SLA',
  'Clear answers about billing cycles, daily limits, and plan upgrades.': 'Jasne odpowiedzi o rozliczeniach, limitach i zmianie planu.',
  'Frequently Asked Questions': 'Najczęściej zadawane pytania',
  'How do daily action resets work?': 'Kiedy odnawiają się dzienne limity?',
  'Daily execution counters (leads, outreach, social posts, emails, MCP executions, documents) reset every day at 00:00 UTC. Read-only actions like viewing CRM records or checking status never consume quota.': 'Liczniki działań (leady, kontakt, posty, e-maile, MCP i dokumenty) odnawiają się codziennie o 00:00 UTC. Samo przeglądanie danych nie zużywa limitu.',
  'Which plan should I choose?': 'Który plan wybrać?',
  'Starter is the entry plan for getting core workflows connected. Pro is designed for active founders and teams. Enterprise provides the highest execution capacity and support.': 'Starter pozwala połączyć podstawowe procesy. Pro jest dla aktywnych założycieli i zespołów. Enterprise oferuje największą skalę działania i wsparcia.',
  'What is included in every AlphaClone plan?': 'Co zawiera każdy plan AlphaClone?',
  'Every plan gives you full access to the AlphaClone workspace platform and MCP tools — CRM, projects, contracts, documents, calendar, and AI agents. Plans differ only by daily execution capacity per action category.': 'Każdy plan daje dostęp do przestrzeni AlphaClone i narzędzi MCP: CRM, projektów, umów, dokumentów, kalendarza i agentów AI. Plany różnią się dziennymi limitami działań.',
  'Can I upgrade or downgrade anytime?': 'Czy mogę zmienić plan w dowolnej chwili?',
  'Yes. Upgrades apply immediately with prorated billing via Stripe. Downgrades take effect at the end of your current billing period.': 'Tak. Wyższy plan zaczyna działać od razu, z proporcjonalnym rozliczeniem przez Stripe. Niższy plan obowiązuje od końca bieżącego okresu rozliczeniowego.',
  'What does Enterprise capacity mean?': 'Co oznacza skala działania Enterprise?',
  'Enterprise provides the highest AlphaClone execution capacity and support. External provider API limits, anti-spam safeguards, and platform safety rules still apply.': 'Enterprise oferuje największą skalę działań i wsparcie AlphaClone. Nadal obowiązują limity API dostawców, zasady antyspamowe i zabezpieczenia platformy.',
  'Find leads. Run outreach. Manage clients. Publish content. Execute work.': 'Znajduj leady. Kontaktuj się. Obsługuj klientów. Publikuj treści. Realizuj zadania.',
  'Get started with Starter at $15, scale to Pro at $45, or choose Enterprise at $80.': 'Zacznij od Starter za 15 USD, przejdź na Pro za 45 USD lub wybierz Enterprise za 80 USD miesięcznie.',
  'Read-only actions unlimited across all modules': 'Działania tylko do odczytu bez limitu we wszystkich modułach',
  'Priority processing & support': 'Priorytetowa obsługa i wsparcie',
  'Unlimited emails sent*': 'Bez limitu wysłanych e-maili*', 'Unlimited leads added*': 'Bez limitu dodanych leadów*',
  'Unlimited CRM actions*': 'Bez limitu działań w CRM*', 'Unlimited outreach actions*': 'Bez limitu działań kontaktowych*',
  'Unlimited social publishing*': 'Bez limitu publikacji w mediach społecznościowych*',
  'Unlimited documents, contracts, proposals & invoices*': 'Bez limitu dokumentów, umów, ofert i faktur*',
  'Unlimited automations & MCP executions*': 'Bez limitu automatyzacji i działań MCP*', 'Unlimited bulk operations*': 'Bez limitu działań zbiorczych*',
  'Unlimited agent workflows*': 'Bez limitu procesów agentów*', 'Usage tracked for analytics — never capped by AlphaClone': 'Użycie jest mierzone, ale AlphaClone go nie ogranicza',
  '* Subject to connected provider API limits and platform anti-abuse safeguards': '* Obowiązują limity API dostawców i zabezpieczenia platformy',
  'Unlimited*': 'Bez limitu*', 'Unlimited': 'Bez limitu',
  'Included': 'W planie', 'Not included': 'Poza planem',
};

const es: Record<string, string> = {
  'Monthly': 'Mensual', 'Annual': 'Anual', 'Save up to 20% with annual billing': 'Ahorra hasta un 20% con el pago anual',
  'Same platform. Different execution power.': 'La misma plataforma. Distinta capacidad de ejecución.',
  'One system. Choose your execution power.': 'Un sistema. Elige tu capacidad de ejecución.',
  'Starter $15/month · Pro $45/month · Enterprise $80/month. Choose the execution capacity that fits your business.': 'Starter 15 USD/mes · Pro 45 USD/mes · Enterprise 80 USD/mes. Elige el plan que se adapte a tu empresa.',
  'Starter $144/year · Pro $432/year · Enterprise $768/year. Save 20% compared with monthly billing. Contact us to confirm annual setup.': 'Starter 144 USD/año · Pro 432 USD/año · Enterprise 768 USD/año. Ahorra un 20% frente al pago mensual. Contáctanos para confirmar el plan anual.',
  'Recommended for active founders': 'Recomendado para fundadores activos',
  'Essential execution capacity for solo founders getting their core workflows connected.': 'Capacidad esencial para fundadores independientes que conectan sus procesos principales.',
  'Serious daily operating capacity for solo founders and small teams running real workflows.': 'Más capacidad diaria para fundadores y equipos pequeños que gestionan procesos reales.',
  'Truly unlimited AlphaClone execution — only external provider and safety limits apply.': 'Ejecución sin límites de AlphaClone; se aplican los límites de proveedores externos y las medidas de seguridad.',
  'no AlphaClone usage ceiling': 'sin límite de uso de AlphaClone', '/mo billed annually': '/mes con pago anual', 'Billed monthly': 'Pago mensual', '/year': '/año', '/month': '/mes',
  'Discuss annual billing': 'Consultar pago anual', 'Choose Starter': 'Elegir Starter', 'Go Pro': 'Elegir Pro', 'Choose Enterprise': 'Elegir Enterprise',
  '*Enterprise execution remains subject to external provider API restrictions, anti-spam rules, and platform safety safeguards.': '*La ejecución Enterprise está sujeta a los límites de las API externas, las normas contra el spam y las medidas de seguridad.',
  'Detailed Breakdown': 'Detalles de los planes', 'Compare Execution Power Across Plans': 'Compara la capacidad de los planes',
  'The same connected platform, with capacity and support that scale from Starter to Enterprise.': 'La misma plataforma conectada, con capacidad y soporte que crecen de Starter a Enterprise.',
  'AlphaClone plan comparison': 'Comparación de planes de AlphaClone', 'Execution Capability': 'Capacidad de ejecución',
  'Daily Execution Limits (per action category)': 'Límites diarios (por categoría)', 'Platform Access': 'Acceso a la plataforma', 'Support & Infrastructure': 'Soporte e infraestructura',
  'Emails Sent': 'Correos enviados', 'Leads Added': 'Leads añadidos', 'CRM Create / Update Actions': 'Creación y actualización en CRM', 'Outreach Actions': 'Acciones de contacto',
  'Social Publishing Actions': 'Publicaciones en redes', 'Documents / Contracts / Proposals / Invoices': 'Documentos, contratos, propuestas y facturas',
  'Automation Executions': 'Ejecuciones de automatización', 'MCP Write / Execution Actions': 'Acciones y escrituras MCP', 'Bulk Lead Import Maximum': 'Importación máxima de leads',
  'CRM & Lead Management': 'CRM y gestión de leads', 'Contracts & E-Signatures': 'Contratos y firmas electrónicas', 'Invoices & Quotations': 'Facturas y presupuestos',
  'Projects & Delivery Tasks': 'Proyectos y tareas', 'Native Calendar & Booking': 'Calendario y reservas', 'Model Context Protocol (MCP) Access': 'Acceso a MCP',
  'Bonnie AI Assistant': 'Asistente Bonnie AI', 'Read-Only Views (CRM, reports, inbox)': 'Vistas de solo lectura (CRM, informes, bandeja)',
  'Priority Processing & Support': 'Procesamiento y soporte prioritarios', 'Connected Integrations': 'Integraciones conectadas', 'Dedicated + SLA': 'Soporte dedicado y SLA',
  'Clear answers about billing cycles, daily limits, and plan upgrades.': 'Respuestas claras sobre pagos, límites diarios y cambios de plan.',
  'Frequently Asked Questions': 'Preguntas frecuentes',
  'How do daily action resets work?': '¿Cuándo se restablecen los límites diarios?',
  'Daily execution counters (leads, outreach, social posts, emails, MCP executions, documents) reset every day at 00:00 UTC. Read-only actions like viewing CRM records or checking status never consume quota.': 'Los contadores de acciones (leads, contactos, publicaciones, correos, MCP y documentos) se restablecen cada día a las 00:00 UTC. Consultar datos no consume el cupo.',
  'Which plan should I choose?': '¿Qué plan debo elegir?',
  'Starter is the entry plan for getting core workflows connected. Pro is designed for active founders and teams. Enterprise provides the highest execution capacity and support.': 'Starter conecta los procesos esenciales. Pro está diseñado para fundadores y equipos activos. Enterprise ofrece la mayor capacidad y soporte.',
  'What is included in every AlphaClone plan?': '¿Qué incluye cada plan de AlphaClone?',
  'Every plan gives you full access to the AlphaClone workspace platform and MCP tools — CRM, projects, contracts, documents, calendar, and AI agents. Plans differ only by daily execution capacity per action category.': 'Cada plan da acceso al espacio AlphaClone y a las herramientas MCP: CRM, proyectos, contratos, documentos, calendario y agentes de IA. Los límites diarios varían según el plan.',
  'Can I upgrade or downgrade anytime?': '¿Puedo cambiar de plan en cualquier momento?',
  'Yes. Upgrades apply immediately with prorated billing via Stripe. Downgrades take effect at the end of your current billing period.': 'Sí. Los cambios a un plan superior se aplican de inmediato con cobro proporcional mediante Stripe. Los cambios a un plan inferior se aplican al terminar el periodo actual.',
  'What does Enterprise capacity mean?': '¿Qué significa la capacidad Enterprise?',
  'Enterprise provides the highest AlphaClone execution capacity and support. External provider API limits, anti-spam safeguards, and platform safety rules still apply.': 'Enterprise ofrece la mayor capacidad y soporte de AlphaClone. Se siguen aplicando los límites de las API externas, las medidas contra el spam y las reglas de seguridad.',
  'Find leads. Run outreach. Manage clients. Publish content. Execute work.': 'Encuentra leads. Contacta clientes. Gestiona proyectos. Publica contenido. Ejecuta tareas.',
  'Get started with Starter at $15, scale to Pro at $45, or choose Enterprise at $80.': 'Empieza con Starter por 15 USD, pasa a Pro por 45 USD o elige Enterprise por 80 USD al mes.',
  'Read-only actions unlimited across all modules': 'Consultas ilimitadas en todos los módulos',
  'Priority processing & support': 'Procesamiento y soporte prioritarios',
  'Unlimited emails sent*': 'Correos enviados sin límite*', 'Unlimited leads added*': 'Leads añadidos sin límite*',
  'Unlimited CRM actions*': 'Acciones de CRM sin límite*', 'Unlimited outreach actions*': 'Acciones de contacto sin límite*',
  'Unlimited social publishing*': 'Publicaciones en redes sin límite*',
  'Unlimited documents, contracts, proposals & invoices*': 'Documentos, contratos, propuestas y facturas sin límite*',
  'Unlimited automations & MCP executions*': 'Automatizaciones y ejecuciones MCP sin límite*', 'Unlimited bulk operations*': 'Operaciones masivas sin límite*',
  'Unlimited agent workflows*': 'Flujos de agentes sin límite*', 'Usage tracked for analytics — never capped by AlphaClone': 'El uso se registra, pero AlphaClone no lo limita',
  '* Subject to connected provider API limits and platform anti-abuse safeguards': '* Se aplican los límites de las API externas y las medidas de seguridad',
  'Unlimited*': 'Sin límite*', 'Unlimited': 'Sin límite',
  'Included': 'Incluido', 'Not included': 'No incluido',
};

const dailyPl: Record<string, string> = {
  'emails sent': 'wysłanych e-maili', 'leads added': 'dodanych leadów', 'CRM actions': 'działań w CRM',
  'outreach actions': 'działań kontaktowych', 'social publishing actions': 'publikacji w mediach społecznościowych',
  'documents, contracts, proposals & invoices': 'dokumentów, umów, ofert i faktur',
  'automation & MCP executions': 'automatyzacji i działań MCP', 'bulk lead import max': 'leadów w imporcie zbiorczym',
};
const dailyEs: Record<string, string> = {
  'emails sent': 'correos enviados', 'leads added': 'leads añadidos', 'CRM actions': 'acciones de CRM',
  'outreach actions': 'acciones de contacto', 'social publishing actions': 'publicaciones en redes',
  'documents, contracts, proposals & invoices': 'documentos, contratos, propuestas y facturas',
  'automation & MCP executions': 'automatizaciones y ejecuciones MCP', 'bulk lead import max': 'leads de importación masiva',
};

export function marketingPricingTranslate(lang: SupportedLanguage, text: string): string | undefined {
  const table = lang === 'pl' ? pl : lang === 'es' ? es : undefined;
  if (!table) return undefined;
  if (table[text]) return table[text];
  const daily = text.match(/^(\d+) (.+) \/ day$/);
  if (daily) {
    const label = (lang === 'pl' ? dailyPl : dailyEs)[daily[2]];
    if (label) return `${daily[1]} ${label} ${lang === 'pl' ? 'dziennie' : 'al día'}`;
  }
  if (/^\d+ \/ day$/.test(text)) return text.replace(' / day', lang === 'pl' ? ' dziennie' : ' al día');
  return undefined;
}
