@echo off
chcp 65001 > nul
echo ========================================================
echo   音声入力SOAPノート - ローカルサーバー起動スクリプト
echo ========================================================
echo.
echo ブラウザの音声認識（Web Speech API）は、セキュリティ上
echo localhost（HTTPサーバー経由）での実行を推奨します。
echo.
echo ポート 8000 でサーバーを起動し、ブラウザを開きます...
echo 終了するにはこのウィンドウで Ctrl + C を押してください。
echo.

start "" "http://localhost:8000"
python -m http.server 8000
if %errorlevel% neq 0 (
    echo.
    echo Pythonが見つからなかったため、直接ブラウザで開きます。
    start "" "index.html"
)
pause
