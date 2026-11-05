# 拾词 · Render 免费分享版

这个版本使用现有的 60 篇六级精读、查词词典、收藏词库、学习进度和 34 道作文真题。
词库、进度和作文草稿存于当前浏览器。作文可以下载为 JSON，带去对话批改。
这个部署包不含网站的云端作文、登录和数据库。

## 发布

1. 解压，把 `public` 文件夹和本说明放进一个你自己的 GitHub 仓库。可以使用私有仓库。
2. 登录 Render，连接这个 GitHub 仓库。在 Render 新建 **Static Site**，选中仓库和分支。
3. **Build Command** 填 `true`，**Publish Directory** 填 `public`，**Root Directory** 留空。
4. 发布后，用不打开 VPN 的设备测试 Render 提供的 `onrender.com` 地址。

免费额度及部署规则参见 https://render.com/docs/static-sites 。
