import FxdBrowser from 'fxd-app-browser';
import { FxdSdk, getPackageInfo } from 'fxd-sdk';
import dayjs from 'dayjs';
import path from 'path';
import fs from 'fs';
import download from 'download';

export default class FxdWeiboPublish extends FxdBrowser {
    constructor() {
        super();
        this.sdk = new FxdSdk(getPackageInfo(import.meta.url));
    }

    async publish(args, opts, command) {
        this.setDefaultOpts(opts);
        this.setDefaultCommand(command);
        this.format = this.get('format');

        const url = 'https://m.weibo.cn/compose/'; // 微博发布页面URL
        const content = this.get('content') // 从命令行选项中获取微博内容
        let images  = this.get('images') ;
        images = images ? images.split(',') : []// 从命令行选项中获取微博图片
        
        const self_only = this.get('self_only') // 从命令行选项中获取微博图片
    
        if (!content) {
            console.error('微博内容不能为空');
            return;
        }
    
        const { browser, page } = await this.getBrowserAndMore(this.getUserDirFullPath(this.get('user')), { headless: this.get('headless'), browserType: this.get('browser')});
    
        try {
            await page.goto(url, { waitUntil: this.get('wait_type') });
            await page.waitForSelector('textarea');
            await page.evaluate( (content) => {
            document.querySelector('textarea').value = content;
            document.querySelector('textarea').dispatchEvent(new Event('input'));
            }, content);

            // 图片
            if( self_only )
            {
                const element = await page.waitForSelector('footer div.visible');
                await element.click();
                await element.click();      
            }

            if( images.length > 0 )
            {
                // 确保临时目录存在
                const tmp_dir = path.join( "/tmp", this.sdk.name );
                if( !fs.existsSync(tmp_dir) ){
                    fs.mkdirSync(tmp_dir);
                }
                this.log("tmp_dir", tmp_dir);
                // const upload_input = await page.waitForSelector('input#selectphoto', { visible: false });
                for (let i = 0; i < images.length; i++) {
                    let image = images[i].trim();
                    this.log("deal with image", image)
                    // 如果是网络图片，先下载到本地
                    if( image.startsWith('http') )
                    {
                        // 根据url获得文件扩展名
                        const ext = path.extname(image)??'.jpg';
                        this.log( "ext", ext );
                        if( ext == '.mp4' ) continue;
                        
                        const filename = `${dayjs().format('YYYYMMDDHHmmss')}_${i}${ext}`;
                        await download(image, tmp_dir, {filename});
                        image = path.join(tmp_dir, filename);
                        this.log("local image path", image);
                    }

                    await page.setInputFiles('input#selectphoto', image);
                    // 等待图片上传完成
                    // 一张图等待5秒
                    await page.waitForTimeout(1000*5);
                }    
            }
            await page.click('.m-send-btn');
            
            // 监测浏览器的URL是否变化
            // await page.waitForNavigation({ timeout: this.get('timeout'), waitUntil: this.get('wait_type') });
            await page.waitForURL('about:blank', { timeout: this.get('timeout') });

            // 转向到用户主页查看是否发布成功
            await page.goto('https://m.weibo.cn/profile', { waitUntil: this.get('wait_type') });

            await page.waitForSelector('.wb-item span.time', { timeout: 1000*10 });
            const weiboTextArray = await page.evaluate(() => {
                let data = [];
                let elements = document.querySelectorAll('.wb-item');
                for (var element of elements) {
                    data.push( element.innerText );
                }
                return data;
            });
            await browser.close();
            let checked = false;
            // console.log(ret);
            for( const weiboText of weiboTextArray )
            {
                // 检查其中是否包含 刚刚 和微博正文的前5个字
                if( weiboText.includes('刚刚') && weiboText.includes(content.substring(0,5)) )
                {
                    checked = true;
                    break;
                }
            }


            this.log('微博发布成功');
            return this.return({ 'action': 'publish', 'message': 'done', 'output': String(content).substring(0,100) + '...', 'checked': checked});
        } catch (error) {
            console.error('发布微博时出错：', error);
            await browser.close();
            return this.return({ 'action': 'publish', 'message': 'error', 'error': error, 'output' : error.message });
        }
    }

    async main(args, opts, command) {
        return await this.publish(args, opts, command);
    }
}
