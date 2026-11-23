# Сборка лаунчера

На Windows x64 установи Node.js 22+ и .NET 8 SDK. Выполни из корня репозитория:

```powershell
dotnet publish TouchReady -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:EnableCompressionInSingleFile=true -p:DebugType=None -p:DebugSymbols=false -o launcher/TouchReady
npm.cmd ci --prefix launcher
node launcher/package-launcher.cjs
```

Готовый EXE появится в папке `packaged/GoreBox VR Launcher-win32-x64`. Для передачи пользователям архивируй всю папку.
