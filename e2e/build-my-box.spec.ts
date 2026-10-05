import { expect, test } from '@playwright/test';

test.describe('Construye tu caja', () => {
  test('flujo completo: elegir caja, agregar, ver acomodo, checkout simulado y packing list', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Construye tu caja' })).toBeVisible();

    // 1. Elegir caja fija → caja vacía
    await page.getByText('Caja Estándar', { exact: true }).click();
    await expect(page.getByText('Caja vacía', { exact: true })).toBeVisible();

    // 2. Agregar productos (solo se habilita si el motor confirma que caben)
    for (const name of ['Arroz blanco 1 kg', 'Aceite vegetal 1 L', 'Salsa de tomate en frasco 500 g']) {
      const btn = page.getByRole('button', { name: `Agregar ${name}`, exact: true }).first();
      await expect(btn).toBeEnabled();
      await btn.click();
    }
    const summary = page.getByRole('region', { name: 'Resumen de la caja' });
    await expect(summary.getByText('Todo cabe')).toBeVisible();
    await expect(summary.getByText('Productos (3)')).toBeVisible();

    // 3. Vistas de cámara disponibles
    for (const v of ['Frontal', 'Superior', 'Lateral', 'Perspectiva']) {
      await page.getByRole('button', { name: v, exact: true }).click();
    }

    // 4. Checkout simulado
    await summary.getByRole('link', { name: 'Continuar al pago' }).click();
    await page.getByLabel('Nombre completo').fill('María Pérez');
    await page.getByLabel('Teléfono').fill('+53 5555 1234');
    await page.getByLabel('Dirección').fill('Calle 23 #456, Vedado');
    await page.getByLabel('Municipio / ciudad').fill('Plaza');
    await page.getByRole('button', { name: /Pagar .* \(simulado\)/ }).click();

    // 5. Orden creada y pagada, con packing list
    await expect(page.getByRole('heading', { name: /Orden BMB-\d{6}/ })).toBeVisible();
    await expect(page.getByText('¡Pago simulado aprobado!')).toBeVisible();
    await page.getByRole('link', { name: 'Ver packing list' }).click();
    await expect(page.getByRole('heading', { name: 'Instrucciones de empaque' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Plano por capas' })).toBeVisible();
    await expect(page.getByLabel('Declaración de contenido')).toHaveValue(/DECLARACIÓN DE CONTENIDO/);
  });

  test('explica por qué un producto no cabe y no permite agregarlo', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Caja Pequeña', { exact: true }).click();
    // El aceite de 5 L mide 32 cm de alto y debe ir vertical: no cabe en una caja de 30 cm.
    const card = page.getByRole('article', { name: 'Aceite vegetal 5 L' });
    await expect(card.getByRole('button', { name: /No cabe/ })).toBeDisabled();
    await expect(card.getByText('Orientación no permitida:')).toBeVisible();
  });
});
