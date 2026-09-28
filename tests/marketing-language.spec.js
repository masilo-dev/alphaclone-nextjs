const { test, expect } = require('@playwright/test');

test('a public language selection translates page content and persists across routes', async ({ page }) => {
  await page.goto('/');
  await page.locator('.mkt-header select').first().selectOption('es');

  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Tú escribes.');

  await page.goto('/solutions/agencies');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Conecta las ventas, las campañas y la entrega de proyectos de tu agencia',
  );

  await page.reload();
  await expect(page.locator('.mkt-header select').first()).toHaveValue('es');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Conecta las ventas');

  await page.goto('/contact');
  await expect(page.getByText('Ponte en contacto', { exact: true }).first()).toBeVisible();

  await page.goto('/who-we-serve');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Para equipos que venden');
  await expect(page.getByRole('heading', { name: 'Agencias en crecimiento' })).toBeVisible();
});
