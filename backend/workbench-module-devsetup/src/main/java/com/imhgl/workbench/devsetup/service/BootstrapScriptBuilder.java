package com.imhgl.workbench.devsetup.service;

import org.springframework.stereotype.Component;

/**
 * PowerShell 引导/采集脚本生成器（目标：Windows PowerShell 5.1+，无外部依赖）。
 * 脚本运行时实时拉取 /api/devsetup/manifest，因此模板除服务地址外与清单无关；
 * 输出由 controller 统一转 CRLF + UTF-8 BOM（PowerShell 5.1 对中文脚本要求 BOM）。
 * 语法约束：不使用 PS7 特性（三元运算符、?? 等），保持 5.1 兼容。
 */
@Component
public class BootstrapScriptBuilder {

    /**
     * 新机引导脚本：登录 → 拉清单 → winget 装软件 → ZIP 绿色版工具 → 配置文件下发
     * → IDEA 插件（installPlugins，免账号）→ IDEA 配置快照恢复 → 汇总报告。
     */
    public String bootstrap(String baseUrl) {
        return """
                # ============================================================
                #  工作台 · 开发环境引导脚本（bootstrap）
                #  由工作台 devsetup 模块生成。新电脑上打开 PowerShell 执行：
                #      irm __BASE_URL__/api/devsetup/bootstrap.ps1 | iex
                #  做什么：装软件 → 写配置 → 装 IDEA 插件 → 恢复 IDEA 设置（全程无需 JetBrains 账号）
                #  任何一步失败都不会中断，最后统一输出「执行报告」。
                # ============================================================
                $ErrorActionPreference = 'Stop'
                [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
                $BaseUrl = '__BASE_URL__'

                function Step([string]$msg) { Write-Host ("`n==> " + $msg) -ForegroundColor Cyan }
                function Done([string]$msg) { Write-Host ("    [OK] " + $msg) -ForegroundColor Green }
                function Warn([string]$msg) { Write-Host ("    [!!] " + $msg) -ForegroundColor Yellow }

                $script:ok = New-Object System.Collections.Generic.List[string]
                $script:bad = New-Object System.Collections.Generic.List[string]
                $script:manual = New-Object System.Collections.Generic.List[string]

                # ---------- 登录 ----------
                Step '登录工作台'
                $password = Read-Host '请输入工作台访问密码'
                try {
                    $login = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/auth/login" `
                        -ContentType 'application/json' -Body (@{ password = $password } | ConvertTo-Json)
                } catch {
                    Write-Host '登录失败：密码错误或服务不可达' -ForegroundColor Red
                    return
                }
                $headers = @{ Authorization = ("Bearer " + $login.data.token) }
                Done '登录成功'

                # ---------- 拉取清单 ----------
                Step '拉取环境清单'
                $manifest = (Invoke-RestMethod -Uri "$BaseUrl/api/devsetup/manifest" -Headers $headers).data
                Done ("工具 {0} 项 / 配置 {1} 个 / 工件 {2} 个" -f `
                    @($manifest.tools).Count, @($manifest.configFiles).Count, @($manifest.artifacts).Count)

                # ---------- 1. winget 软件安装 ----------
                Step '安装软件（winget）'
                if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
                    Warn '未检测到 winget（App Installer）'
                    $script:manual.Add('安装 App Installer（应用安装程序，微软商店可下）后重跑本脚本安装软件')
                } else {
                    $wingetTools = @($manifest.tools | Where-Object { $_.category -eq 'WINGET' })
                    foreach ($t in $wingetTools) {
                        $installed = $false
                        try {
                            winget list --id $t.sourceRef -e --accept-source-agreements *> $null
                            $installed = ($LASTEXITCODE -eq 0)
                        } catch {}
                        if ($installed) { Done ("{0} 已安装，跳过" -f $t.name); continue }
                        $wa = @('install', '--id', $t.sourceRef, '-e', '--silent',
                            '--accept-package-agreements', '--accept-source-agreements')
                        if ($t.version) { $wa += @('--version', $t.version) }
                        try {
                            & winget @wa
                            if ($LASTEXITCODE -eq 0) { $script:ok.Add("安装 $($t.name)") }
                            else { $script:bad.Add("安装 $($t.name)（winget 退出码 $LASTEXITCODE）") }
                        } catch { $script:bad.Add("安装 $($t.name)（$($_.Exception.Message)）") }
                    }
                    if (-not $wingetTools) { Done '清单中没有 winget 工具' }
                }

                # ---------- 2. ZIP 绿色版工具（下载解压 + 加入用户 PATH） ----------
                Step '安装绿色版工具（ZIP）'
                $zipTools = @($manifest.tools | Where-Object { $_.category -eq 'ZIP' })
                foreach ($t in $zipTools) {
                    try {
                        $safeName = $t.name -replace '\s', ''
                        $zip = Join-Path $env:TEMP ($safeName + '.zip')
                        Invoke-WebRequest -Uri $t.sourceRef -OutFile $zip -UseBasicParsing
                        $dest = Join-Path (Join-Path $env:USERPROFILE 'tools') $safeName
                        if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
                        Expand-Archive -Path $zip -DestinationPath $dest -Force
                        Remove-Item $zip -Force
                        $bin = $dest
                        if (Test-Path (Join-Path $dest 'bin')) { $bin = Join-Path $dest 'bin' }
                        [string]$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
                        if (-not $userPath) { $userPath = '' }
                        if ($userPath -notlike ("*" + $bin + "*")) {
                            $newPath = $userPath.TrimEnd(';') + ';' + $bin
                            [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
                            Done ("{0} 已安装至 {1}，bin 已加入用户 PATH（新开终端生效）" -f $t.name, $dest)
                        } else {
                            Done ("{0} 已安装至 {1}（PATH 已包含）" -f $t.name, $dest)
                        }
                        $script:ok.Add("安装 $($t.name)（ZIP）")
                    } catch { $script:bad.Add("安装 $($t.name)（ZIP：$($_.Exception.Message)）") }
                }
                if (-not $zipTools) { Done '清单中没有 ZIP 工具' }

                # ---------- 3. 配置文件下发 ----------
                Step '下发配置文件'
                foreach ($cf in @($manifest.configFiles)) {
                    try {
                        $target = [Environment]::ExpandEnvironmentVariables($cf.targetPath)
                        $dir = Split-Path $target -Parent
                        if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
                        if (Test-Path $target) {
                            $bak = "$target.bak-" + (Get-Date -Format 'yyyyMMdd-HHmmss')
                            Copy-Item $target $bak -Force
                            Warn ("{0} 已存在，原文件备份为 {1}" -f $target, (Split-Path $bak -Leaf))
                        }
                        [IO.File]::WriteAllText($target, $cf.content, (New-Object System.Text.UTF8Encoding($false)))
                        Done ("写入 {0}" -f $target)
                        $script:ok.Add("配置 $($cf.name)")
                    } catch { $script:bad.Add("配置 $($cf.name)（$($_.Exception.Message)）") }
                }
                if (-not @($manifest.configFiles).Count) { Done '清单中没有配置文件' }

                # ---------- 4. IDEA 插件（Marketplace 免账号直装） ----------
                Step '安装 IDEA 插件'
                $plugins = @($manifest.tools | Where-Object { $_.category -eq 'IDEA_PLUGIN' })
                $script:ideaExe = $null
                if (-not $plugins) {
                    Done '清单中没有 IDEA 插件'
                } else {
                    $candidates = @()
                    foreach ($root in @("$env:ProgramFiles\\JetBrains", "${env:ProgramFiles(x86)}\\JetBrains",
                                        "$env:LOCALAPPDATA\\Programs", "$env:LOCALAPPDATA\\JetBrains\\Toolbox\\apps")) {
                        if (Test-Path $root) {
                            $found = Get-ChildItem $root -Recurse -Depth 6 -Filter 'idea64.exe' -ErrorAction SilentlyContinue |
                                Select-Object -First 1
                            if ($found) { $candidates += $found; break }
                        }
                    }
                    if ($candidates.Count -gt 0) { $script:ideaExe = $candidates[0].FullName }
                    if (-not $script:ideaExe) {
                        Warn '未找到 idea64.exe（若刚刚安装，请重开终端重跑本脚本）'
                        $script:manual.Add(("手动在 IDEA 插件市场安装：{0}" -f (($plugins | ForEach-Object { $_.sourceRef }) -join ', ')))
                    } else {
                        Done ("IDEA：{0}" -f $script:ideaExe)
                        foreach ($p in $plugins) {
                            try {
                                & $script:ideaExe installPlugins $p.sourceRef *> $null
                                if ($LASTEXITCODE -eq 0) { $script:ok.Add("IDEA 插件 $($p.name)") }
                                else { $script:bad.Add("IDEA 插件 $($p.name)（退出码 $LASTEXITCODE）") }
                            } catch { $script:bad.Add("IDEA 插件 $($p.name)（$($_.Exception.Message)）") }
                        }
                    }
                }

                # ---------- 5. IDEA 配置快照恢复（主题/快捷键/代码风格，无需 JetBrains 账号） ----------
                Step '恢复 IDEA 配置快照'
                $artifacts = @($manifest.artifacts)
                if (-not $artifacts.Count) {
                    Done '工作台暂无 IDEA 配置快照（旧电脑跑 capture.ps1 采集后在工作台上传）'
                } else {
                    $pick = $artifacts[0]
                    if ($artifacts.Count -gt 1) {
                        Write-Host '存在多个快照：'
                        for ($i = 0; $i -lt $artifacts.Count; $i++) {
                            Write-Host ("  [{0}] {1}  {2}  更新于 {3:yyyy-MM-dd}" -f ($i + 1), `
                                $artifacts[$i].name, $artifacts[$i].filename, [datetime]$artifacts[$i].updateTime)
                        }
                        $sel = Read-Host ("选择要恢复的快照序号（1-{0}，回车默认 1）" -f $artifacts.Count)
                        $idx = 1
                        if (-not [int]::TryParse($sel, [ref]$idx)) { $idx = 1 }
                        if ($idx -lt 1 -or $idx -gt $artifacts.Count) { $idx = 1 }
                        $pick = $artifacts[$idx - 1]
                    }
                    try {
                        $zip = Join-Path $env:TEMP 'wb-idea-settings.zip'
                        Invoke-WebRequest -Uri "$BaseUrl/api/devsetup/artifacts/$($pick.name)/download" `
                            -Headers $headers -OutFile $zip -UseBasicParsing
                        $configRoot = Join-Path $env:APPDATA 'JetBrains'
                        $targetDir = $null
                        if ($script:ideaExe) {
                            $infoJson = Join-Path (Split-Path (Split-Path $script:ideaExe -Parent) -Parent) 'product-info.json'
                            if (Test-Path $infoJson) {
                                try {
                                    $dataDir = ((Get-Content $infoJson -Raw | ConvertFrom-Json).dataDirName)
                                    if ($dataDir) { $targetDir = Join-Path $configRoot $dataDir }
                                } catch {}
                            }
                        }
                        if (-not $targetDir) {
                            $existing = Get-ChildItem $configRoot -Directory -Filter 'IntelliJIdea*' -ErrorAction SilentlyContinue |
                                Sort-Object LastWriteTime -Descending | Select-Object -First 1
                            if ($existing) { $targetDir = $existing.FullName }
                        }
                        if (-not $targetDir) {
                            New-Item -ItemType Directory -Path $configRoot -Force | Out-Null
                            $targetDir = Join-Path $configRoot 'IntelliJIdea'
                            Warn ("无法确定 IDEA 配置目录，快照解压到 {0}；若启动 IDEA 后未生效，请手动合并到 %APPDATA%\\JetBrains\\IntelliJIdea<版本>" -f $targetDir)
                        }
                        if (Test-Path $targetDir) {
                            $bak = "$targetDir.bak-" + (Get-Date -Format 'yyyyMMdd-HHmmss')
                            Move-Item $targetDir $bak -Force
                            Warn ("原配置目录已备份为 {0}" -f (Split-Path $bak -Leaf))
                        }
                        New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
                        Expand-Archive -Path $zip -DestinationPath $targetDir -Force
                        Remove-Item $zip -Force
                        Done ("IDEA 配置快照已恢复至 {0}（首次启动 IDEA 后生效）" -f $targetDir)
                        $script:ok.Add('IDEA 配置快照恢复')
                    } catch { $script:bad.Add("IDEA 配置快照恢复（$($_.Exception.Message)）") }
                }

                # ---------- 执行报告 ----------
                Write-Host ''
                Write-Host '================ 执行报告 ================' -ForegroundColor Cyan
                if ($script:ok.Count -gt 0) {
                    Write-Host ("成功 {0} 项：" -f $script:ok.Count) -ForegroundColor Green
                    foreach ($item in $script:ok) { Write-Host ("  + " + $item) -ForegroundColor Green }
                } else {
                    Write-Host '成功 0 项' -ForegroundColor Green
                }
                if ($script:bad.Count -gt 0) {
                    Write-Host ("失败 {0} 项：" -f $script:bad.Count) -ForegroundColor Red
                    foreach ($item in $script:bad) { Write-Host ("  - " + $item) -ForegroundColor Red }
                }
                if ($script:manual.Count -gt 0) {
                    Write-Host '需要手动完成：' -ForegroundColor Yellow
                    foreach ($item in $script:manual) { Write-Host ("  ! " + $item) -ForegroundColor Yellow }
                }
                Write-Host '提示：IDEA 插件与设置恢复全程未使用 JetBrains 账号；若配置未生效，重启 IDEA 即可。'
                Write-Host '==========================================' -ForegroundColor Cyan
                """.replace("__BASE_URL__", baseUrl);
    }

    /**
     * 旧机采集脚本：把 IDEA 配置目录（options/keymaps/codestyles/colors/inspection/tools）
     * 打包成 zip 放到桌面，提示用户回工作台上传。
     */
    public String capture() {
        return """
                # ============================================================
                #  工作台 · IDEA 配置快照采集脚本（capture）
                #  在【旧电脑】上运行（PowerShell 直接右键「使用 PowerShell 运行」本文件）：
                #  打包 IDEA 的主题/快捷键/代码风格等配置，生成 zip 后回工作台「环境管家」上传。
                # ============================================================
                $ErrorActionPreference = 'Stop'
                $root = Join-Path $env:APPDATA 'JetBrains'
                if (-not (Test-Path $root)) {
                    Write-Host '未找到 %APPDATA%\\JetBrains，IDEA 可能未安装或从未启动过' -ForegroundColor Red
                    return
                }
                $dirs = Get-ChildItem $root -Directory -Filter 'IntelliJIdea*' | Sort-Object LastWriteTime -Descending
                if (-not $dirs) {
                    Write-Host ("未在 {0} 下找到 IntelliJIdea* 配置目录" -f $root) -ForegroundColor Red
                    return
                }
                $src = $dirs[0]
                if ($dirs.Count -gt 1) {
                    Write-Host '发现多个 IDEA 配置目录：'
                    for ($i = 0; $i -lt $dirs.Count; $i++) {
                        Write-Host ("  [{0}] {1}" -f ($i + 1), $dirs[$i].Name)
                    }
                    $sel = Read-Host ("选择要采集的目录（1-{0}，回车默认 1）" -f $dirs.Count)
                    $idx = 1
                    if (-not [int]::TryParse($sel, [ref]$idx)) { $idx = 1 }
                    if ($idx -lt 1 -or $idx -gt $dirs.Count) { $idx = 1 }
                    $src = $dirs[$idx - 1]
                }
                Write-Host ("采集目录：{0}" -f $src.FullName) -ForegroundColor Cyan
                $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
                $staging = Join-Path $env:TEMP ("wb-capture-" + $stamp)
                New-Item -ItemType Directory -Path $staging -Force | Out-Null
                foreach ($name in @('options', 'keymaps', 'codestyles', 'colors', 'inspection', 'tools')) {
                    $p = Join-Path $src.FullName $name
                    if (Test-Path $p) { Copy-Item $p (Join-Path $staging $name) -Recurse -Force }
                }
                if (-not (Get-ChildItem $staging)) {
                    Write-Host '配置目录为空，未生成快照' -ForegroundColor Red
                    Remove-Item $staging -Recurse -Force
                    return
                }
                $out = Join-Path ([Environment]::GetFolderPath('Desktop')) ("idea-settings-{0}.zip" -f $stamp)
                if (Test-Path $out) { Remove-Item $out -Force }
                Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $out -Force
                Remove-Item $staging -Recurse -Force
                $sizeKb = [math]::Round((Get-Item $out).Length / 1KB)
                Write-Host ''
                Write-Host ("快照已生成：{0}（{1} KB）" -f $out, $sizeKb) -ForegroundColor Green
                Write-Host '请回到工作台「环境管家 → IDEA 配置快照」上传该 zip 文件（工件名建议保持 idea-settings）'
                Invoke-Item -Path (Split-Path $out -Parent)
                """;
    }
}
