墨森工具中心完整迁移备份
========================

用途：
当原 GitHub 账号、邮箱或仓库无法使用时，可把完整备份 ZIP 上传给新的 GPT，让它在新的 GitHub 仓库中恢复出同样的一套工具中心。

重要说明：
1. 备份应包含当前仓库中的网页、JS、自动部署工作流、模板目录、排序配置及其它资源。
2. 不包含任何 GitHub Personal Access Token、密码或登录凭据。
3. 新仓库部署后，GitHub Pages 地址通常为：https://<新用户名>.github.io/<新仓库名>/
4. shared-order.js 目前写有旧仓库 owner/repo：mosen6266-netizen/mosen6266。迁移时必须改成新的 GitHub 用户名和新仓库名，否则“全局排序保存”仍会指向旧仓库。
5. global-order.json 保存当前公共排序，迁移时应原样保留。
6. templates/ 中的 DOCX 模板及 templates/index.json 应一并保留。
7. .github/workflows/pages.yml 是自动构建与发布逻辑，必须保留。
8. site_parts/ 是当前网页构建依赖，必须一并保留。

推荐恢复流程：
A. 新建一个空 GitHub 仓库，默认分支 main。
B. 把备份 ZIP 解压后的所有文件保持原目录结构上传到新仓库根目录。
C. 修改 shared-order.js：OWNER = '<新用户名>'，REPO = '<新仓库名>'，BRANCH = 'main'。
D. 检查 .github/workflows/pages.yml 是否仍引用正确文件路径。
E. 在 GitHub 仓库 Settings -> Pages 中启用 GitHub Pages，并按仓库当前结构设置 main 分支发布。
F. 等待 Actions 和 Pages 部署成功。
G. 打开新 Pages 地址，检查工具中心、所有工具、DOCX 模板、国旗、拖拽排序、全局排序、输出文件名选择等功能。
H. 如需从网页保存全局排序，为新仓库重新创建 Fine-grained personal access token，只给该仓库 Contents: Read and write 权限。不要复用或上传旧 token。

