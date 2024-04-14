// import FxdBrowser from '/Users/easy/Code/gitcode/fxd/packages/fxd-app-browser/index.js';
import FxdBrowser from 'fxd-app-browser';
import { FxdSdk, getPackageInfo } from 'fxd-sdk';
import { diffString, diff } from 'json-diff';


export default class FxdCheckChan extends FxdBrowser {
    constructor() {
        super();
        this.sdk = new FxdSdk(getPackageInfo(import.meta.url));
    }

    async main(args, opts, command) {
        return await this.check(args, opts, command);
    }

    async check(args, opts, command, force_silent = false) {
        this.setDefaultOpts(opts);
        this.setDefaultCommand(command);
        this.format = this.get('format');
        
        const ret = [];
        let ret_texts = '';
        let ret_htmls = '';
        // 是否使用 headless 模式
        const headless = this.get('headless');

        // 要检测的元素 CSS 选择器，多个选择器用逗号分隔
        const selectors = this.get('selectors') ? this.get('selectors').split(',') : ['body'];
        // process.exit(0);
        
        // URL
        const url = this.get('url');
        if (!url) this.echoError("url is required");

        const userDirFullPath = process.env.FXD_USER_DIR || this.getUserDirFullPath(this.get('user'));

        const { browser, page, context } = await this.getBrowserAndMore(userDirFullPath, { headless });

        page.setDefaultTimeout(this.get('timeout')); // 设置超时
        await page.goto(url);// 打开URL
        // console.log('goto', url);
        await page.waitForLoadState( this.get('wait_type')); // 确保页面加载完成
        // console.log('waitForLoadState', 'networkidle end');

        // 执行自定义 playwirght 代码
        const preplay = this.get('preplay');
        if (preplay) {
            // 定义一个异步函数，用于执行动态代码
            const asyncFn = new Function('page', 'context', `return (async () => {${preplay}})();`);

            // 执行异步函数
            await asyncFn(page, context);
        }

        // 执行自定义的 js 代码
        // @Todo 这个地方需要测试下，是否可以正常执行
        const prejs = this.get('prejs');
        const prejsArgs = this.get('prejs_args');
        if (prejs) {
            await page.evaluate(prejs, prejsArgs);
        }

        // 循环 selectors 数组，获取每个元素的 HTML、innerText
        for (const selector of selectors) {
            let elements = await page.locator(selector).all();
            // console.log('elements', elements.length);
            
            if (!this.get('list')) elements = [elements[0]];
            let htmls = [], texts = [];
            // 循环每个元素，push HTML、innerText
            for (const element of elements) {
                if(!element) continue;
                htmls.push(await element.innerHTML());
                texts.push(await element.innerText());
            }

            const html = htmls.join('\n');
            const text = texts.join('\n');

            ret.push({ selector, html, text, meta: { html: htmls, text: texts } });

            if (html) ret_htmls += '\n\n' + html;
            if (text) ret_texts += '\n\n' + text;
        }

        // 关闭浏览器
        // await context.close();
        await browser.close();

        // 输出中间数据
        this.log('检测到的数据', JSON.stringify(ret, null, 2));

        return this.return({
            merged_html: ret_htmls,
            merged_text: ret_texts,
            output: ret_texts,
            data: [...ret],
        }, force_silent)
    }

    async watch(args, opts, command, force_silent = false) {
        const ret = await this.check(args, opts, 'check', true); // 为了不输出结果，这里强制 force_silent 为 true

        // 借用 check 命令的参数设置
        const url = this.get('url');
        const title = this.get('task_title') || this.sdk.displayName;
        const icon = this.get('task_icon') || '/logo.svg';

        // 切换为 watch 命令的设置
        this.setDeaultCommand(command);

        // 获取上一次的结果
        const urlSHA = this.sdk.sha1(url);
        const lastRet = await this.sdk.getValue(urlSHA);
        // 保存本次结果
        await this.sdk.setValue(urlSHA, ret);

        if (!lastRet) {
            this.log("不存在历史记录，将当前结果保存为历史记录");
        } else {
            // 比较两次结果
            if (diff(lastRet, ret)) {
                const differenceString = diffString(lastRet, ret);
                const differenceText = diffString(lastRet, ret, { color: false });
                this.log("检测到变动", differenceString);

                const markdown_body = `\`\`\`diff
${differenceText}
\`\`\``;

                // 如果 opts.sendkey 存在，则发送到指定的 key
                const sendkey = this.get('sendkey');
                if (sendkey) {
                    const send_ret = await this.sdk.scSend(`${title} 有新的动态`, markdown_body, sendkey);
                    this.log("存在sendkey，发送结果到Server酱", send_ret);
                }

                const apprise_server_url = this.get('apprise_server_url');
                if (apprise_server_url)
                {
                    // apprise -t '你好' -b '[hello](http://ftqq.com)' -i 'markdown'  'schan://SCT1T...'
                    // 调用命令行
                    const send_ret = await this.sdk.apprise(apprise_server_url, `${title} 有新的动态`, markdown_body, 'markdown');
                    this.log("存在apprise_server_url，发送结果到Apprise", send_ret);
            
                }

                // 如果 opts.feed_publish 存在，则发布到 feed
                const feed_publish = this.get('feed_publish');
                if (feed_publish) {
                    const feed_ret = await this.feedPublish( `${ret.merged_text} \n\n[链接](${url})`, ret , this.get('feed_as_public'), command, title, icon);

                    this.log("发布结果到feed列表", feed_ret);
                }
                

                return this.return({
                    "message": "检测到变动",
                    "diff": differenceText,
                    "action": "changed",
                    "data": ret,
                    "output": ret.merged_text,
                }, force_silent);
            } else {
                this.log("目标数据没有变化");
                return this.return({ "message": "目标数据没有变化", "action": "unchanged", "output": ret.merged_text }, force_silent);
            }
        }
    }
}

