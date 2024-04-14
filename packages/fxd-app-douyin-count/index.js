// import FxdCheckChan from '/Users/easy/Code/gitcode/fxd/packages/fxd-app-check-chan/index.js';
import FxdCheckChan from 'fxd-app-check-chan';
import { FxdSdk, getPackageInfo } from 'fxd-sdk';

export default class FxdDouyinCoutn extends FxdCheckChan {
    constructor() {
        super();
        const oldArgsSettings = this.sdk.args;
        this.sdk = new FxdSdk(getPackageInfo(import.meta.url));
        this.sdk.args = this.mergeProps(oldArgsSettings,[
            'watch',
            'main|check|watch.-selectors,prejs,prejs_args,preplay,list'
        ]);
    }

    async main(args, opts, command) {
        opts['selectors'] = `[data-e2e='user-tab-count']`;
        return await this.watch(args, opts, 'watch');    
    }
}

