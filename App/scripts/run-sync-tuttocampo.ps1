# run-sync-tuttocampo.ps1
#
# Pensato per l'Utilita' di pianificazione di Windows (Task Scheduler): legge le variabili da
# .env.sync-tuttocampo.local (mai committato, vedi .gitignore e .env.sync-tuttocampo.example),
# le imposta come variabili d'ambiente per questo processo, poi lancia
# "npm run sync:tuttocampo" (scripts/sync-tuttocampo.js) dalla cartella App.
#
# Scritto per girare da QUESTO PC (IP residenziale) e non da GitHub Actions: TuttoCampo riconosce
# gli IP "cloud" dei runner GitHub e restituisce pagine senza i dati delle partite, anche senza
# bloccare esplicitamente la richiesta - vedi CLAUDE.md, sezione "Sincronizzazione automatica
# Altre Partite da TuttoCampo", per i dettagli di come e' stato scoperto.

$ErrorActionPreference = 'Stop'

$appDir = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $appDir '.env.sync-tuttocampo.local'

if (-not (Test-Path $envFile)) {
    Write-Error "Manca $envFile -- copia .env.sync-tuttocampo.example con questo nome e compila i valori (vedi App/CLAUDE.md)."
    exit 1
}

Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq '' -or $line.StartsWith('#')) { return }
    $idx = $line.IndexOf('=')
    if ($idx -lt 1) { return }
    $name = $line.Substring(0, $idx).Trim()
    $value = $line.Substring($idx + 1).Trim()
    [System.Environment]::SetEnvironmentVariable($name, $value, 'Process')
}

if ($env:SUPABASE_SERVICE_ROLE_KEY -eq 'incolla-qui-la-service-role-key') {
    Write-Error "SUPABASE_SERVICE_ROLE_KEY non ancora compilata in $envFile."
    exit 1
}

Set-Location $appDir
npm run sync:tuttocampo
exit $LASTEXITCODE
