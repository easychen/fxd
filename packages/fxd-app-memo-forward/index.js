import FxdApp from 'fxd-app-core';
import { FxdSdk, getPackageInfo } from 'fxd-sdk';
import FxdWeiboPublish from 'fxd-app-weibo-publish';
import FxdXPublish from 'fxd-app-x-publish';
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
        // memos 不支持多 tag 查询，如果有多个tag，则直接不过滤（留到后边过滤）
        const tags_query = tags_array.length > 1 ? '' : tags_array.map(tag=>`&tag=${encodeURIComponent(tag)}`).join('');
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
            // console.log( url, ret, this.get('access_token') );
            if( ret && Array.isArray( ret ))
            {
                const memos = ret
                    .filter( item => item.visibility === 'PUBLIC')
                    .filter( item => {
                        // item.content 包含 tags 中的一个
                        if( tags_array.length === 0 )
                        {
                            return true;
                        }else
                        {
                            const ret11 = tags_array.some( tag => item.content.includes(`#${tag}`));
                            // if( ret11 ) console.log('ret11', item.content, 'contains', tags_array);
                            return ret11;
                        }
                    } )
                    .filter( item => {
                        return dayjs().diff(dayjs(item.updatedTs*1000), 'day') <= this.get('days')
                    }).reverse();

                // console.log( 'memos', memos.map( item => item.content ) );
                // return false;
    
                if( this.get('to') === 'weibo' )
                {
                    let published = false;
                    let nothing_new = true;
                    const urlSHA = this.sdk.sha1(this.get('api_base')); // 历史发布记录文件名
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
                        let result = false;
                        const extraImages= this.get('extra_images') ? this.get('extra_images').split(',')  : [];
                        const weibo_publish = new FxdWeiboPublish();
                        result = await weibo_publish.publish(null, {
                            content: content4weibo(memo.content , tags_array) + ( this.get('append_text') ? `\n\n${this.get('append_text')}` : '' ) ,
                            images: [...memo.resourceList?.map( item => {
                                if( String(item.type).startsWith("image") )
                                    return item.externalLink;
                                else
                                    return false;
                            }).filter( item => item ), 
                                ...extraImages
                            ].join(','),
                            self_only: String(this.get('self_only')),
                            headless: String(this.get('headless')),
                            user: this.get('user'),
                            format: 'function',
                            browser: this.get('browser'),
                        }, 'publish');

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

                if( this.get('to') === 'x' )
                {
                    let published = false;
                    let nothing_new = true;
                    const urlSHA = this.sdk.sha1('x:'+this.get('api_base')); // 历史发布记录文件名
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
                        let result = false;
                        const extraImages= this.get('extra_images') ? this.get('extra_images').split(',')  : [];
                        const x = new FxdXPublish();
                        result = await x.publish(null, {
                            content: content4x(memo.content , tags_array) + ( this.get('append_text') ? `\n\n${this.get('append_text')}` : '' ) ,
                            images: [...memo.resourceList?.map( item => {
                                if( String(item.type).startsWith("image") )
                                    return item.externalLink;
                                else
                                    return false;
                            }).filter( item => item ), 
                                ...extraImages
                            ].join(','),
                            headless: String(this.get('headless')),
                            user: this.get('user'),
                            format: 'function',
                            browser: this.get('browser'),
                        }, 'publish');

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
                            output: `有新的内容发布到X了`
                        });
                    }else
                    {
                        return this.return({
                            published: false,
                            nothing_new: nothing_new,
                            output: `没有新的内容发布到X`
                        });
                    }
                }

                if( this.get('to') === 'subdeer' )
                {
                    // 将每一个通道单独计数
                    const urlSHA = this.sdk.sha1('subdeer:'+this.get('subdeer_channel_id')+":"+this.get('api_base')); // 历史发布记录文件名
                    // 读取之前的发布记录
                    let published_memos = await this.sdk.getValue(urlSHA) || [];

                    const memos_paragraphs = [];

                    for( let memo of memos )
                    {
                        if( published_memos && published_memos.includes(memo.id)) {
                            this.log("jump", memo.id);
                            continue;
                        }
                        
                        memos_paragraphs.push(memo);
                    }

                    if( memos_paragraphs.length < 1 )
                    {
                        this.log("no content to publish");
                        return this.return({
                            published: false,
                            nothing_new: 'true',
                            output: `没有新的内容发布Subdeer`
                        });
                    }else
                    {
                        const contents = memos_paragraphs.map( item => {
                            let ret = "";
                            // 将 feed.created_at 转换成本地时间
                            ret += '⏱ ' + dayjs(item.updatedTs*1000).format("MM-DD HH:mm") + "\n\n";
                            
                            ret += item.content.replaceAll(
                                new RegExp(
                                tags_array.map( tag => `#${tag}`).join('|'), 'g') , ''
                            ) + "\n\n";
                            
                            ret += item.resourceList?.map( item => {
                                if( String(item.type).startsWith("image") )
                                    return `![](${item.externalLink})\n\n`;
                                else
                                    return false;
                            } )
                            
                            return ret;
                        }).join( "\n---\n" )

                        const title = `[${dayjs().format("MMDD")}]SubDeer内容汇总${tags||""}`;

                        const token = this.get('subdeer_token');

                        const subdeer_api_url = "https://api.subdeer.cn/article/save";
                        
                        const subdeer_api_data = {
                            "token":token,
                            "title":title,
                            "content":contents,
                            "id":0
                        };

                        const ret2 = await fetch(subdeer_api_url, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization':'Bearer '+token,
                            },
                            body: JSON.stringify(subdeer_api_data),
                        });

                        const ret2_json = await ret2.json();
                        if( ret2_json && ret2_json.code == 0 && ret2_json.data.id )
                        {
                            // 将文章发布到指定的频道
                            const subdeer_api_url2 = "https://api.subdeer.cn/article/add2/channel";
                            const subdeer_api_data2 = {
                                aid:ret2_json.data.id,
                                cid:this.get('subdeer_channel_id'),
                            };
                            const ret3 = await fetch(subdeer_api_url2, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization':'Bearer '+token,
                                },
                                body: JSON.stringify(subdeer_api_data2),
                            });
                            const ret3_json = await ret3.json();
                            if( ret3_json && ret3_json.code == 0 )
                            {
                                // /article/push
                                // 发起推送
                                const subdeer_api_url3 = "https://api.subdeer.cn/article/push";
                                const subdeer_api_data3 = {
                                    caid: ret3_json.data.id,
                                };
                                
                                const ret4 = await fetch(subdeer_api_url3, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization':'Bearer '+token,
                                    },
                                    body: JSON.stringify(subdeer_api_data3),
                                });

                                const ret4_json = await ret4.json();

                                if( ret4_json && ret4_json.code == 0 )
                                {
                                    
                                    // 将本次合并发布的memos标记
                                    published_memos = [...published_memos, ...memos_paragraphs.map( item => item.id )];

                                    await this.sdk.setValue(urlSHA, published_memos);
                                    
                                    this.log("pushed", ret4_json.data);
                                    return this.return({
                                        published: true,
                                        nothing_new: true,
                                        output: `有新的文章推送到SubDeer了`
                                    });
                                }    
                            }
                        }

                        return this.return({
                            published: false,
                            nothing_new: false,
                            output: `出错了：${error.message}`
                        });

                    } 
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

function content4x( content, tags = [] )
{
    return content;
}

function content4weibo( content, tags = [] )
{
    // 去掉 html 标签
    // content = content.replace(/<p>(.+?)<\/p>/g, "$1\n\n");
    // content = content.replace(/<br\s*\/>/g, "\n");
    // content = content.replace(/<[^>]+>/g,"");

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
