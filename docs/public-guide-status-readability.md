# Guide and status readability

The guide retained both dark component utilities and a legacy CSS block forcing a violet page background. The platform status page and live widget retained dark workspace surfaces with text recolored by the light marketing shell.

Replaced page/widget presentation with existing marketing surfaces, text, borders, actions and darker brand links. Removed the guide-only legacy override and a decorative blur that obscured its heading. Status badges use dark semantic text. Preserved routes, content, refresh timing and health normalization; no homepage changes or new dependencies.

Validation: targeted ESLint and 14 marketing unit tests passed. Chromium rendering of the actual React page components with compiled Tailwind and shared marketing styles passed at 320, 360, 375, 390, 412, 430, 768 and 1440px with no horizontal overflow. Inspected mobile screenshots and computed heading/body/button colors. Test-only health response supplied for server rendering. This is isolated rendering with fallback Arial, not a live browser session or production performance audit.
