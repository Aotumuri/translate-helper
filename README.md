# Briefly

指定形式の翻訳 brief（TXT）を FIELD ごとに整理し、翻訳進捗と BBCode タグを確認できるローカルファーストの作業ツールです。

## 主な機能

- TXT brief のドラッグ＆ドロップ読み込み
- FIELD 単位の原文・翻訳表示
- ターゲット言語ごとの進捗管理
- BBCode タグの数・種類・順序と HTML エンティティのチェック
- Steam の文字数上限チェック
- localStorage への自動保存
- 元の brief 形式を保った TXT 書き出し
- GitHub Pages 自動デプロイ

## ローカル起動

```bash
npm install
npm run dev
```

Vite の設定ファイルを使わない最小構成です。GitHub Pages 用の相対パス指定はビルドコマンドに含まれています。

## GitHub Pages

`main` ブランチへ push すると `.github/workflows/deploy-pages.yml` がビルドと公開を行います。GitHub の **Settings → Pages → Build and deployment** で Source を **GitHub Actions** に設定してください。
