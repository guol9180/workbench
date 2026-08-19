@echo off
chcp 65001 >nul
title 工作台 · 在线文档系统
echo ============================================
echo   工作台 · 在线文档系统 启动中...
echo   启动后请用浏览器访问 http://localhost:8080
echo   按 Ctrl+C 停止服务
echo ============================================
cd /d "%~dp0"
mvn spring-boot:run
pause
