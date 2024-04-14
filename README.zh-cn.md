Fxd是什么
------

[ [中文](./README.zh-cn.md) | [English](./README.md) ]

Fxd 是 Flow eXtension Define 的缩写，它是一个被设计用于工作流（尤其是AI和自动化工作流）扩展的规范。

[FXD官方手册](https://ft07.com/fxd/)

比如说，你需要从RSS中监测最新文章，然后翻译为中文，并为其配图后，发布到自己的X上边。这个任务对AI来讲并不困难，但因为环节较多，很少有工具可以自动化完成。

按Fxd的做法，我们会首先封装以下几个Fxd App：

-   RSS监测 App
-   GPTChat APP
-   DALL-E APP
-   X发布APP

其中每一个都是独立的 NPM Package，而且每一个 APP 都可以通过 Fxd-Cli 在命令行下调用。这样，我们只需要用 Shell 或者其他脚本，将这些 Fxd App 组合起来，就可以灵活地实现各种功能。比如你不想发布到X了，改为发布到微博。那么只需要将最后一个APP 换掉。

对于不会使用命令行的用户，还可以使用兼容 Fxd 规范的客户端，比如我们正在内测的 FlowDeer，它可以通过可视化流程图的方式帮助用户设计工作流。

License
------

FXD 的SDK、命令行工具和核心包默认采用 PolyForm Noncommercial License,如 packages 目录下包含不同的 License，则以后者为准。

任何贡献到本项目的代码，均视为授权项目作者及其名下公司用于商业用途、并按本项目协议（PolyForm Noncommercial License）分发。

PolyForm Noncommercial License 允许您对本项目进行修改，并用于任何非商业目的分发。分发过程中，需要确保使用人获得授权协议副本，并知晓版权归属于「方糖气球」。更详细的说明请阅读授权文件。

您创建的基于 FXD 的应用（类似 fxd-app-demo ）由您自行决定授权，但分发时仍需遵守协议。举例而言：

1. 如果您创建了 fxd-app-demo 并以 MIT 协议授权，您可以按自定协议随意处理 fxd-app-demo 的代码
2. 如果您引导用户通过 fxd-cli 安装并使用 fxd-app-demo，亦无需遵守本项目的协议
3. 如果您将 fxd-cli 和 fxd-sdk 代码打包为一个产品进行分发，那么则需要遵守本项目的协议