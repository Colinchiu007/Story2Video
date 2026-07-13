# 质量门禁 — 不安全错误处理模式检测
# 用法: powershell -File scripts/quality-gate.ps1
# 返回: 0=通过, 1=检测到问题

$exitCode = 0

Write-Host "=== 质量门禁: 不安全错误处理模式检测 ===" -ForegroundColor Cyan

# 门禁 1: throw error; (不包装)
Write-Host "`n[1/4] 检测 raw throw error; 模式..." -ForegroundColor Yellow
$rawThrows = Get-ChildItem src -Recurse -Include *.ts,*.tsx | Select-String -Pattern "if \(error\) throw error;" | ForEach-Object { $_.Line.Trim() }
if ($rawThrows.Count -gt 0) {
  Write-Host "  🔴 发现 $($rawThrows.Count) 处 unsafe throw error:" -ForegroundColor Red
  $rawThrows | ForEach-Object { Write-Host "     $_" }
  $exitCode = 1
} else {
  Write-Host "  ✅ 无 raw throw error" -ForegroundColor Green
}

# 门禁 2: 不安全 supabase 解构
Write-Host "`n[2/4] 检测不安全 supabase 解构..." -ForegroundColor Yellow
$unsafeDestructure = Get-ChildItem src -Recurse -Include *.ts,*.tsx | Select-String -Pattern "const \{ data: \{ \w+ \} \} = await supabase" | ForEach-Object { $_.Line.Trim() }
if ($unsafeDestructure.Count -gt 0) {
  Write-Host "  🔴 发现 $($unsafeDestructure.Count) 处不安全 supabase 解构:" -ForegroundColor Red
  $unsafeDestructure | ForEach-Object { Write-Host "     $_" }
  $exitCode = 1
} else {
  Write-Host "  ✅ 无不安全 supabase 解构" -ForegroundColor Green
}

# 门禁 3: err instanceof Error 回退到硬编码消息
Write-Host "`n[3/4] 检测 err instanceof Error 退化为硬编码消息..." -ForegroundColor Yellow
$fallbackPattern = Get-ChildItem src -Recurse -Include *.ts,*.tsx | Select-String -Pattern "instanceof Error \? err\.message : '" | ForEach-Object { $_.Line.Trim() }
if ($fallbackPattern.Count -gt 0) {
  Write-Host "  🟡 发现 $($fallbackPattern.Count) 处 instanceof Error 回退:" -ForegroundColor Yellow
  $fallbackPattern | ForEach-Object { Write-Host "     $_" }
} else {
  Write-Host "  ✅ 无 instanceof Error 回退" -ForegroundColor Green
}

# 门禁 4: 源文件 UTF-8 BOM 检测
Write-Host "`n[4/4] 检测源文件 UTF-8 BOM..." -ForegroundColor Yellow
$bomFiles = Get-ChildItem src -Recurse -Include *.ts,*.tsx | Where-Object {
  $b = [System.IO.File]::ReadAllBytes($_.FullName)
  $b.Length -gt 3 -and $b[0] -eq 0xEF -and $b[1] -eq 0xBB -and $b[2] -eq 0xBF
}
if ($bomFiles.Count -gt 0) {
  Write-Host "  🔴 发现 $($bomFiles.Count) 个文件包含 BOM:" -ForegroundColor Red
  $bomFiles | ForEach-Object { Write-Host "     $($_.FullName)" }
  $exitCode = 1
} else {
  Write-Host "  ✅ 无 BOM" -ForegroundColor Green
}

Write-Host "`n=== 门禁结果: $(if ($exitCode -eq 0) { '通过' } else { '未通过' }) ===" -ForegroundColor $(if ($exitCode -eq 0) { 'Green' } else { 'Red' })
exit $exitCode
