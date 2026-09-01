@echo off
cd /d "%~dp0"
set PYTHONUTF8=1
"%~dp0.venv-pipeline\Scripts\python.exe" "%~dp0components\scripte\run_daily_pipeline.py" %*
exit /b %errorlevel%
