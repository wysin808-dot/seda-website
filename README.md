# BCI 自媒体矩阵获客系统原型

这是 BCI 自媒体矩阵获客管理系统的静态原型，用于团队讨论页面结构、字段和工作流。

## 本地预览

```bash
python3 -m http.server 4175 --bind 127.0.0.1
```

打开：

```text
http://127.0.0.1:4175/
```

## 云端部署

当前版本可以作为静态站点部署到：

- Vercel
- Netlify
- Cloudflare Pages
- GitHub Pages

推荐先用 Vercel：

1. 新建 GitHub 仓库
2. 上传当前项目
3. 登录 Vercel
4. Import Git Repository
5. 选择该仓库
6. Framework Preset 选择 Other
7. Build Command 留空
8. Output Directory 留空或使用根目录
9. Deploy

## 当前限制

这是静态原型：

- 默认仍可用浏览器本地保存；配置 Supabase 后，新建资料 / 内容 / IP / 账号 / 发布归档会写入云端数据库
- 不支持真实登录
- 不支持多人同时编辑
- 上传图片/视频只是表单展示，不会真正存储

## Supabase 数据库上线

1. 在 Supabase 新建项目
2. 打开 SQL Editor，执行 `docs/supabase-mvp-launch.sql`
3. 在 Vercel Project Settings → Environment Variables 添加：
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
4. 重新部署 Vercel

当前 MVP 会把以下记录写入 Supabase：

- 真实资料库
- 内容资产库
- IP 矩阵
- 账号矩阵
- 今日发布归档

下一步真实多人协作版本建议继续加入：

- Supabase Auth 登录
- 角色权限 RLS
- Supabase Storage / 阿里云 OSS / Cloudflare R2 文件上传
