# Gramchat - Apply All Fixes
# Run this from anywhere in PowerShell

$project = "C:\Users\rocks\Documents\Gramchat\Gramchat"
$fixes   = "FIXES_FOLDER"   # <-- replace with the folder Claude gave you

Write-Host "Applying Gramchat fixes..." -ForegroundColor Cyan

$files = @(
  @{ src = "frontend\src\App.jsx";                                dst = "frontend\src\App.jsx" },
  @{ src = "frontend\src\pages\HomePage.jsx";                     dst = "frontend\src\pages\HomePage.jsx" },
  @{ src = "frontend\src\pages\ProfilePage.jsx";                  dst = "frontend\src\pages\ProfilePage.jsx" },
  @{ src = "frontend\src\components\ChatHeader.jsx";              dst = "frontend\src\components\ChatHeader.jsx" },
  @{ src = "frontend\src\components\Sidebar.jsx";                 dst = "frontend\src\components\Sidebar.jsx" },
  @{ src = "frontend\src\components\ChatContainer.jsx";           dst = "frontend\src\components\ChatContainer.jsx" },
  @{ src = "frontend\src\components\MessageInput.jsx";            dst = "frontend\src\components\MessageInput.jsx" },
  @{ src = "frontend\src\store\useChatStore.js";                  dst = "frontend\src\store\useChatStore.js" },
  @{ src = "backend\src\lib\socket.js";                           dst = "backend\src\lib\socket.js" },
  @{ src = "backend\src\models\message.model.js";                 dst = "backend\src\models\message.model.js" },
  @{ src = "backend\src\controllers\message.controller.js";       dst = "backend\src\controllers\message.controller.js" },
  @{ src = "backend\src\controllers\auth.controller.js";          dst = "backend\src\controllers\auth.controller.js" },
  @{ src = "backend\src\routes\message.route.js";                 dst = "backend\src\routes\message.route.js" }
)

foreach ($f in $files) {
  $src = Join-Path $fixes $f.src
  $dst = Join-Path $project $f.dst
  Copy-Item $src $dst -Force
  Write-Host "  OK  $($f.dst)" -ForegroundColor Green
}

Write-Host ""
Write-Host "All fixes applied! Restart both servers." -ForegroundColor Cyan
