// import FxdBrowser from '/Users/easy/Code/gitcode/fxd/packages/fxd-app-browser/index.js';
import FxdBrowser from 'fxd-app-browser';
import { FxdSdk, getPackageInfo, myFetch, jsonDecode  } from 'fxd-sdk';
import TurndownService from 'turndown';
const turndownService = new TurndownService();
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import sanitizeHtml from 'sanitize-html';

export default class FxdFetch extends FxdBrowser {
    constructor() {
        super();
        this.sdk = new FxdSdk(getPackageInfo(import.meta.url));
    }

    async main(args, opts, command) {
        this.setDefaultOpts(opts);
        this.setDefaultCommand(command);
        this.format = this.get('format');  

        // URL
        const url = this.get('url');
        if (!url) this.echoError("url is required");
        
        const headless = this.get('headless');
        const { page, browser } = await this.getBrowserAndMore(this.getUserDirFullPath(this.get('user')), { headless, browserType:this.get('browser') });

        page.setDefaultTimeout(this.get('timeout')); // 设置超时
        await page.goto(url);// 打开URL
        await page.waitForLoadState( this.get('wait_type'));
        
        if( this.get('delay') > 0 )
        {
            // 等待 delay ms
            await page.waitForTimeout(this.get('delay'));
        }

        const html = await page.content();
        // 使用 Readability 解析 html
        const dom = new JSDOM(html, { url } );
        const reader = new Readability(dom.window.document);
        const article = reader.parse();
        const contentHtml = article.content || dom.window.document.body.innerHTML;

        const element = page.locator('body').first();
        let ret;
        switch( this.get('output') )
        {
            case 'raw':
                ret = await element.innerHTML();
                this.log(ret);
                break;
            case 'markdown':
                // 使用 turndown 实现 html to markdown
                ret = turndownService.turndown(contentHtml);
                this.log(ret);
                break;
            case 'readable':
                ret = contentHtml;
                this.log(ret); 
                break;
            // 注意这个 html 是简化版本的，仅用于编写selector
            case 'html':
                ret = normalizeWhitespace(sanitizeHtml(await element.innerHTML(), {
                    allowedAttributes: {
                        '*': [ 'id', 'class', 'data-*' ]
                    },
                    enforceHtmlBoundary: true,
                }));
                this.log(ret); 
                break;
            case 'text':
            default:
                ret = await element.innerText();
                this.log(ret); 
        }

        // 关闭浏览器
        await browser.close();

        return this.return({"content_format": this.get('output'), "content": ret});

    }

    async json(args, opts, command) {
        this.setDefaultOpts(opts);
        this.setDefaultCommand(command);
        this.format = this.get('format');  
        const timeout = this.get('timeout');

        // URL
        const url = this.get('url');
        if (!url) this.echoError("url is required");

        // 直接通过 fetch 获取内容
        const response = await myFetch(url, {}, timeout);
        const text = await response.text();
        const content = jsonDecode(text) || text;
        return this.return({content});
    }
}

// 去掉连续空格和空行以节省token
function normalizeWhitespace(html) {
    // 将所有连续的空格替换为单个空格
    const normalizedSpaces = html.trim().replace(/(\s){2,}/g, '$1');
    return normalizedSpaces;
}
