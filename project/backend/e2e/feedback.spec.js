import { test, expect } from '@playwright/test';

test.describe.serial('Customer Feedback Service', () => {
  test('E2E-003 shows the empty state for isolated feedback storage', async ({ page }) => {
    await page.goto('/admin');

    await expect(
      page.getByRole('heading', { name: 'Revisar feedback' })
    ).toBeVisible();
    await expect(
      page.getByText('Todavía no hay feedback enviado.')
    ).toBeVisible();
  });

  test('E2E-002/E2E-004 validates an empty keyboard submission with an associated error', async ({ page }) => {
    await page.goto('/');

    const messageField = page.getByLabel('Comentario');
    await messageField.focus();
    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('button', { name: 'Enviar feedback' })
    ).toBeFocused();

    await page.keyboard.press('Enter');

    await expect(messageField).toHaveAttribute('aria-invalid', 'true');
    await expect(messageField).toHaveAttribute(
      'aria-describedby',
      /message-error/
    );
    await expect(
      page.getByText('Escribe un comentario de entre 1 y 2000 caracteres.')
    ).toBeVisible();
    await expect(
      page.getByText('Feedback enviado correctamente.')
    ).not.toBeVisible();
  });

  test('E2E-001 submits valid feedback by keyboard and exposes it in review', async ({ page }) => {
    const message = 'El formulario fue sencillo de usar.';

    await page.goto('/');
    const messageField = page.getByLabel('Comentario');
    await messageField.fill(message);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');

    await expect(
      page.getByText('Feedback enviado correctamente.')
    ).toBeVisible();
    await expect(messageField).toHaveValue('');

    await page.getByRole('link', { name: 'Revisar feedback' }).click();

    await expect(
      page.getByRole('heading', { name: 'Revisar feedback' })
    ).toBeVisible();
    await expect(page.getByText(message)).toBeVisible();
  });

  test('E2E-005 renders user-controlled markup as literal text without creating executable nodes', async ({ page }) => {
    const hostileMessage = '<script>alert(1)</script>';

    await page.goto('/');
    await page.getByLabel('Comentario').fill(hostileMessage);
    await page.getByRole('button', { name: 'Enviar feedback' }).click();
    await expect(
      page.getByText('Feedback enviado correctamente.')
    ).toBeVisible();

    await page.goto('/admin');

    await expect(page.getByText(hostileMessage, { exact: true })).toBeVisible();
    await expect(page.locator('script')).toHaveCount(1);
    await expect(page.locator('script:not([src="/app.js"])')).toHaveCount(0);
  });
});
