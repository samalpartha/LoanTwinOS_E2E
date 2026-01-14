/**
 * E2E Smoke Tests using Playwright
 * Tests critical user journeys and page loads
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

test.describe('Frontend Smoke Tests', () => {
    test('should load home page', async ({ page }) => {
        await page.goto(BASE_URL);
        await expect(page).toHaveTitle(/LoanTwin/i);

        // Check for main navigation
        await expect(page.locator('nav')).toBeVisible();
    });

    test('should navigate to DLR page', async ({ page }) => {
        await page.goto(`${BASE_URL}/dlr`);

        // Page should load without errors - use first() to handle multiple headings
        await expect(page.locator('h1, h2').first()).toContainText(/Digital Loan Record|DLR/i);
    });

    test('should navigate to Obligations page', async ({ page }) => {
        await page.goto(`${BASE_URL}/obligations`);

        // Page should load
        await expect(page.locator('h1, h2').first()).toContainText(/Obligation/i);
    });

    test('should navigate to Experts page', async ({ page }) => {
        await page.goto(`${BASE_URL}/experts`);

        // Page should load
        await expect(page.locator('h1, h2').first()).toContainText(/Expert/i);
    });

    test('should navigate to Contact page', async ({ page }) => {
        await page.goto(`${BASE_URL}/contact`);

        // Page should load
        await expect(page.locator('h1, h2').first()).toContainText(/Contact|Support/i);
    });

    test('should have working navigation links', async ({ page }) => {
        await page.goto(BASE_URL);

        // Find and click a navigation link (adjust selector based on your nav structure)
        const navLinks = page.locator('nav a');
        const count = await navLinks.count();

        // Should have at least some navigation links
        expect(count).toBeGreaterThan(0);
    });

    test('should not have console errors on home page', async ({ page }) => {
        const errors: string[] = [];

        page.on('console', (msg) => {
            if (msg.type() === 'error') {
                errors.push(msg.text());
            }
        });

        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');

        // Filter out known acceptable errors (like failed API calls to localhost)
        const criticalErrors = errors.filter(
            (err) => !err.includes('localhost') && !err.includes('Failed to fetch')
        );

        expect(criticalErrors).toHaveLength(0);
    });

    test('should have responsive design', async ({ page }) => {
        // Test mobile viewport
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto(BASE_URL);

        // Page should still be usable
        await expect(page.locator('body')).toBeVisible();

        // Test desktop viewport
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto(BASE_URL);

        await expect(page.locator('body')).toBeVisible();
    });
});
