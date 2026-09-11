/** Disclosure presented before an electronic signature is accepted. */
export const ESIGN_DISCLOSURE = `
  <div class="esign-disclosure">
    <h3>Electronic Signature Disclosure and Consent</h3>
    <p><strong>Please read this disclosure before proceeding.</strong></p>
    <h4>Consent to Electronic Records and Signatures</h4>
    <p>By selecting the consent checkbox and signing, you agree to conduct this transaction electronically, use an electronic signature, and receive this agreement and related disclosures electronically.</p>
    <h4>Legal Effect and Intent</h4>
    <p>Your electronic signature is intended to have the same legal effect as a handwritten signature. Selecting “Sign Document” confirms your intent to be bound by the agreement.</p>
    <h4>Hardware and Software</h4>
    <p>You need internet access, a current web browser, an active email address, and enough storage or a printer to retain a copy.</p>
    <h4>Paper Copies and Withdrawal</h4>
    <p>You may request a paper copy or withdraw consent for future electronic transactions by contacting the sender. Withdrawal does not affect signatures already completed.</p>
    <h4>Record Retention</h4>
    <p>Download or print a copy for your records. The sender will retain the executed agreement according to its applicable retention policy.</p>
    <div class="consent-checkbox">
      <label><input type="checkbox" id="esign-consent" required> <strong>I have read this disclosure and consent to use electronic records and signatures for this transaction.</strong></label>
    </div>
  </div>
`;

export const esignatureComplianceService = { ESIGN_DISCLOSURE };
