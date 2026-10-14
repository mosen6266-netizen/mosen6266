@echo off
chcp 65001 >nul
cd /d "%~dp0"
title DOCX Local Editor
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-local.ps1"
