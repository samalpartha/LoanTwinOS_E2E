/**
 * Smoke tests for critical frontend functionality.
 */

describe('Frontend Smoke Tests', () => {
    describe('Environment', () => {
        it('should have Node.js environment', () => {
            expect(process).toBeDefined();
        });

        it('should have required environment variables', () => {
            // Check that we can access process.env
            expect(process.env).toBeDefined();
        });
    });

    describe('API Configuration', () => {
        it('should be able to import API utilities', async () => {
            const api = await import('../../lib/api');
            expect(api).toBeDefined();
            expect(api.API_BASE).toBeDefined();
        });
    });

    describe('Critical Pages', () => {
        it('should be able to import home page', async () => {
            const homePage = await import('../../app/page');
            expect(homePage).toBeDefined();
            expect(homePage.default).toBeDefined();
        });

        it('should be able to import DLR page', async () => {
            const dlrPage = await import('../../app/dlr/page');
            expect(dlrPage).toBeDefined();
            expect(dlrPage.default).toBeDefined();
        });

        it('should be able to import Obligations page', async () => {
            const obligationsPage = await import('../../app/obligations/page');
            expect(obligationsPage).toBeDefined();
            expect(obligationsPage.default).toBeDefined();
        });

        it('should be able to import Experts page', async () => {
            const expertsPage = await import('../../app/experts/page');
            expect(expertsPage).toBeDefined();
            expect(expertsPage.default).toBeDefined();
        });

        it('should be able to import Contact page', async () => {
            const contactPage = await import('../../app/contact/page');
            expect(contactPage).toBeDefined();
            expect(contactPage.default).toBeDefined();
        });
    });

    describe('Utilities', () => {
        it('should have lucide-react icons available', async () => {
            const icons = await import('lucide-react');
            expect(icons).toBeDefined();
            expect(icons.Home).toBeDefined();
            expect(icons.FileText).toBeDefined();
        });
    });
});
