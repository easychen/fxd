import FxdBrowser from 'fxd-app-browser';
import { FxdSdk, getPackageInfo } from 'fxd-sdk';
import path from 'path';
import fs from 'fs';

export default class FxdScreenshot extends FxdBrowser {
    constructor() {
        super();
        this.sdk = new FxdSdk(getPackageInfo(import.meta.url));
        // ...
    }

    async main(args, opts, command, cli_path) {
        this.setDefaultOpts(opts);
        this.setDefaultCommand(command);
        this.format = this.get('format');
        
        const url = this.get('url');
        // 不存在则使用当前目录
        const savePath = this.get('save_path') || path.join(process.cwd(), 'screenshot.png');
        const userDirFullPath = process.env.FXD_USER_DIR || this.getUserDirFullPath(this.get('user'));
        const { browser, page, context } = await this.getBrowserAndMore(userDirFullPath, { headless: this.get('headless'), browserType: this.get('browser'), deviceScaleFactor: this.get('scale')});
        // timeout
        page.setDefaultTimeout(this.get('timeout'));

        await page.setViewportSize({ 
            width:this.get('width'), 
            height:this.get('height')
        });
        await page.goto(url);
        await page.waitForLoadState(this.get('wait_type'));
        await page.screenshot({ 
            path: savePath, 
            fullPage: this.get('full_page')
        });
        await browser.close();
        // 检查文件是否存在
        return fs.existsSync(savePath) ? this.return({ action: 'screenshot', message: 'done', output: savePath }) : this.return({ action: 'screenshot', message: 'error', output: 'screenshot failed' });
    }
}
