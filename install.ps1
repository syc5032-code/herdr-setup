# ==============================================================================
# Herdr & Antigravity 원클릭 자동 설치 및 설정 스크립트 (install.ps1)
# ==============================================================================

$ErrorActionPreference = "Continue"

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "  Herdr & Antigravity 통합 환경 자동 설정 스크립트" -ForegroundColor Cyan
Write-Host "========================================================`n" -ForegroundColor Cyan

# 1. Herdr 설치
$herdrInstalled = (Get-Command herdr -ErrorAction SilentlyContinue) -or (Test-Path "$env:USERPROFILE\.herdr\packages\standalone\releases\*\herdr.exe")
if (-not $herdrInstalled) {
    Write-Host "[1/7] Herdr 설치 중..." -ForegroundColor Yellow
    powershell -ExecutionPolicy Bypass -c "irm https://herdr.dev/install.ps1 | iex"
} else {
    Write-Host "[1/7] Herdr가 이미 설치되어 있습니다." -ForegroundColor Green
}

# 2. Antigravity CLI 설치
$agyInstalled = Test-Path "$env:LOCALAPPDATA\agy\bin\agy.exe"
if (-not $agyInstalled) {
    Write-Host "`n[2/7] Antigravity CLI 설치 중..." -ForegroundColor Yellow
    powershell -ExecutionPolicy Bypass -c "irm https://antigravity.google/cli/install.ps1 | iex"
} else {
    Write-Host "`n[2/7] Antigravity CLI가 이미 설치되어 있습니다." -ForegroundColor Green
}

# 3. Herdr 설정 복사 (config.toml)
Write-Host "`n[3/7] Herdr 테마/단축키/상태바 설정 복사 중..." -ForegroundColor Yellow
$herdrConfigDir = Join-Path $env:APPDATA "herdr"
if (-not (Test-Path $herdrConfigDir)) { New-Item -ItemType Directory -Path $herdrConfigDir -Force | Out-Null }
Copy-Item (Join-Path $PSScriptRoot "config.toml") (Join-Path $herdrConfigDir "config.toml") -Force

# 4. Antigravity 설정 및 상태줄(Statusline) 복사
Write-Host "`n[4/7] Antigravity 상태줄(윤자동 스타일) 및 자동승인 모드 설정 중..." -ForegroundColor Yellow
$agyConfigDir = Join-Path $env:USERPROFILE ".gemini\antigravity-cli"
if (-not (Test-Path $agyConfigDir)) { New-Item -ItemType Directory -Path $agyConfigDir -Force | Out-Null }
Copy-Item (Join-Path $PSScriptRoot "settings.json") (Join-Path $agyConfigDir "settings.json") -Force
Copy-Item (Join-Path $PSScriptRoot "statusline.js") (Join-Path $agyConfigDir "statusline.js") -Force
Copy-Item (Join-Path $PSScriptRoot "statusline.cmd") (Join-Path $agyConfigDir "statusline.cmd") -Force
Copy-Item (Join-Path $PSScriptRoot "get_quota_summary.js") (Join-Path $agyConfigDir "get_quota_summary.js") -Force

# 초기 쿼터 캐시 파일 생성
Set-Content -Path (Join-Path $agyConfigDir "quota_cache.txt") -Value "[5h: 100% | Wk: 100%]" -Encoding UTF8

# 5. Herdr 에이전트 연동 훅 등록
Write-Host "`n[5/7] Herdr ↔ Antigravity 연동 훅 등록 중..." -ForegroundColor Yellow
$herdrExe = Get-ChildItem "$env:USERPROFILE\.herdr\packages\standalone\releases\*\herdr.exe" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
if ($herdrExe) {
    & $herdrExe integration install antigravity-cli
}

# 6. 터미널 단축 명령어(a, herder) 등록
Write-Host "`n[6/7] 터미널 단축 명령어(a, herder) 등록 중..." -ForegroundColor Yellow
$windowsApps = Join-Path $env:LOCALAPPDATA "Microsoft\WindowsApps"
if (Test-Path $windowsApps) {
    Set-Content -Path (Join-Path $windowsApps "a.cmd") -Value "@echo off`n`"%LOCALAPPDATA%\agy\bin\agy.exe`" --mode auto %*" -Force
    Set-Content -Path (Join-Path $windowsApps "herder.cmd") -Value "@echo off`nherdr %*" -Force
}

# PowerShell Profile 단축어 설정
try {
    $profileDir = Split-Path $PROFILE
    if (-not (Test-Path $profileDir)) { New-Item -ItemType Directory -Path $profileDir -Force | Out-Null }
    $profileContent = @'
function herder { herdr @args }
function a { & "$env:LOCALAPPDATA\agy\bin\agy.exe" --mode auto @args }
function c { if (Get-Command claude -ErrorAction SilentlyContinue) { & claude @args } else { Write-Warning "Claude가 아직 설치되지 않았습니다." } }
function d { if (Get-Command codex -ErrorAction SilentlyContinue) { & codex @args } else { Write-Warning "Codex가 아직 설치되지 않았습니다." } }
'@
    Set-Content -Path $PROFILE -Value $profileContent -Force
} catch {}

# 7. Windows Terminal 라이트 테마(어두운 폰트 가독성 개선) 적용
Write-Host "`n[7/7] Windows Terminal 색상 스키마 설정 중..." -ForegroundColor Yellow
$wtSettingsPaths = @(
    Get-ChildItem "$env:LOCALAPPDATA\Packages\Microsoft.WindowsTerminal*\LocalState\settings.json" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName
    "$env:LOCALAPPDATA\Microsoft\Windows Terminal\settings.json"
) | Where-Object { $_ -and (Test-Path $_) }

foreach ($wtPath in $wtSettingsPaths) {
    try {
        $wtJson = Get-Content $wtPath -Raw -Encoding UTF8 | ConvertFrom-Json
        $schemeName = "One Half Light (Dark Font)"
        $newScheme = [PSCustomObject]@{
            name                = $schemeName
            background          = "#FAFAFA"
            foreground          = "#383A42"
            cursorColor         = "#4F525D"
            selectionBackground = "#BFCEFF"
            black               = "#383A42"
            blue                = "#0184BC"
            cyan                = "#0997B3"
            green               = "#50A14F"
            purple              = "#A626A4"
            red                 = "#E45649"
            yellow              = "#C18301"
            white               = "#5C5F77"
            brightBlack         = "#4F525D"
            brightBlue          = "#0184BC"
            brightCyan          = "#0997B3"
            brightGreen         = "#50A14F"
            brightPurple        = "#A626A4"
            brightRed           = "#E45649"
            brightYellow        = "#C18301"
            brightWhite         = "#383A42"
        }

        $existingSchemes = @()
        if ($wtJson.PSObject.Properties["schemes"] -and $wtJson.schemes) {
            $existingSchemes = @($wtJson.schemes | Where-Object { $_.name -ne $schemeName })
        }
        $wtJson | Add-Member -MemberType NoteProperty -Name "schemes" -Value ($existingSchemes + $newScheme) -Force

        if (-not $wtJson.PSObject.Properties["profiles"] -or -not $wtJson.profiles) {
            $wtJson | Add-Member -MemberType NoteProperty -Name "profiles" -Value ([PSCustomObject]@{}) -Force
        }
        if (-not $wtJson.profiles.PSObject.Properties["defaults"] -or -not $wtJson.profiles.defaults) {
            $wtJson.profiles | Add-Member -MemberType NoteProperty -Name "defaults" -Value ([PSCustomObject]@{}) -Force
        }
        $wtJson.profiles.defaults | Add-Member -MemberType NoteProperty -Name "colorScheme" -Value $schemeName -Force

        [System.IO.File]::WriteAllText($wtPath, ($wtJson | ConvertTo-Json -Depth 10), [System.Text.UTF8Encoding]::new($false))
        Write-Host "  Windows Terminal 설정 완료: $wtPath" -ForegroundColor Green
    } catch {
        Write-Warning "Windows Terminal 설정 적용 실패 ($wtPath): $_"
    }
}

Write-Host "`n========================================================" -ForegroundColor Green
Write-Host "  ✅ 모든 설치와 환경 동기화가 완료되었습니다!" -ForegroundColor Green
Write-Host "  이제 새 터미널을 열고 'herdr'를 실행하시면 됩니다." -ForegroundColor Green
Write-Host "========================================================`n" -ForegroundColor Cyan
