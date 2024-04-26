import FxdApp from 'fxd-app-core';
import { FxdSdk, getPackageInfo } from 'fxd-sdk';
import FxdWeiboPublish from 'fxd-app-weibo-publish';
import dayjs from 'dayjs';


export default class FxdMemoForward extends FxdApp {
    constructor() {
        super();
        this.sdk = new FxdSdk(getPackageInfo(import.meta.url));
        // ...
    }

    async main(args, opts, command, cli_path) {
        this.setDefaultOpts(opts);
        this.setDefaultCommand(command);
        this.format = this.get('format');
        const tags = this.get('tags');
        const tags_array = tags ? tags.split(','): [];
        const tags_query = tags_array.map(tag=>`&tag=${encodeURIComponent(tag)}`).join('');
        const url = this.get('api_base')+'/api/v1/memo?limit=10'+tags_query;

        try {
            const response = await fetch( url, 
            {
                headers: {
                    'Authorization': `Bearer ${this.get('access_token')}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                method:'GET',
            });
    
            const ret = await response.json();
            if( ret && Array.isArray( ret ))
            {
                const memos = ret
                    .filter( item => item.visibility === 'PUBLIC')
                    .filter( item => {
                        return dayjs().diff(dayjs(item.updatedTs*1000), 'day') <= this.get('days')
                    }).reverse();
    
                let published = false;
                let nothing_new = true;
                const urlSHA = this.sdk.sha1(url); // 历史发布记录文件名
                // 读取之前的发布记录
                const published_memos = await this.sdk.getValue(urlSHA) || [];
    
                for( let memo of memos )
                {
                    // 上一条成功发布，终止，每次只同步一条
                    if( published ) break;
                    if( published_memos && published_memos.includes(memo.id)) {
                        this.log("jump", memo.id);
                        continue;
                    }
                    nothing_new = false;
                    const to_weibo = this.get('to_weibo');
                    let result = false;
                    if( to_weibo )
                    {
                        const extraImages= this.get('extra_images') ? this.get('extra_images').split(',')  : [];
                        const weibo_publish = new FxdWeiboPublish();
                        result = await weibo_publish.publish(null, {
                            content: content4weibo(memo.content , tags),
                            images: [...memo.resourceList.map( item => {
                                if( String(item.type).startsWith("image") )
                                    return item.externalLink;
                                else
                                    return false;
                            }).filter( item => item ), 
                                ...extraImages
                            ].join(','),
                            self_only: this.get('self_only'),
                            headless: String(this.get('headless')),
                            user: this.get('user'),
                            format: 'function',
                            browser: this.get('browser'),
                        }, 'publish');
                    }
    
                    // 如果发布成功，则记录
                    if ( result && result.checked ) {
                        published = true;
                        // 保存发布记录
                        published_memos.push(memo.id);
                        await this.sdk.setValue(urlSHA, published_memos);
                        break;
                    }
    
                }

                if( published )
                {
                    return this.return({
                        published: true,
                        nothing_new: nothing_new,
                        output: `有新的内容发布到微博了`
                    });
                }else
                {
                    return this.return({
                        published: false,
                        nothing_new: nothing_new,
                        output: `没有新的内容发布到微博`
                    });
                }
            }

            
        } catch (error) {
            this.log(error);
            return this.return({
                published: false,
                nothing_new: true,
                output: `出错了：${error.message}`
            });
        }
        

       

    }
}

const bad_domains = ['pixabay.com','youtu.be'];

function content4weibo( content, tags = [] )
{
    // 去掉 html 标签
    content = content.replace(/<p>(.+?)<\/p>/g, "$1\n\n");
    content = content.replace(/<br\s*\/>/g, "\n");
    content = content.replace(/<[^>]+>/g,"");

    // 替换敏感域名，将域名中的 . 替换为 ·，避免被微博检测到
    for (let domain of bad_domains) {
        content = content.replace(new RegExp(domain, 'g'), domain.replace(/\./g, '·'));
    }

    // 将 #tag 替换为 #tag# 这是微博的独有语法
    for( let tag of tags )
    {
        content = content.replace(new RegExp('#'+tag+'(?![\w\-])', 'g'), '#'+tag+'#');
    }
    return content;
}
