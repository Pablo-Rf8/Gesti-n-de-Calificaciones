$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/Activate-Project.ps1"
Push-Location "$PSScriptRoot/../backend"
try {
    if (Test-Path '../.tools/bin/composer.phar') { php ../.tools/bin/composer.phar install --no-interaction } else { composer install --no-interaction }
    if ($LASTEXITCODE -ne 0) { throw 'No se pudieron instalar las dependencias.' }
    if (!(Test-Path '.env')) { Copy-Item '.env.example' '.env' }
    if (!(Test-Path '../bd/database.sqlite')) { New-Item '../bd/database.sqlite' -ItemType File | Out-Null }
    if (!(Select-String -LiteralPath '.env' -Pattern '^APP_KEY=.+$' -Quiet)) {
        php artisan key:generate --no-interaction
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo generar la clave de la aplicación.' }
    }
    php artisan migrate --seed --force
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo preparar la base de datos.' }
} finally { Pop-Location }
