param(
  [Parameter(Mandatory = $true)]
  [string]$ApiKey,
  [string]$ProjectId = "heheprodect",
  [string]$AllowedReferrer = "https://heheann.github.io/"
)

$ErrorActionPreference = "Stop"

function Invoke-Check {
  param(
    [string]$Name,
    [string]$Url,
    [string]$Body,
    [string]$Referrer = ""
  )

  $headers = @("Content-Type: application/json")
  if ($Referrer) {
    $headers += "Referer: $Referrer"
  }

  $args = @("-s", "-o", "NUL", "-w", "%{http_code}", "-X", "POST", $Url)
  foreach ($h in $headers) {
    $args += @("-H", $h)
  }
  $args += @("-d", $Body)

  $statusRaw = & curl.exe @args
  $status = [string]$statusRaw
  if ($status -notmatch '^\d{3}$') {
    Write-Host ("[{0}] HTTP N/A (network error or blocked runtime)" -f $Name)
    return -1
  }
  Write-Host ("[{0}] HTTP {1}" -f $Name, $status)
  return [int]$status
}

$installationsUrl = "https://firebaseinstallations.googleapis.com/v1/projects/$ProjectId/installations?key=$ApiKey"
$registrationsUrl = "https://fcmregistrations.googleapis.com/v1/projects/$ProjectId/registrations?key=$ApiKey"

Write-Output "== Allowed referrer checks =="
$s1 = Invoke-Check -Name "Installations (allowed referrer)" -Url $installationsUrl -Body "{}" -Referrer $AllowedReferrer
$s2 = Invoke-Check -Name "FCM registrations (allowed referrer)" -Url $registrationsUrl -Body "{}" -Referrer $AllowedReferrer

Write-Output ""
Write-Output "== No referrer checks (should be blocked after restriction) =="
$s3 = Invoke-Check -Name "Installations (no referrer)" -Url $installationsUrl -Body "{}"
$s4 = Invoke-Check -Name "FCM registrations (no referrer)" -Url $registrationsUrl -Body "{}"

Write-Output ""
Write-Output "== Expected =="
Write-Output "Allowed referrer: not 403 (typically 200/400)"
Write-Output "No referrer: 403"

if (($s1 -eq 403) -or ($s2 -eq 403)) {
  Write-Error "Allowed referrer is blocked. Check referrer whitelist or API restrictions."
}

if (($s3 -ne 403) -or ($s4 -ne 403)) {
  Write-Warning "No-referrer is not blocked yet. API key restrictions may not be fully applied."
}
