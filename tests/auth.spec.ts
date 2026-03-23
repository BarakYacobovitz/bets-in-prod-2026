import { test, expect } from '@playwright/test';

test('Should block new users from registering after kickoff', async ({ page }) => {
  // 1. קובעים תאריך פיקטיבי - יום אחרי פתיחת המונדיאל
  const fakeNow = new Date('2026-06-12T10:00:00').valueOf();

  // 2. מזריקים את התאריך המזויף לדפדפן של הרובוט
  await page.addInitScript(`{
    Date.now = () => ${fakeNow};
    const originalDate = Date;
    globalThis.Date = class extends Date {
      constructor(...args) {
        if (args.length === 0) {
          super(${fakeNow});
        } else {
          super(...args);
        }
      }
    };
    globalThis.Date.now = originalDate.now;
    globalThis.Date.parse = originalDate.parse;
    globalThis.Date.UTC = originalDate.UTC;
  }`);

  // 3. הרובוט נכנס לעמוד הראשי של המערכת המקומית
  await page.goto('http://localhost:3000');

  // 4. מוודאים שהודעת הסגירה ("הטורניר יצא לדרך") מופיעה במקום שעון העצר
  const kickoffMessage = page.locator('text=הטורניר יצא לדרך!');
  await expect(kickoffMessage).toBeVisible();
});