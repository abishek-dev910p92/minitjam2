# PowerShell examples for Music Platform API
# Edit $baseUrl and $token as needed
$baseUrl = 'https://localhost:3000'
$token = '' # set your JWT here

Write-Host "Base URL: $baseUrl"

function Invoke-Api {
  param($Method, $Path, $Body = $null, $Headers = @{})
  $url = "$baseUrl$Path"
  $allHeaders = @{
    'Accept' = 'application/json'
  }
  if ($token) { $allHeaders['Authorization'] = "Bearer $token" }
  foreach ($k in $Headers.Keys) { $allHeaders[$k] = $Headers[$k] }

  if ($Body -ne $null) {
    $json = $Body | ConvertTo-Json -Depth 10
    Invoke-RestMethod -Method $Method -Uri $url -Headers $allHeaders -Body $json -ContentType 'application/json'
  } else {
    Invoke-RestMethod -Method $Method -Uri $url -Headers $allHeaders
  }
}

# 1) Signup artist
try {
  $res = Invoke-Api -Method 'POST' -Path '/auth/signup/artist' -Body @{
    name = 'Indie Artist'
    email = 'indie@example.com'
    password = 'password123'
  }
  $res | ConvertTo-Json -Depth 5
} catch {
  Write-Error $_
}

# 2) Login (obtain token)
try {
  $login = Invoke-Api -Method 'POST' -Path '/auth/login' -Body @{ email='indie@example.com'; password='password123'; role='artist' }
  $login | ConvertTo-Json -Depth 5
  if ($login.token) { $token = $login.token; Write-Host "Saved token" }
} catch { Write-Error $_ }

# 3) Create opportunity (requires club token)
# $token should be a club token for this endpoint
# Invoke-Api -Method 'POST' -Path '/opportunities' -Body @{ title='Weekend Gig'; event_date='2025-11-15'; event_time='20:00' }

# 4) Apply to opportunity (artist)
# Invoke-Api -Method 'POST' -Path '/applications/5/apply' -Body @{ artist_id = 12 }

# 5) List bookings for current user
# Invoke-Api -Method 'GET' -Path '/bookings'

# You can edit and run the above lines by uncommenting the relevant Invoke-Api lines and setting $token appropriately.
