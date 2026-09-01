param([switch]$Check)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$logDirectory = Join-Path $projectRoot 'logs'
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
try {
    $successPath = Join-Path $logDirectory 'pipeline-last-success.json'
    if (-not $Check -and (Test-Path -LiteralPath $successPath)) {
        $lastSuccess = Get-Content -LiteralPath $successPath -Raw | ConvertFrom-Json
        if ($lastSuccess.state -eq 'success' -and ([datetimeoffset]$lastSuccess.finished_at).LocalDateTime.Date -eq (Get-Date).Date) { exit 0 }
    }
    $pythonPath = Join-Path $projectRoot '.venv-pipeline\Scripts\python.exe'
    $runnerPath = Join-Path $projectRoot 'components\scripte\run_daily_pipeline.py'
    $runnerArguments = @(('"{0}"' -f $runnerPath))
    if ($Check) { $runnerArguments += '--check' }
    $env:PYTHONUTF8 = '1'
    $env:PYTHONUNBUFFERED = '1'
    $process = Start-Process -FilePath $pythonPath -ArgumentList $runnerArguments -WorkingDirectory $projectRoot -WindowStyle Hidden -Wait -PassThru -RedirectStandardOutput (Join-Path $logDirectory 'launcher.stdout.log') -RedirectStandardError (Join-Path $logDirectory 'launcher.stderr.log')
    exit $process.ExitCode
} catch {
    ($_ | Out-String) | Add-Content -LiteralPath (Join-Path $logDirectory 'launcher-error.log')
    exit 1
}
