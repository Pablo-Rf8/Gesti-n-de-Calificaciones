$projectRoot = Split-Path -Parent $PSScriptRoot
$localPhp = Join-Path $projectRoot '.tools/php'
if (Test-Path $localPhp) { $env:PATH = $localPhp + ';' + $env:PATH }
$env:COMPOSER_HOME = Join-Path $projectRoot '.tools/composer-home'
$env:COMPOSER_CACHE_DIR = Join-Path $projectRoot '.tools/cache/composer'
