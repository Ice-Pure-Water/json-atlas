# Security policy / 安全政策

## Supported versions / 支持版本

Security fixes are applied to the latest source on the default branch. There are no published release branches yet.

安全修复以默认分支上的最新代码为准。目前尚无独立维护的发布分支。

## Reporting a vulnerability / 报告安全问题

Please do not report exploitable vulnerabilities in a public issue. Use GitHub's **Report a vulnerability** action on this repository to send a private security advisory to the maintainers. Include the affected version or commit, reproduction steps, impact, and any proposed fix. We will acknowledge reports and coordinate a fix before public disclosure when practical.

请不要在公开 Issue 中披露可利用的漏洞。请使用本仓库 GitHub 页面中的 **Report a vulnerability** 私下提交安全公告，并尽量附上受影响版本或提交、复现步骤、影响范围及修复建议。条件允许时，我们会先确认并协调修复，再公开披露。

## Privacy boundary / 隐私边界

The application parses and edits documents in the browser and has no application API for uploading them. A deployment host can still receive ordinary HTTP metadata such as IP address and requested asset paths; hosting-provider logs and policies are outside this repository's control. Do not treat the local-first design as a guarantee about the hosting provider.

应用在浏览器中解析和编辑文档，没有用于上传文档的应用接口。部署服务仍可能收到 IP 地址、请求的静态资源路径等常规 HTTP 元数据；托管方日志及其政策不由本仓库控制。请勿将本地处理设计理解为托管服务隐私保证。
