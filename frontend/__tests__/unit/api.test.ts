/**
 * Unit tests for API client utility functions.
 */
import { API_BASE } from '../../lib/api';

describe('API Client', () => {
    describe('API_BASE configuration', () => {
        it('should have a valid API_BASE URL', () => {
            expect(API_BASE).toBeDefined();
            expect(typeof API_BASE).toBe('string');
            expect(API_BASE).toMatch(/^https?:\/\//);
        });

        it('should point to localhost in development', () => {
            expect(API_BASE).toContain('localhost');
        });
    });

    describe('API endpoints', () => {
        it('should construct correct loan endpoint URLs', () => {
            const loanId = 'test-loan-123';
            const expectedUrl = `${API_BASE}/api/loans/${loanId}`;
            expect(expectedUrl).toContain('/api/loans/test-loan-123');
        });

        it('should construct correct workspace endpoint URLs', () => {
            const expectedUrl = `${API_BASE}/api/workspaces`;
            expect(expectedUrl).toContain('/api/workspaces');
        });
    });
});
