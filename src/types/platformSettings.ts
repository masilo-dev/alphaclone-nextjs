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
};
