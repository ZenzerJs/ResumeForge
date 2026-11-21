param(
  [switch]$Build,
  [switch]$Seed,
  [switch]$Down,
  [switch]$NoOpen
)

function Invoke-ResumeForgeInstaller {
  param(
    [switch]$Build,
    [switch]$Seed,
    [switch]$Down,
    [switch]$NoOpen
  )

  $ErrorActionPreference = "Stop"

  function Exit-Cleanly([int]$Code) {
    if ($script:PSCommandPath) {
      exit $Code
    }
    $global:LASTEXITCODE = $Code
    return $Code
  }

  function Invoke-DockerQuiet([string[]]$DockerArgs) {
    $prevPref = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
      & docker @DockerArgs *> $null
      return ($LASTEXITCODE -eq 0)
    } finally {
      $ErrorActionPreference = $prevPref
    }
  }

  function Invoke-DockerStream([string[]]$DockerArgs) {
    $prevPref = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
      & docker @DockerArgs | Out-Host
      return [int]$LASTEXITCODE
    } finally {
      $ErrorActionPreference = $prevPref
    }
  }

  function Test-PortFree([int]$Port) {
    try {
      $activeListeners = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
      foreach ($ep in $activeListeners) {
        if ($ep.Port -eq $Port) {
          return $false
        }
      }
    } catch {
      # Fall back to socket bind check below
    }

    $listener = $null
    try {
      $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
      $listener.ExclusiveAddressUse = $true
      $listener.Start()
      return $true
    } catch {
      return $false
    } finally {
      if ($null -ne $listener) {
        try { $listener.Stop() } catch {}
      }
    }
  }

  function Find-FreePort([int]$Start, [int]$End) {
    for ($p = $Start; $p -le $End; $p++) {
      if (Test-PortFree $p) {
        return $p
      }
    }
    throw "No available loopback port found in range $Start-$End."
  }

  function New-RandomAlphanumeric([int]$Length) {
    $alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $chars = New-Object System.Text.StringBuilder $Length
    $buf = New-Object byte[] 64
    try {
      while ($chars.Length -lt $Length) {
        $rng.GetBytes($buf)
        foreach ($b in $buf) {
          if ($b -lt 248) {
            [void]$chars.Append($alphabet[$b % 62])
            if ($chars.Length -eq $Length) { break }
          }
        }
      }
      return $chars.ToString()
    } finally {
      $rng.Dispose()
    }
  }

  function New-RandomHex([int]$ByteCount) {
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $buf = New-Object byte[] $ByteCount
    try {
      $rng.GetBytes($buf)
      return (($buf | ForEach-Object { $_.ToString("x2") }) -join "")
    } finally {
      $rng.Dispose()
    }
  }

  function Get-DotEnvSetting([string]$EnvPath, [string]$Key, [string]$DefaultValue) {
    if (-not (Test-Path -LiteralPath $EnvPath)) { return $DefaultValue }
    foreach ($line in [System.IO.File]::ReadAllLines($EnvPath)) {
      if ($line -match "^\s*#") { continue }
      if ($line -match "^\s*$([regex]::Escape($Key))\s*=\s*(.+?)\s*$") {
        $val = $Matches[1].Trim()
        if (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'"))) {
          if ($val.Length -ge 2) { $val = $val.Substring(1, $val.Length - 2) }
        }
        if ($val) { return $val }
      }
    }
    return $DefaultValue
  }

  function Save-RemoteFile([string]$Url, [string]$DestPath) {
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    $tmpPath = "$DestPath.tmp"
    Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $tmpPath
    Move-Item -LiteralPath $tmpPath -Destination $DestPath -Force
  }

  $useBuild = $Build -or ($env:RESUMEFORGE_BUILD -eq "1")
  $useSeed = $Seed -or ($env:RESUMEFORGE_SEED -eq "1")
  $useDown = $Down -or ($env:RESUMEFORGE_DOWN -eq "1")
  $skipOpen = $NoOpen -or ($env:RESUMEFORGE_NO_OPEN -eq "1")

  $ref = if ($env:RESUMEFORGE_REF) { $env:RESUMEFORGE_REF.Trim() } else { "main" }
  if ($ref -notmatch '^[A-Za-z0-9._/-]+$' -or $ref.Contains("..")) {
    Write-Host "Invalid RESUMEFORGE_REF: '$ref'." -ForegroundColor Red
    [void](Exit-Cleanly 1)
    return
  }

  Write-Host ""
  Write-Host "ResumeForge Local Installer" -ForegroundColor Cyan

  # 1. Preflight Docker checks
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Docker was not found on PATH." -ForegroundColor Red
    Write-Host "Install Docker Desktop (includes Compose v2), then re-run this command:" -ForegroundColor Yellow
    Write-Host "  winget install Docker.DockerDesktop"
    Write-Host "  https://docs.docker.com/desktop/setup/install/windows-install/"
    [void](Exit-Cleanly 1)
    return
  }

  if (-not (Invoke-DockerQuiet @("compose", "version"))) {
    Write-Host "Docker Compose v2 is required ('docker compose version' failed)." -ForegroundColor Red
    Write-Host "Update Docker Desktop or install the Compose plugin, then re-run." -ForegroundColor Yellow
    [void](Exit-Cleanly 1)
    return
  }

  if (-not (Invoke-DockerQuiet @("info"))) {
    Write-Host "Docker Desktop is installed but not running." -ForegroundColor Red
    Write-Host "Start Docker Desktop, wait for the whale icon to settle, and re-run this command." -ForegroundColor Yellow
    [void](Exit-Cleanly 1)
    return
  }

  # 2. Resolve install directory
  $cwd = (Get-Location).Path
  $isRepoClone = (Test-Path -LiteralPath (Join-Path $cwd "docker-compose.yml")) -and (Test-Path -LiteralPath (Join-Path $cwd "package.json"))

  if ($env:RESUMEFORGE_DIR) {
    $installDir = $env:RESUMEFORGE_DIR
    $isRepoClone = (Test-Path -LiteralPath (Join-Path $installDir "docker-compose.yml")) -and (Test-Path -LiteralPath (Join-Path $installDir "package.json"))
  } elseif ($isRepoClone) {
    $installDir = $cwd
  } else {
    $installDir = Join-Path $HOME "resumeforge"
  }

  if (-not (Test-Path -LiteralPath $installDir)) {
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
  }

  $composePath = Join-Path $installDir "docker-compose.yml"
  $envPath = Join-Path $installDir ".env"

  # 3. Handle -Down / stop
  if ($useDown) {
    if (-not (Test-Path -LiteralPath $composePath)) {
      Write-Host "Nothing to stop: $composePath does not exist." -ForegroundColor Yellow
      [void](Exit-Cleanly 0)
      return
    }
    Push-Location -LiteralPath $installDir
    try {
      $code = Invoke-DockerStream @("compose", "down")
      if ($code -ne 0) {
        [void](Exit-Cleanly $code)
        return
      }
      Write-Host "ResumeForge stopped. Your PostgreSQL data volume (resumeforge_pgdata) is preserved." -ForegroundColor Green
      [void](Exit-Cleanly 0)
      return
    } finally {
      Pop-Location
    }
  }

  # 4. Fetch docker-compose.yml (and local install.ps1) when not running inside a cloned repo
  if (-not $isRepoClone) {
    $baseRawUrl = "https://raw.githubusercontent.com/ZenzerJs/ResumeForge/$ref"
    Write-Host "Syncing compose configuration into $installDir ..." -ForegroundColor Gray
    try {
      Save-RemoteFile "$baseRawUrl/docker-compose.yml" $composePath
    } catch {
      Write-Host "Failed to download docker-compose.yml from $baseRawUrl/docker-compose.yml" -ForegroundColor Red
      Write-Host $_.Exception.Message -ForegroundColor DarkRed
      [void](Exit-Cleanly 1)
      return
    }
    try {
      Save-RemoteFile "$baseRawUrl/install.ps1" (Join-Path $installDir "install.ps1")
    } catch {
      # Non-fatal if saving helper copy fails
    }
  }

  # 5. Idempotent .env generation (UTF-8 without BOM so Docker Compose parses cleanly)
  if (-not (Test-Path -LiteralPath $envPath)) {
    if ($env:RESUMEFORGE_PORT) {
      $parsedPort = 0
      if (-not [int]::TryParse($env:RESUMEFORGE_PORT, [ref]$parsedPort) -or $parsedPort -lt 1 -or $parsedPort -gt 65535) {
        Write-Host "Invalid RESUMEFORGE_PORT: '$($env:RESUMEFORGE_PORT)'." -ForegroundColor Red
        [void](Exit-Cleanly 1)
        return
      }
      $appPort = $parsedPort
    } else {
      $appPort = Find-FreePort 3000 3020
    }
    $pgPort = Find-FreePort 5432 5450

    $pgPassword = New-RandomAlphanumeric 32
    $appSecret = New-RandomHex 32
    $syncSecret = New-RandomHex 32

    $envLines = @(
      "# Auto-generated by ResumeForge install.ps1",
      "POSTGRES_USER=resumeforge",
      "POSTGRES_PASSWORD=$pgPassword",
      "POSTGRES_DB=resumeforge",
      "POSTGRES_PORT=$pgPort",
      "APP_BIND_ADDRESS=127.0.0.1",
      "APP_PORT=$appPort",
      "NEXT_PUBLIC_APP_URL=http://localhost:$appPort",
      "APP_ACCESS_SECRET=$appSecret",
      "JOB_SYNC_SECRET=$syncSecret",
      "DEMO_MODE=false"
    )
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($envPath, (($envLines -join "`n") + "`n"), $utf8NoBom)

    Write-Host "Created $envPath with generated secrets (app port: $appPort, postgres port: $pgPort)." -ForegroundColor Green
  } else {
    Write-Host "Using existing $envPath (preserving secrets and ports)." -ForegroundColor Gray
  }

  $activeAppPort = Get-DotEnvSetting $envPath "APP_PORT" "3000"
  $localUrl = "http://localhost:$activeAppPort"
  $healthUrl = "http://127.0.0.1:$activeAppPort/login"

  # 6. Pull / Build & Launch
  Push-Location -LiteralPath $installDir
  try {
    if ($useBuild) {
      if (-not (Test-Path -LiteralPath (Join-Path $installDir "Dockerfile"))) {
        Write-Host "-Build requires a cloned ResumeForge repository with a Dockerfile." -ForegroundColor Red
        [void](Exit-Cleanly 1)
        return
      }
      Write-Host "Building and starting ResumeForge containers locally ..." -ForegroundColor Cyan
      $upCode = Invoke-DockerStream @("compose", "up", "--build", "-d")
      if ($upCode -ne 0) {
        [void](Exit-Cleanly $upCode)
        return
      }
    } else {
      Write-Host "Pulling latest ResumeForge image ..." -ForegroundColor Cyan
      $pullCode = Invoke-DockerStream @("compose", "pull")
      if ($pullCode -ne 0) {
        Write-Host "Failed to pull container image from GHCR." -ForegroundColor Red
        if (Test-Path -LiteralPath (Join-Path $installDir "Dockerfile")) {
          Write-Host "You can build locally instead with: .\install.ps1 -Build" -ForegroundColor Yellow
        }
        [void](Exit-Cleanly $pullCode)
        return
      }
      Write-Host "Starting ResumeForge containers ..." -ForegroundColor Cyan
      $upCode = Invoke-DockerStream @("compose", "up", "-d", "--no-build")
      if ($upCode -ne 0) {
        [void](Exit-Cleanly $upCode)
        return
      }
    }
  } finally {
    Pop-Location
  }

  # 7. Wait for app readiness
  Write-Host "Waiting for ResumeForge to accept connections at $healthUrl ..." -ForegroundColor Gray
  $deadline = (Get-Date).AddSeconds(90)
  $ready = $false
  while ((Get-Date) -lt $deadline) {
    try {
      $resp = Invoke-WebRequest -UseBasicParsing -Uri $healthUrl -TimeoutSec 3
      if ($resp.StatusCode -eq 200) {
        $ready = $true
        break
      }
    } catch {
      # Still booting or running Prisma migrations
    }
    Start-Sleep -Seconds 2
  }

  if (-not $ready) {
    Write-Host "ResumeForge did not respond at $healthUrl within 90 seconds." -ForegroundColor Red
    Write-Host "Inspect startup logs with:" -ForegroundColor Yellow
    Write-Host "  docker compose -f `"$composePath`" logs --tail=50 app"
    [void](Exit-Cleanly 1)
    return
  }

  if ($useSeed) {
    Push-Location -LiteralPath $installDir
    try {
      Write-Host "Seeding sample Evidence Bank data ..." -ForegroundColor Cyan
      $seedCode = Invoke-DockerStream @("compose", "exec", "-T", "app", "node", "--experimental-strip-types", "prisma/seed.ts")
      if ($seedCode -ne 0) {
        Write-Host "Warning: sample seed exited with code $seedCode." -ForegroundColor Yellow
      }
    } finally {
      Pop-Location
    }
  }

  Write-Host ""
  Write-Host "ResumeForge is ready at $localUrl" -ForegroundColor Green
  Write-Host "  Data folder : $installDir"
  Write-Host "  Stop        : docker compose -f `"$composePath`" down"
  Write-Host "  Logs        : docker compose -f `"$composePath`" logs -f app"
  Write-Host "  Update      : Re-run the install command (data is preserved)"
  Write-Host ""

  if (-not $skipOpen) {
    try {
      Start-Process $localUrl | Out-Null
    } catch {
      # Ignore headless environments where browser launch fails
    }
  }

  [void](Exit-Cleanly 0)
}

Invoke-ResumeForgeInstaller @PSBoundParameters
