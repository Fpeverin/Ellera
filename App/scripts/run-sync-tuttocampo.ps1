# run-sync-tuttocampo.ps1
#
# Pensato per l'Utilita' di pianificazione di Windows (Task Scheduler): legge le variabili da
# .env.sync-tuttocampo.local (mai committato, vedi .gitignore e .env.sync-tuttocampo.example),
# le imposta come variabili d'ambiente per questo processo, poi lancia
# "npm run sync:tuttocampo" (scripts/sync-tuttocampo.js) dalla cartella App.
#
# Tutto l'output (anche in caso di errore) viene scritto in App\logs\sync-tuttocampo.log, in
# aggiunta in coda: in background, da Task Scheduler, non si vede nulla a schermo, e senza questo
# log un fallimento (codice di uscita 1) non lascia alcuna traccia di cosa sia andato storto.
#
# Scritto per girare da QUESTO PC (IP residenziale) e non da GitHub Actions: TuttoCampo riconosce
# gli IP "cloud" dei runner GitHub e restituisce pagine senza i dati delle partite, anche senza
# bloccare esplicitamente la richiesta - vedi CLAUDE.md, sezione "Sincronizzazione automatica
# Altre Partite da TuttoCampo", per i dettagli di come e' stato scoperto.

$appDir = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $appDir 'logs'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$logFile = Join-Path $logDir 'sync-tuttocampo.log'

function Log([string]$msg) {
    Write-Host $msg
    Add-Content -Path $logFile -Value $msg -Encoding UTF8
}

$exitCode = 1
try {
    Log ("=== Sync TuttoCampo: " + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + " ===")

    $envFile = Join-Path $appDir '.env.sync-tuttocampo.local'
    if (-not (Test-Path $envFile)) {
        Log "ERRORE: manca $envFile -- copia .env.sync-tuttocampo.example con questo nome e compila i valori (vedi App/CLAUDE.md)."
    }
    else {
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
            Log "ERRORE: SUPABASE_SERVICE_ROLE_KEY non ancora compilata in $envFile."
        }
        else {
            Set-Location $appDir
            # stderr di node (console.warn) in PowerShell 5.1 diventa un ErrorRecord: con 'Stop'
            # interromperebbe lo script, qui deve solo finire nel log come testo.
            $ErrorActionPreference = 'Continue'
            npm run sync:tuttocampo 2>&1 | ForEach-Object { Log ("" + $_) }
            $exitCode = $LASTEXITCODE
        }
    }
    Log ("=== Fine (codice di uscita " + $exitCode + ") ===")
}
catch {
    Log ("ERRORE IMPREVISTO: " + $_)
}
exit $exitCode
