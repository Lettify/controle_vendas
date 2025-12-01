
import { test, expect } from '@playwright/test';

test('Audit Logs UI Verification', async ({ page }) => {
    // Mock authentication
    await page.route('/api/trpc/auth.me', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                result: {
                    data: {
                        id: 'test-admin-id',
                        name: 'Admin User',
                        role: 'admin',
                        sessionVersion: 1
                    }
                }
            })
        });
    });

    // Mock audit logs data
    await page.route('/api/trpc/auditLogs.list*', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                result: {
                    data: {
                        logs: [
                            {
                                id: 'log-1',
                                userId: 'user-1',
                                userName: 'Test User',
                                action: 'LOGIN',
                                entityType: 'USER',
                                entityId: 'user-1',
                                details: '{"device":"Chrome"}',
                                ipAddress: '127.0.0.1',
                                createdAt: new Date().toISOString()
                            }
                        ],
                        total: 1
                    }
                }
            })
        });
    });

    // Navigate to audit logs page
    await page.goto('http://localhost:5173/admin/audit-logs');

    // Verify page title
    await expect(page.locator('h1')).toContainText('Logs de Auditoria');

    // Verify table content
    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('text=LOGIN')).toBeVisible();
    await expect(page.locator('text=Test User')).toBeVisible();
});
