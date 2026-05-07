declare module 'robots-txt-guard' {
  export class RobotsTxtGuard {
    constructor(robotsTxt: string);
    isAllowed(userAgent: string, url: string): boolean;
  }
}
