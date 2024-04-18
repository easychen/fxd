# What is FXD?

[ [中文](./README.zh-cn.md) | [English](./README.md) ]

![](images/20240414114221.png)

FXD stands for Flow eXtension Define, a specification designed for extending workflows, especially AI and automation workflows.

[FXD Official Manual](https://ft07.com/fxd/)

For instance, if you need to monitor the latest articles from an RSS feed, translate them into Chinese, create accompanying images, and then post them on your own platform X, this task isn't difficult for AI, but few tools can automate it due to the multiple steps involved.

With the FXD approach, we would first encapsulate the following FXD Apps:

-   RSS Monitoring App
-   GPTChat App
-   DALL-E App
-   X Publishing App

Each of these is an independent NPM package, and each app can be invoked via the Fxd-Cli in the command line. Thus, by using Shell or other scripts to combine these FXD Apps, you can flexibly implement various functionalities. For example, if you want to switch from publishing on platform X to Weibo, you simply need to swap the last app.

For users unfamiliar with using the command line, there's also a client compatible with the FXD standard, such as our currently beta-tested FlowDeer, which helps users design workflows using visual flowcharts.

# Development Environment

## Command Line Debugging

This repository uses Yarn workspaces to manage multiple packages. Run the following at the root directory:

```bash
yarn install
```
<details>
<summary>Solution for Windows unable to load file **Roaming\npm\yarn.ps1</summary>
This is due to a policy restriction error. Please resolve it by following these steps:

1. Search for PowerShell, right-click to run as administrator
1. Enter `Set-ExecutionPolicy RemoteSigned` and then choose Y
1. Close PowerShell and rerun the yarn command
</details>

Then, enter the command line directory:
```bash
cd packages/fxd-cli
```

On Unix-like systems, use the directory's ./fxd as a command line tool:

```bash
# View help
./fxd core help

# View Demo app help
./fxd demo help
```
On Windows, manually add the node command prefix:

```bash
# View help
node fxd core help

# View Demo app help
node fxd demo help
```

You can create a copy of `fxd-app-demo` to modify and debug. After completion, `npm publish fxd-app-your-app` to make it available in all software supporting the FXD standard.

## Debugging in FlowDeer

By default, FlowDeer installs packages directly from the NPM website, but sometimes we need to debug before publishing. Here's a solution:

Since FlowDeer will prioritize local directory searches, you can install your package locally by running npm install <package-path> in the corresponding directory in FlowDeer via the command line.

Specifically for macOS:

```bash
cd /Applications/FlowDeer.app/Contents/Resources/app.asar.unpacked/src/local-api
npm install path/to/your/package
```

If FlowDeer is not installed in the Applications directory, adjust the path accordingly for Windows systems:

```bash
cd <FlowDeer directory>/resources/app.asar.unpacked/src/local-api
npm install path/to/your/package
```

After installation, add the package name in the FlowDeer interface.

# License

The FXD SDK, command line tools, and core packages are licensed under the PolyForm Noncommercial License. If the packages directory contains a different License, the latter prevails.

Any code contributed to this project is deemed authorized for commercial use by the project authors and their company, and distributed under the project's license (PolyForm Noncommercial License).

The PolyForm Noncommercial License allows you to modify the project and distribute it for any non-commercial purposes. During distribution, ensure that the user receives a copy of the license agreement and is aware of copyright attribution to "Fangtang Balloon". Read the license file for more detailed information.

The licensing of your FXD-based app (like fxd-app-demo) is determined by you, but distribution must still comply with the license. For example:

1. If you have created fxd-app-demo and licensed it under the MIT License, you can handle the code of fxd-app-demo under your chosen protocol.
2. If you guide users to install and use fxd-app-demo through fxd-cli, there is no need to comply with the project's protocol.
3. If you package the fxd-cli and fxd-sdk codes as a product for distribution, then you must comply with the project's protocol.