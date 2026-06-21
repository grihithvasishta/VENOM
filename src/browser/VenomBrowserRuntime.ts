import puppeteer, { Browser, Page } from 'puppeteer';

export class VenomBrowserRuntime {
    private browser: Browser | null = null;
    private page: Page | null = null;

    async init() {
        if (!this.browser) {
            this.browser = await puppeteer.launch({ headless: true });
            this.page = await this.browser.newPage();
        }
    }

    async navigate(url: string) {
        await this.init();
        const parsedUrl = new URL(url);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            throw new Error(`Unsupported browser URL protocol: ${parsedUrl.protocol}`);
        }

        if (this.page) {
            await this.page.goto(parsedUrl.toString(), { waitUntil: 'networkidle2' });
        }
    }

    async extractText(): Promise<string> {
        await this.init();
        if (this.page) {
            return await this.page.evaluate(() => document.body.innerText);
        }
        return '';
    }

    async captureScreenshot(path: string) {
        await this.init();
        if (this.page) {
            await this.page.screenshot({ path });
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
    }
}
