import FxdApp from 'fxd-app-core';
import { FxdSdk, getPackageInfo } from 'fxd-sdk';
import { extract } from '@extractus/feed-extractor';
import dayjs from 'dayjs';
import { HttpsProxyAgent } from 'https-proxy-agent';

export default class FxdRssFetch extends FxdApp {
    constructor() {
        super();
        this.sdk = new FxdSdk(getPackageInfo(import.meta.url));
        // ...
    }

    async main(args, opts, command, cli_path) {
        this.setDefaultOpts(opts);
        this.setDefaultCommand(command);
        this.format = this.get('format');
        const proxyObject = this.get('proxy') ? {agent:new HttpsProxyAgent(this.get('proxy'))} : {};

        try {
            const url = this.get('url');
            const feed = await extract(url, {
                getExtraEntryFields: (feedEntry) => {
                    // console.log("feedEntry",feedEntry);
                    return { 'content': feedEntry.content && feedEntry.content['#text'] ? turndownService.turndown(feedEntry.content['#text']) : "" };
                }
            },{
                signal: AbortSignal.timeout(this.get('timeout')),
                ...proxyObject
            });

            if( this.get('only_changed') && feed.entries && feed.entries.length > 0)
            {
                const urlSHA = this.sdk.sha1(`rss-fetch:${url}`);
                // console.log("urlSHA", urlSHA);
                const newFeedIdArray = [];
                const newEntries = [];
                const sentFeeds = await this.sdk.getValue(urlSHA)||[];
                // 如果 feed.entries 的 item.id 不在 sentFeeds 里，则加入 newEntries；否则加入 oldEntries
                for( const entry of feed.entries )
                {
                    if( !sentFeeds.includes(entry.id) )
                    {
                        newEntries.push(entry);
                        newFeedIdArray.push(entry.id);
                    }
                }

                // console.log("newFeedIdArray", newFeedIdArray);

                if( newEntries.length > 0 )
                {
                    feed.entries = newEntries;
                    feed.changed = true;
                    await this.sdk.setValue(urlSHA, [...newFeedIdArray,...sentFeeds]);

                    if( this.get('sendkey') )
                    {
                        let markdown = ``;
                        for( const entry of newEntries )
                        {
                            markdown += `### ${entry.title}\n\n${entry.description}\n\n${dayjs(entry.pubDate).format('YYYY-MM-DD HH:mm:ss')}\n\n[查看网页](${entry.link})\n\n---\n\n`;
                        }
                        this.sdk.scSend(`${feed.title}有更新`, markdown, this.get('sendkey'));
                    }

                }else
                {
                    feed.entries = [];
                    feed.changed = false;
                }
            }

            feed.only_changed = this.get('only_changed');
            const result = {feed, output: feed.changed ? 'changed' : 'unchanged'};

            this.log(JSON.stringify(result, null, 4));
            return this.return(result);
            
        } catch (error) {
            this.echoError(error);    
        }

        
        
    }
}
