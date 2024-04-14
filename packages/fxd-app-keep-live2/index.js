// import FxdBrowser from '/Users/easy/Code/gitcode/fxd/packages/fxd-app-browser/index.js';
import FxdBrowser from 'fxd-app-browser';
import {FxdSdk, getPackageInfo} from 'fxd-sdk'; 
import chalk from 'chalk';


export default class FxdKeepLive2 extends FxdBrowser {
    constructor() {
        super();
        this.sdk = new FxdSdk(getPackageInfo(import.meta.url));
    }

    async main(args, opts, command)
    {
        this.setDefaultOpts(opts);
        this.setDefaultCommand(command);
        this.format = this.get( 'format' );
        
        // keepLive2 --authUrl="https://passport.weibo.cn/signin/login" --refreshUrl="https://m.weibo.cn" --checkUrl="https://m.weibo.cn" --checkSelector="div.lite-iconf-msg" --timeout="5000"
        
        // 如果 check_url 存在，则执行 check；否则: (如果 refresh_url 存在，则执行 refresh；否则执行 auth)
        if( this.get('check_url') )
        {
            const ret = await this.check(args, {...opts, format:"json", silent: true}, command);
            // 根据检测结果，判断是刷新还是授权
            if( ret && ret.ret ) return await this.refresh(args, opts, command);
            else return await this.auth(args, {...opts, headless: false}, command);
        }else if( this.get('refresh_url') )
        {
            return this.refresh(args, opts, command);
        } else
        {
            console.log("auth_url", this.get('auth_url'));
            if( !this.get('auth_url') ) this.echoError("auth_url is required");
            return this.auth(args, opts, command);
        }
    }


    // 打开网页，访问页面，然后等待用户关闭
    async auth(args, opts, command) {
        this.setDefaultOpts(opts);
        this.setDefaultCommand(command);
        this.format = this.get( 'format' );
        
        
        // 使用 playwright 模拟浏览器打开网页，用户关闭浏览器后，自动退出
        const url = this.get( 'auth_url' );
        const userDirFullPath = process.env.FXD_USER_DIR || this.getUserDirFullPath(this.get('user'));

        const { browser, page } = await this.getBrowserAndMore(userDirFullPath, { headless: false, browserType: this.get('browser')});

        await page.goto(url);
        // 用户关闭page后，自动退出
        page.on('close', () => {
            browser.close();
            const retObj ={ 'action': 'auth', 'message': 'done', 'output':'authed manually' };
            return this.return(retObj,opts['silent']||false);
        });
    }

    async refresh(args, opts, command) {
        this.setDefaultOpts(opts);
        this.setDefaultCommand(command);
        this.format = this.get( 'format' );
        
        
        // 打开网页，访问页面，然后关闭
        const url = this.get( 'refresh_url' );
        const headless = this.get( 'headless' );
        const timeout = this.get( 'timeout' );

        const { browser, page } = await this.getBrowserAndMore(this.getUserDirFullPath(this.get('user')), { headless, browserType: this.get('browser') });

        await page.goto(url);
        // 设置超时
        page.setDefaultTimeout(timeout);
        // 等待页面加载完成
        await page.waitForLoadState('networkidle');
        // 关掉页面
        await page.close();
        // 关掉浏览器
        await browser.close();

        const retObj ={ 'action': 'refresh', 'message': 'done','output':'refreshed' };
        this.log("页面已刷新",retObj);
        return this.return(retObj);
    }

    async check(args, opts, command) {
        this.setDefaultOpts(opts);
        this.setDefaultCommand(command);
        this.format = this.get( 'format' );
        
        
        // 使用 playwright 模拟浏览器打开网页，监测selector是否包含特定文字
        const url = this.get( 'check_url' );
        const selector = this.get( 'check_selector' );
        const text = this.get( 'check_text' );

        const headless = this.get( 'headless' );
        
        const { browser, page } = await this.getBrowserAndMore(this.getUserDirFullPath(this.get('user')), { headless, browserType: this.get('browser')});
        // 设置超时
        page.setDefaultTimeout(this.get( 'timeout' ));
        
        await page.goto(url);
        // 等待 selector 出现
       //  await page.waitForSelector(selector, { timeout: this.get( 'timeout' )  });
       // 等待页面加载完成
        await page.waitForLoadState('networkidle');
        this.log("页面加载完成");
        // 使用 locator 获取 selector 的文字
        const locator = page.locator(selector);
        // 获得 locator 对应的 html
        const count = await locator.count();
        this.log("locator", locator, count);
        let selectedText;
        // 用 allTextContents 是为了获得dom包含的所有文字（包括子元素的）
        if( count > 0 ) selectedText = (await locator.allTextContents()).join(' ');
        this.log("selectedText", selectedText);
        // 如果 selector 的文字包含 text，则返回 true
        let ret = false;
        if( text && text.length > 0 &&  selectedText.includes(text) ) ret = true;
        if( (!text || text.length < 1) && count > 0 ) ret = true;
        await browser.close();
        if( this.get( 'format' ) == 'json' )
        {
            const retObj = {
                url,
                selector,
                text,
                count,
                selectedText,
                ret,
                'output':ret?'success':'failed'
            };
            this.log(JSON.stringify(retObj, null, 4));
            return this.return(retObj,opts['silent']||false);
        }else
        {
            this.log("检测结果", ret ? chalk.green('成功') : chalk.red('失败'));
        }
    }
}