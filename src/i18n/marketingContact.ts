import type { SupportedLanguage } from './languages';

const pl: Record<string, string> = {
  'Get in touch': 'Skontaktuj się z nami', "Let's Build Your": 'Rozwijajmy razem', 'Growth Engine.': 'Twoją firmę.',
  'Get in touch to discuss your workflows. For the fastest response, book a walkthrough or reach out directly.': 'Porozmawiajmy o procesach w Twojej firmie. Aby uzyskać szybką odpowiedź, umów prezentację lub skontaktuj się bezpośrednio.',
  'Book a Walkthrough': 'Umów prezentację', 'Chat on WhatsApp': 'Napisz na WhatsApp', 'Direct Channels': 'Kontakt bezpośredni',
  'Email': 'E-mail', 'General': 'Kontakt ogólny', 'Sales': 'Sprzedaż', 'Administration': 'Administracja', 'Phone & WhatsApp': 'Telefon i WhatsApp',
  'Send WhatsApp message': 'Wyślij wiadomość na WhatsApp', 'Registered office': 'Siedziba rejestrowa',
  'Support is available by phone and WhatsApp — remote team, US-registered entity.': 'Pomoc przez telefon i WhatsApp. Pracujemy zdalnie; firma jest zarejestrowana w USA.',
  'Prefer a live call?': 'Wolisz rozmowę?', 'Skip the inbox and schedule a live walkthrough directly.': 'Umów prezentację bez pisania wiadomości.',
  'Book a free meeting': 'Umów bezpłatną rozmowę', 'Send a Message': 'Wyślij wiadomość', 'Send Message': 'Wyślij wiadomość',
  'Inquiry received!': 'Otrzymaliśmy wiadomość!', 'We received your inquiry and will be in touch within 24 hours.': 'Otrzymaliśmy Twoją wiadomość. Odezwiemy się w ciągu 24 godzin.',
  'Your inquiry is saved, but the email notification could not be delivered. For an urgent reply, email bonnie@alphaclonesystems.com.': 'Zapisaliśmy wiadomość, ale nie udało się dostarczyć powiadomienia e-mail. Jeśli sprawa jest pilna, napisz na bonnie@alphaclonesystems.com.',
  'Failed to send message. Please try again.': 'Nie udało się wysłać wiadomości. Spróbuj ponownie.',
  'Full name *': 'Imię i nazwisko *', 'Your name': 'Twoje imię i nazwisko', 'Email address *': 'Adres e-mail *',
  'Company': 'Firma', 'Your company (optional)': 'Nazwa firmy (opcjonalnie)', 'Phone': 'Telefon', '+1 555 000 0000 (optional)': 'Numer telefonu (opcjonalnie)',
  'Subject *': 'Temat *', 'What is this regarding?': 'Czego dotyczy wiadomość?', 'Message *': 'Wiadomość *',
  'Tell us about your business or what you need help with…': 'Opowiedz nam o swojej firmie lub o tym, w czym możemy pomóc…',
  'Complete the security check to send your message. If it does not load, email info@alphaclonesystems.com directly.': 'Ukończ weryfikację bezpieczeństwa, aby wysłać wiadomość. Jeśli się nie wczytuje, napisz na info@alphaclonesystems.com.',
  'Sending…': 'Wysyłanie…', 'Please check your form inputs and try again.': 'Sprawdź formularz i spróbuj ponownie.',
  'Something went wrong. Please try again or email us directly at info@alphaclonesystems.com.': 'Wystąpił problem. Spróbuj ponownie lub napisz na info@alphaclonesystems.com.',
  'Network error. Please check your connection and try again.': 'Błąd połączenia. Sprawdź internet i spróbuj ponownie.',
};

const es: Record<string, string> = {
  'Get in touch': 'Ponte en contacto', "Let's Build Your": 'Impulsemos juntos', 'Growth Engine.': 'tu negocio.',
  'Get in touch to discuss your workflows. For the fastest response, book a walkthrough or reach out directly.': 'Hablemos de los procesos de tu empresa. Para recibir una respuesta rápida, reserva una presentación o contáctanos directamente.',
  'Book a Walkthrough': 'Reserva una presentación', 'Chat on WhatsApp': 'Escríbenos por WhatsApp', 'Direct Channels': 'Contacto directo',
  'Email': 'Correo electrónico', 'General': 'General', 'Sales': 'Ventas', 'Administration': 'Administración', 'Phone & WhatsApp': 'Teléfono y WhatsApp',
  'Send WhatsApp message': 'Enviar mensaje por WhatsApp', 'Registered office': 'Domicilio social',
  'Support is available by phone and WhatsApp — remote team, US-registered entity.': 'Atención por teléfono y WhatsApp. Equipo remoto y empresa registrada en EE. UU.',
  'Prefer a live call?': '¿Prefieres hablar?', 'Skip the inbox and schedule a live walkthrough directly.': 'Reserva una presentación sin tener que enviar un mensaje.',
  'Book a free meeting': 'Reserva una reunión gratuita', 'Send a Message': 'Envíanos un mensaje', 'Send Message': 'Enviar mensaje',
  'Inquiry received!': '¡Hemos recibido tu mensaje!', 'We received your inquiry and will be in touch within 24 hours.': 'Hemos recibido tu mensaje y responderemos en un plazo de 24 horas.',
  'Your inquiry is saved, but the email notification could not be delivered. For an urgent reply, email bonnie@alphaclonesystems.com.': 'Tu mensaje se ha guardado, pero no se pudo entregar la notificación por correo. Si es urgente, escribe a bonnie@alphaclonesystems.com.',
  'Failed to send message. Please try again.': 'No se pudo enviar el mensaje. Inténtalo de nuevo.',
  'Full name *': 'Nombre completo *', 'Your name': 'Tu nombre', 'Email address *': 'Correo electrónico *',
  'Company': 'Empresa', 'Your company (optional)': 'Tu empresa (opcional)', 'Phone': 'Teléfono', '+1 555 000 0000 (optional)': 'Número de teléfono (opcional)',
  'Subject *': 'Asunto *', 'What is this regarding?': '¿Sobre qué quieres hablar?', 'Message *': 'Mensaje *',
  'Tell us about your business or what you need help with…': 'Cuéntanos sobre tu empresa o sobre lo que necesitas…',
  'Complete the security check to send your message. If it does not load, email info@alphaclonesystems.com directly.': 'Completa la verificación de seguridad para enviar el mensaje. Si no se carga, escribe a info@alphaclonesystems.com.',
  'Sending…': 'Enviando…', 'Please check your form inputs and try again.': 'Revisa el formulario e inténtalo de nuevo.',
  'Something went wrong. Please try again or email us directly at info@alphaclonesystems.com.': 'Se produjo un error. Inténtalo de nuevo o escribe a info@alphaclonesystems.com.',
  'Network error. Please check your connection and try again.': 'Error de conexión. Revisa tu red e inténtalo de nuevo.',
};

export function marketingContactTranslate(lang: SupportedLanguage, text: string): string | undefined {
  return lang === 'pl' ? pl[text] : lang === 'es' ? es[text] : undefined;
}
