**What is Fxd?**

[ [中文](./README.zh-cn.md) | [English](./README.md) ]

![](images/20240414114221.png)

Fxd stands for "Flow eXtension Define" and is a specification designed for extending workflows, especially AI and automation workflows.

For example, if you need to monitor the latest articles from an RSS feed, translate them into Chinese, create illustrations for them, and then publish them on your own platform, this task isn't difficult for AI, but due to the multiple steps involved, few tools can automate the entire process.

According to the Fxd approach, we would first encapsulate several Fxd Apps:

- RSS Monitoring App
- GPTChat App
- DALL-E App
- X Publishing App

Each of these is an independent NPM package, and each app can be called via the Fxd-Cli on the command line. Thus, by using Shell or other scripts to combine these Fxd Apps, various functionalities can be flexibly implemented. For instance, if you decide not to publish to the original platform but to Weibo instead, you simply replace the last app.

For users unfamiliar with using command lines, there is also a client compatible with the Fxd specification, such as the FlowDeer we are currently beta testing, which helps users design workflows through a visual flowchart.

Translation to English:

Development Environment
------

This Repo utilizes Yarn workspaces to manage multiple packages. Run the following in the root directory:

```bash
yarn install
```
<details>
<summary>Solution for Windows not being able to load the file **Roaming\npm\yarn.ps1</summary>
This error is due to policy restrictions. Please follow these steps to resolve it:

1. Search for Powershell, right-click and run as administrator.
1. Enter `Set-ExecutionPolicy RemoteSigned` then choose Y.
1. Close PowerShell and rerun the yarn command.
</details>


Then navigate to the command line directory:
```bash
cd packages/fxd-cli
```

On Unix-like systems, use the ./fxd in the directory as a command-line tool:

```bash
# View help
./fxd core help

# View help for the Demo application
./fxd demo help
```
On Windows, manually add the node command prefix:

```bash
# View help
node fxd core help

# View help for the Demo application
node fxd demo help
```

You can create a copy of `fxd-app-demo` for modification and debugging. Once completed, publish it with `npm publish fxd-app-your-app` to make it available in all software supporting the FXD standard.

If you prefer not to publish your code to npm, you can also install it using `npm install <package-path>`.

**License**

The SDK, command-line tools, and core packages of FXD by default adopt the PolyForm Noncommercial License. If different licenses are included in the packages directory, the latter will prevail.

Any code contributed to this project is considered authorized for commercial use by the project authors and their companies, and distributed under the project's agreement (PolyForm Noncommercial License).

The PolyForm Noncommercial License allows you to modify the project and distribute it for non-commercial purposes. During distribution, it is necessary to ensure that the user receives a copy of the authorization agreement and is aware that the copyright belongs to "Fangtang Balloon". For more details, please read the license document.

The application you create based on FXD (like fxd-app-demo) is up to you to license, but distribution must still adhere to the agreement. For example:

1. If you create an fxd-app-demo and license it under the MIT license, you may handle the code of fxd-app-demo under your chosen protocol.
2. If you guide users to install and use fxd-app-demo through fxd-cli, there is no need to adhere to the project's protocol.
3. If you package the fxd-cli and fxd-sdk code as a product for distribution, then you must comply with the project's protocol.