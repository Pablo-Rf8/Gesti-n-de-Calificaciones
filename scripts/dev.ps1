. "$PSScriptRoot/Activate-Project.ps1"
Push-Location "$PSScriptRoot/../backend"
try { php artisan serve --host=127.0.0.1 --port=8003 } finally { Pop-Location }
