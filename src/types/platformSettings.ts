export type PlatformGlobalSettings = {
  branding?: {
    platformName?: string;
    supportEmail?: string;
    platformUrl?: string;
  };
  security?: {
    enforce2faTenantAdmins?: boolean;
    openRegistration?: boolean;
    maintenanceMode?: boolean;
  };
  support?: {
    docsUrl?: string;
  };
  compliance?: {
    gdprEnabled?: boolean;
    ccpaEnabled?: boolean;
    cookieConsentEnabled?: boolean;
    dataProcessingAgreementUrl?: string;
    privacyPolicyUrl?: string;
    termsOfServiceUrl?: string;
  };
  emailProviders?: {
    zohoEnabled?: boolean;
    outlookEnabled?: boolean;
    gmailEnabled?: boolean;
    sendgridEnabled?: boolean;
    resendEnabled?: boolean;
    brevoEnabled?: boolean;
    customSmtpEnabled?: boolean;
  };
};

export type PlatformEnvStatus = {
  supabase: boolean;
  supabaseAuth: boolean;
  stripe: boolean;
  daily: boolean;
  resend: boolean;
  facebook: boolean;
  zoom: boolean;
  googleOAuth: boolean;
  anthropic: boolean;
  openai: boolean;
  gemini: boolean;
  whatsapp: boolean;
  linkedin: boolean;
  instagram: boolean;
  twitter: boolean;
  zoho: boolean;
  microsoft365: boolean;
  outlook: boolean;
  gmail: boolean;
  deepseek: boolean;
};
