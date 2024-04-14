// import FxdApp from '/Users/easy/Code/gitcode/fxd/packages/fxd-app-core/index.js';
import FxdApp from 'fxd-app-core';
import { FxdSdk, getDirname, getHomeDir } from 'fxd-sdk';
import { readPackageSync } from 'read-pkg';
import path from 'path';
import { chromium, firefox, webkit } from 'playwright';
import chalk from 'chalk';

export default class FxdBrowser extends FxdApp {
    constructor() {
        super();
        this.sdk = new FxdSdk(readPackageSync({ cwd: getDirname(import.meta.url) }));
    }

    getUserDirFullPath(username) {
        return path.resolve(getHomeDir(), 'user', username);
    }

    async getBrowserAndMore( userDirFullPath, options )
    {
        if( process.env.FXD_LOCAL_CHROME ) options.executablePath = process.env.FXD_LOCAL_CHROME;
        const browserType = options.browserType  || process.env.FXD_BROWSER_TYPE || 'chromium';
        const Browser = (browserType === 'firefox' ) ? firefox  :  ( browserType === 'webkit' ) ? webkit : chromium;
        const browser =  await Browser.launchPersistentContext(userDirFullPath, options);
        // 如果打开了页面，且页面为 blank，则重用页面
        const openedPages = browser.pages().find( page => page.url() === 'about:blank' ) ;
        const page = openedPages || await browser.newPage();
        const context = page.context();

        return { browser, page, context };
    }

    async main(args, opts, command) {
        this.log(chalk.red("FxdBrowser 公用库，为基于无头浏览器的服务提供基础，不可直接运行"));
        return false;
    }

    


}

