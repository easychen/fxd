What is Fxd? 
------

[ [中文](./README.zh-cn.md) | [English](./README.md) ]

Fxd stands for Flow eXtension Define, a specification designed for the extension of workflows, particularly AI and automation workflows.

[FXD Handbook](https://ft07.com/fxd/)

For instance, suppose you need to monitor the latest articles from an RSS feed, translate them into Chinese, create illustrations for them, and then post them on your own platform X. This task is not difficult for AI, but due to the multiple steps involved, few tools can automate it entirely.

Following the Fxd approach, we would first encapsulate the following Fxd Apps:

-   RSS Monitoring App
-   GPTChat App
-   DALL-E App
-   X Publishing App

Each of these is an independent NPM Package, and each app can be invoked using Fxd-Cli from the command line. By using Shell or other scripts to combine these Fxd Apps, you can flexibly implement various functionalities. For example, if you decide not to post to platform X but to Weibo instead, you simply replace the last app.

For users unfamiliar with command lines, there is also the option to use an Fxd-compatible client, such as the FlowDeer we are currently beta testing, which helps users design workflows through a visual flowchart interface.







