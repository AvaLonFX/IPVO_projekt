param([string]$At = '08:00', [string]$TaskName = 'QNBA Daily Pipeline')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pythonPath = Join-Path $projectRoot '.venv-pipeline\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $pythonPath)) { throw 'Install the pipeline Python environment first.' }
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot '.env.pipeline.local'))) { throw 'Configure .env.pipeline.local first.' }
$wrapperPath = Join-Path $PSScriptRoot 'invoke-daily-pipeline.ps1'
$powershellPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
if (-not (Test-Path -LiteralPath $powershellPath)) { throw 'Windows PowerShell executable was not found.' }
$accountName = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$action = New-ScheduledTaskAction -Execute $powershellPath -Argument ('-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}"' -f $wrapperPath) -WorkingDirectory $projectRoot
$triggers = @((New-ScheduledTaskTrigger -Daily -At $At), (New-ScheduledTaskTrigger -AtLogOn -User $accountName))
$principal = New-ScheduledTaskPrincipal -UserId $accountName -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun -RunOnlyIfNetworkAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 30) -ExecutionTimeLimit (New-TimeSpan -Hours 4)
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $triggers -Principal $principal -Settings $settings -Description 'Refresh QNBA NBA data. Runs daily and after sign-in; logs are stored in the project logs folder.' -Force | Select-Object TaskName, State
