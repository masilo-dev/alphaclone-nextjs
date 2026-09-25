# AlphaClone Systems — Language Switcher & Full System i18n Audit Report

**Date**: 2026-09-25T11:13:10.276Z
**Target URL**: https://alphaclonesystems.com
**Languages Evaluated**: en, es, pl

## 1. Executive Summary & i18n Metrics

| Metric | Empirical Result | Status |
| :--- | :--- | :--- |
| **Language Switches Tested** | **4 switches** | Verified |
| **Successful Visual & State Transitions** | **3 / 4** | WARN |
| **State Persisted Across Hard Reloads** | **1 instances** | PASS |
| **Average Switch Latency** | **925ms** | FAST (<1s) |
| **Visual Screenshots Captured** | **12 visual captures** | Cataloged |

## 2. Surfaces Audited (Inside & Out)

### Public Marketing Site (Outside)
- **Header Language Switcher**: Present & Functional
- **English -> Spanish Transition**: PASS (818ms)
- **HTML Lang Attribute**: Updated to `es`
- **Storage Key**: `ac-language` = `es`
- **Sample Spanish Nav**: ["AlphaClone\nSYSTEMS","Integraciones","Precios","Acerca de","Iniciar sesión"]

### Authenticated Dashboard & Workspaces (Inside)
- **Account Menu Language Selector**: Present & Functional
- **English -> Spanish Transition**: PASS (1044ms)
- **HTML Lang Attribute**: Updated to `es`
- **Sample Spanish Sidebar**: []

### Dedicated Settings Page
- **Language Preference Controls**: Managed via Account Menu

### Client Portal
- **Portal Lang**: `en`
- **Dedicated Portal Switcher**: Inherits Browser/Global

## 3. Visual Screenshot Catalog

- **Marketing (EN)**: `01-landing-en.png`
- **Marketing (ES)**: `02-landing-es.png`
- **Marketing (PL)**: `03-landing-pl.png`
- **About Page (PL)**: `04-about-pl.png`
- **About Page (EN)**: `05-about-en.png`
- **Dashboard (EN)**: `06-dashboard-en.png`
- **Dashboard (ES)**: `07-dashboard-es.png`
- **CRM Workspace (ES)**: `08-dashboard-crm-es.png`
- **CRM Workspace (PL)**: `09-dashboard-pl.png`
- **Dashboard Restored (EN)**: `11-dashboard-restored-en.png`
- **Settings Page**: `10-settings-page.png`
- **Client Portal Login**: `12-portal-login.png`
