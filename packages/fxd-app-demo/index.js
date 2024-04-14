import FxdApp from 'fxd-app-core';
import { FxdSdk, getPackageInfo } from 'fxd-sdk';



export default class FxdDemo extends FxdApp {
    constructor() {
        super();
        this.sdk = new FxdSdk(getPackageInfo(import.meta.url));
        // ...
    }

    async main(args, opts, command, cli_path) {
        this.setDefaultOpts(opts);
        this.setDefaultCommand(command);
        this.format = this.get('format');
        console.log(this.sdk.name, command, args, opts, this.get('url', opts));
    }
}
