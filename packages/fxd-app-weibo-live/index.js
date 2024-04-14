import { FxdSdk, getPackageInfo } from 'fxd-sdk';
import FxdKeepLive2 from 'fxd-app-keep-live2';


export default class FxdWeiboLive extends FxdKeepLive2 {
    constructor() {
        super();
        this.sdk = new FxdSdk(getPackageInfo(import.meta.url));
        // ...
    }

    async main(args, opts, command, cli_path) {
        return this.help();
    }

    async auth(args, opts, command) {
        // 指定 authurl
        opts['auth_url'] = 'https://m.weibo.cn';
        return super.auth(args, opts, command);
    }

    async refresh(args, opts, command) {
        // 指定 refreshurl
        opts['refresh_url'] = 'https://m.weibo.cn';
        return super.refresh(args, opts, command);
    }

    async check(args, opts, command) {
        // 指定 checkurl
        opts['check_url'] = 'https://m.weibo.cn/profile';
        opts['check_selector'] = 'div.profile-header';
        return super.check(args, opts, command);
    }
}
