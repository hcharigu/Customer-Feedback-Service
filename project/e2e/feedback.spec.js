import { test, expect } from '@playwright/test';

test.describe.serial('Customer Feedback Service', () => {
  test('empty feedback shows an associated validation error without submission', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Enviar feedback' }).press('Enter');

    const field = page.getByLabel('Comentario');
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('Escribe un comentario de entre 1 y 2000 caracteres.')).toBeVisible();
    await expect(page.getByText('Feedback enviado correctamente.')).not.toBeVisible();
  });

  test('a customer submits feedback and it is shown in review', async ({ page }) => {
    const message = 'El formulario fue sencillo de usar.';

    await page.goto('/');
    await page.getByLabel('Comentario').fill(message);
    await page.getByRole('button', { name: 'Enviar feedback' }).click();

    await expect(page.getByText('Feedback enviado correctamente.')).toBeVisible();

    await page.getByRole('link', { name: 'Revisar feedback' }).click();
    await expect(page.getByRole('heading', { name: 'Revisar feedback' })).toBeVisible();
    await expect(page.getByText(message)).toBeVisible();
  });

  test('user-controlled markup is rendered as text', async ({ page }) => {
    const hostileMessage = '<script>alert(1)</script>';

    await page.goto('/');
    await page.getByLabel('Comentario').fill(hostileMessage);
    await page.getByRole('button', { name: 'Enviar feedback' }).click();
    await page.goto('/admin');

    await expect(page.getByText(hostileMessage)).toBeVisible();
    await expect(page.locator('script')).toHaveCount(1);
  });
});
