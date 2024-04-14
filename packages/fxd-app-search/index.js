import FxdBrowser from 'fxd-app-browser';
import { FxdSdk, getPackageInfo } from 'fxd-sdk';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
const turndownService = new TurndownService();


export default class FxdDemo extends FxdBrowser {
    constructor() {
        super();
        this.sdk = new FxdSdk(getPackageInfo(import.meta.url));
        // ...
    }

    async main(args, opts, command) {
        this.setDefaultOpts(opts);
        this.setDefaultCommand(command);
        this.format = this.get('format');
        const query = this.get('query');
        const sites = this.get('sites')?this.get('sites').split(','):[];
        const headless = this.get('headless');
        const { page, browser } = await this.getBrowserAndMore(this.getUserDirFullPath(this.get('user')), { headless });
        page.setDefaultTimeout(this.get('timeout')); // 设置超时

        const url = 'https://www.google.com/search?q=' + encodeURIComponent(sites ? sites.map( site => `site:${site}` ).join(' ') + ' filetype:md OR filetype:html ' + query : ' filetype:md OR filetype:html ' + query);
        await page.goto(url);// 打开URL
        await page.waitForLoadState( this.get('wait_type')); 

        let results_all = await page.evaluate(() => {
            let data = [];
            let elements = document.querySelectorAll('.g');
            for (var element of elements) {
                let title = element.querySelector('a').innerText?.trim();
                let link = element.querySelector('a').href;
                let snippet = element.innerText.trim().split('\n').pop();
                data.push({title, link, snippet});
            }
            return data;
        });
        // 等待1秒
        await page.waitForTimeout(1000);
        await browser.close();

        let results = results_all.slice(0,this.get("result_limit"));
        // 去掉 link 重复的
        results = results.filter((item, index, self) =>
            index === self.findIndex((t) => (
                t.link === item.link.trim()
            ))
        );
        this.log(results);
        
        if( !this.get("result_extend") ) return this.return({results});
        
        let extended_results = [];
        for (let result of results) {
            let markdown = await this.fetch(result.link, this.get('result_length'));
            if (markdown) {
                result.markdown = markdown;
                extended_results.push(result);
            }
        }
        this.log(extended_results);
        return this.return({results:extended_results});

    }

    async fetch(url, length = 3000, timeout = 20*1000)
    {
        // 首先验证 url 是否是一个合法的 url
        if( !url.match(/^https?:\/\//) ) return '';
        
        try {
            const { page, browser } = await this.getBrowserAndMore(this.getUserDirFullPath(this.get('user')), { headless: this.get('headless') });
            page.setDefaultTimeout(timeout); // 设置超时

            // page 超时后关掉浏览器
            page.on('pageerror', async (err) => {
                await browser.close();
                this.log(err);
                return '';
            });

            await page.goto(url);// 打开URL
            await page.waitForLoadState( this.get('wait_type')); 
            const html = await page.content();
            await browser.close();
            // 使用 Readability 解析 html
            const dom = new JSDOM(html, { url } );
            const reader = new Readability(dom.window.document);
            const article = reader.parse();
            let markdown = false;
            
            if (article && article.content) {
                markdown = turndownService.turndown(article.content);
            } else {
                if (dom.window.document) 
                {
                    markdown = turndownService.turndown(dom.window.document);
                }
            }
            
            return markdown ? ( length ? markdown.substring(0, length) : markdown) : '';
        } catch (error) {
            return '';
        }
    }
}
