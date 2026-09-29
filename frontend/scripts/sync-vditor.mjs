#!/usr/bin/env node
/**
 * 把 node_modules 中的 Vditor 产物整份同步到 public/vendor/vditor/dist。
 *
 * 前端不用打包器引入 Vditor：index.html 以 <script> 加载本地 vendor 副本，
 * 编辑器懒加载的 i18n / 图标 / katex / mermaid / highlight.js 也全部按 cdn 选项指向该目录，
 * 因此 node_modules 里的 dist 必须整份复制进 public（该目录入库，保证构建产物自包含、无 CDN 依赖）。
 *
 * 升级流程见 README「本地开发」段落。整目录 verbatim 复制，不做任何裁剪，
 * 以便后续版本的 git diff 与上游发布增量一一对应。
 */
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourceDir = join(frontendRoot, 'node_modules', 'vditor', 'dist')
const targetDir = join(frontendRoot, 'public', 'vendor', 'vditor', 'dist')
const versionFile = join(frontendRoot, 'public', 'vendor', 'vditor', 'VERSION')

function fail(message) {
  console.error(`[sync-vditor] ${message}`)
  process.exit(1)
}

const declared = JSON.parse(readFileSync(join(frontendRoot, 'package.json'), 'utf8')).devDependencies?.vditor
if (!declared) {
  fail('package.json 的 devDependencies 中没有声明 vditor')
}
// 本项目按精确版本锁定，这里仍容忍前缀写法，统一取值后比对
const expected = String(declared).trim().replace(/^[\^~>=<\s]*/, '')

const installedManifest = join(frontendRoot, 'node_modules', 'vditor', 'package.json')
if (!existsSync(installedManifest)) {
  fail(`未找到 ${installedManifest}，请先执行 npm install`)
}
const installed = JSON.parse(readFileSync(installedManifest, 'utf8')).version

if (installed !== expected) {
  fail(`版本不一致：package.json 声明 ${expected}，node_modules 实际为 ${installed}。请先执行 npm install。`)
}
if (!existsSync(sourceDir)) {
  fail(`未找到 ${sourceDir}`)
}

rmSync(targetDir, { recursive: true, force: true })
cpSync(sourceDir, targetDir, { recursive: true, dereference: true })
writeFileSync(versionFile, `${installed}\n`)

let files = 0
let bytes = 0
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(fullPath)
    } else {
      files += 1
      bytes += statSync(fullPath).size
    }
  }
}
walk(targetDir)

console.log(`[sync-vditor] 已同步 Vditor ${installed} → public/vendor/vditor/dist`)
console.log(`[sync-vditor] ${files} 个文件，共 ${(bytes / 1024 / 1024).toFixed(1)} MB`)
