# Learn with Paul — Notion Blog 設計文件

## 概述

將 Notion database 中的技術文章轉換為靜態網站，部署在 GitHub Pages。

## 技術決策

| 項目 | 決定 | 原因 |
|------|------|------|
| 架構 | SSG（靜態網站生成） | 速度快、部署簡單、成本低 |
| 框架 | Astro | 專為內容網站設計、預設零 JS、SEO 友好 |
| 部署 | GitHub Pages | 免費、與 GitHub 深度整合 |
| Notion 渲染 | Notion API + 自訂渲染 | 完全控制輸出、精確處理每種 block 類型 |
| 圖片儲存 | Build 時下載到 repo | 簡單、不需額外服務 |
| Database 設定 | YAML 設定檔 | 修改設定檔後重新 build 即可 |
| E2E 測試 | Playwright | 速度快、Astro 官方支援 |
| Build 觸發 | 定時排程 + 手動觸發 | 兼顧自動化與即時需求 |

## 專案結構

```
learn_with_paul/
├── src/
│   ├── components/
│   │   ├── Header.astro
│   │   ├── Footer.astro
│   │   ├── AuthorCard.astro
│   │   ├── SeriesList.astro
│   │   ├── ArticleCard.astro
│   │   └── notion/              # Notion block 渲染元件
│   │       ├── NotionRenderer.astro
│   │       ├── Paragraph.astro
│   │       ├── Heading.astro
│   │       ├── Code.astro
│   │       ├── Image.astro
│   │       ├── Video.astro
│   │       ├── BulletedList.astro
│   │       ├── NumberedList.astro
│   │       ├── Quote.astro
│   │       ├── Callout.astro
│   │       ├── Toggle.astro
│   │       └── Divider.astro
│   ├── layouts/
│   │   └── BaseLayout.astro
│   ├── pages/
│   │   ├── index.astro           # 首頁：系列列表
│   │   └── [series]/
│   │       ├── index.astro       # 系列頁：文章列表
│   │       └── [slug].astro      # 文章頁：單篇文章
│   ├── lib/
│   │   ├── notion.ts             # Notion API 封裝
│   │   └── images.ts             # 圖片下載與路徑處理
│   └── styles/
│       └── global.css            # 全域樣式
├── public/
│   └── images/                   # Build 時下載的 Notion 圖片
├── e2e/                          # Playwright E2E 測試
├── site.config.yaml              # 網站設定檔
├── astro.config.mjs
├── package.json
├── tsconfig.json
└── .github/
    └── workflows/
        └── deploy.yml            # GitHub Actions
```

## 設定檔 (`site.config.yaml`)

```yaml
site:
  title: "Learn with Paul"
  description: "Paul 的技術學習筆記"
  url: "https://<username>.github.io/learn_with_paul"

author:
  name: "Paul"
  avatar: "/images/avatar.jpg"
  bio: "一句話自我介紹"
  links:
    - type: github
      url: "https://github.com/<username>"
    - type: linkedin
      url: "https://linkedin.com/in/<username>"
    - type: twitter
      url: "https://x.com/<username>"
    - type: email
      url: "mailto:your@email.com"

notion:
  databases:
    - id: "your-database-id-1"
      name: "Flutter 學習筆記"
      slug: "flutter-notes"
      description: "Flutter 開發的學習紀錄"
    - id: "your-database-id-2"
      name: "Dart 進階"
      slug: "dart-advanced"
      description: "Dart 語言的進階主題"

build:
  schedule: "0 0 * * *"
```

Notion API Key 存放於 GitHub Secrets（`NOTION_API_KEY`），不寫在設定檔中。

## Notion Database 結構

每個 database 應具備以下 properties：

| 欄位 | 類型 | 說明 |
|------|------|------|
| Title | Title | 文章標題 |
| Slug | Rich Text | URL 路徑 |
| Description | Rich Text | 文章簡介 |
| Cover | Files & Media | 封面圖片 |
| Tags | Multi-select | 標籤 |
| PublishedDate | Date | 發布日期 |
| Status | Select | `Draft` / `Published` |
| Order | Number | 系列內排序（選填） |

## 頁面設計

### 首頁 (`/`)
- 網站標題「Learn with Paul」
- 作者卡片（頭像、名稱、Bio、社交連結）
- 所有系列列表，顯示：名稱、描述、文章數量

### 系列頁 (`/[series]/`)
- 系列標題與描述
- 文章列表，依發布日期排序
- 文章卡片：標題、簡介、發布日期、標籤

### 文章頁 (`/[series]/[slug]`)
- 標題、發布日期、標籤
- 文章內容（Notion blocks 渲染）
- 上一篇 / 下一篇導航

## 視覺風格

- **配色**：黑白簡約。背景 `#ffffff`，文字 `#111111`，輔助灰 `#666666`
- **字體**：系統字體堆疊（無外部字體載入）
- **排版**：`max-width: 720px` 置中，大量留白
- **程式碼**：`shiki` 語法高亮，暗色主題

## 資料流（Build 時）

```
1. 讀取 site.config.yaml → 取得所有 database ID
2. 對每個 database：
   a. 呼叫 Notion API 查詢 database
      → 過濾 Status = "Published"
      → 取得文章 metadata
   b. 對每篇文章：
      → 取得所有 blocks（遞迴取得子 blocks）
      → 掃描 image/video blocks
      → 下載圖片到 public/images/[series]/[slug]/
      → 替換 URL 為本地路徑
3. 傳給 Astro 頁面渲染
```

### 圖片處理
- 檔名使用 content hash（避免重複下載）
- 下載失敗時 log 警告，不中斷 build
- 影片不下載（保持外部連結或嵌入）

## Notion Block 支援

| Block 類型 | 渲染方式 |
|-----------|---------|
| paragraph | `<p>` + rich text |
| heading_1/2/3 | `<h1>`/`<h2>`/`<h3>` |
| bulleted_list_item | `<ul><li>` |
| numbered_list_item | `<ol><li>` |
| code | `<pre><code>` + shiki |
| image | `<img>` 本地圖片 |
| video | `<video>` 或 embed |
| quote | `<blockquote>` |
| callout | 提示框 |
| divider | `<hr>` |
| toggle | `<details><summary>` |
| bookmark | 連結卡片 |
| table | `<table>` |

## CI/CD（GitHub Actions）

### 觸發條件
- `push` to main
- `schedule`: cron `0 0 * * *`（每日）
- `workflow_dispatch`（手動）

### 步驟
1. Checkout repo
2. Setup Node.js
3. Install dependencies
4. Build Astro site（從 Notion API 拉取資料）
5. Run Playwright E2E tests
6. Deploy to GitHub Pages

## E2E 測試

| 測試項目 | 驗證內容 |
|---------|---------|
| 首頁載入 | 標題、作者資訊、系列列表 |
| 系列頁 | 文章列表、可點擊 |
| 文章頁 | 標題、日期、內容渲染 |
| 程式碼區塊 | 語法高亮 |
| 圖片 | 正確載入 |
| 導航 | 上/下一篇連結 |
| RWD | 手機和桌面版面 |
| SEO | meta tags |

## SEO 優化

- `<title>` 和 `<meta description>`
- Open Graph tags
- `sitemap.xml`（Astro 內建）
- `robots.txt`
- 語意化 HTML
- 結構化資料（JSON-LD BlogPosting）
