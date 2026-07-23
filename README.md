# 项目管理工作台（Supabase 云端版）

这是一个无需后端服务器的静态网页。Supabase 提供邮箱密码登录、Postgres 数据库、行级安全（RLS）和实时同步；免费方案即可运行。

## 数据表结构

`public.projects` 是唯一的业务表：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `uuid` | 项目唯一 ID，自动生成 |
| `user_id` | `uuid` | 关联 `auth.users.id`，用于隔离每位用户的数据 |
| `name` | `text` | 项目名称 |
| `project_type` | `text` | 项目类型 |
| `contact` | `text` | 联系人 |
| `bid_date` | `date` | 开标日期 |
| `guarantee` | `text` | 保证金/保函 |
| `status` | `text` | `报名中`、`制作中` 或 `已开标` |
| `notes` | `text` | 可选备注 |
| `created_at` / `updated_at` | `timestamptz` | 创建与最后修改时间 |

完整的建表、索引、自动更新时间触发器、RLS 策略与实时同步设置都在 [supabase.sql](./supabase.sql)。

## 配置和运行

1. 在 [Supabase](https://supabase.com/dashboard) 创建一个免费的项目。
2. 打开 **SQL Editor**，粘贴并执行 `supabase.sql` 的完整内容。
3. 在 **Authentication → Providers → Email** 确保 Email 已启用。开发测试可关闭“Confirm email”；若保留邮箱验证，则注册后须先点击邮件中的确认链接。
4. 打开 **Project Settings → API**，复制 Project URL 与 **anon key / publishable key**。
5. 编辑 [supabase-config.js](./supabase-config.js)，填入这两个值：

   ```js
   window.SUPABASE_CONFIG = {
     url: "https://你的项目ID.supabase.co",
     anonKey: "你的 anon 或 publishable key"
   };
   ```

   `anon` / `publishable` key 可以公开在浏览器中；不要填入 `service_role` 或 `secret` key，它们会绕过 RLS。
6. 使用任意静态服务器运行项目，例如：

   ```powershell
   node -e "require('http').createServer((q,s)=>require('fs').createReadStream('index.html').pipe(s)).listen(5173)"
   ```

7. 访问 `http://127.0.0.1:5173`，注册账号并登录。首次登录时，旧版浏览器中存在的 localStorage 项目会自动一次性迁移到你的云端账号。

## 部署到免费静态托管

可选择 GitHub Pages、Cloudflare Pages 或 Netlify。三者均可托管本项目的纯静态文件。

1. 将 `index.html`、`app.js`、`supabase-config.js` 一起上传到仓库或托管平台。
2. 构建命令留空，发布目录设为仓库根目录（包含 `index.html` 的目录）。
3. 发布后，在 Supabase **Authentication → URL Configuration** 中填写网站 URL，并把该 URL 加到 Redirect URLs；这一步对邮箱确认跳转很重要。
4. 用两个浏览器或两台设备登录同一个账号，新增、编辑或删除项目，另一个页面会自动刷新同步。

## 免费方案说明

本应用只使用 Supabase Free Plan 内的 Auth、Postgres、Data API 和 Realtime 基础能力；不使用 Edge Functions、付费插件或服务端密钥。免费计划的容量、休眠策略与配额可能随 Supabase 调整，请以其控制台的当前显示为准。
