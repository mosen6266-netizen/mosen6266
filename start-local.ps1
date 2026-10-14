$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath((Split-Path -Parent $MyInvocation.MyCommand.Path))
$utf8 = New-Object System.Text.UTF8Encoding($false)
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
$listener.Start()
$port = $listener.LocalEndpoint.Port
Write-Host ('DOCX Local Editor - http://127.0.0.1:' + $port) -ForegroundColor Green
Start-Process ('http://127.0.0.1:' + $port + '/DOCX_Editor_Local.html')
try {
 while($true) {
  $client = $listener.AcceptTcpClient()
  try {
   $stream = $client.GetStream()
   $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 4096, $true)
   $first = $reader.ReadLine()
   if(!$first) { continue }
   do { $line = $reader.ReadLine() } while($null -ne $line -and $line.Length -gt 0)
   $urlPath = ($first -split ' ')[1].Split('?')[0]
   $urlPath = [System.Uri]::UnescapeDataString($urlPath)
   if($urlPath -eq '/') { $urlPath = '/DOCX_Editor_Local.html' }
   $relative = $urlPath.TrimStart('/').Replace('/',[System.IO.Path]::DirectorySeparatorChar)
   $filePath = [System.IO.Path]::GetFullPath((Join-Path $root $relative))
   $allowed = $filePath.StartsWith($root+[System.IO.Path]::DirectorySeparatorChar,[System.StringComparison]::OrdinalIgnoreCase)
   $code = '200 OK'; $mime = 'application/octet-stream'
   if(!$allowed) { $code='403 Forbidden'; $body=$utf8.GetBytes('Forbidden') }
   elseif(![System.IO.File]::Exists($filePath)) { $code='404 Not Found'; $body=$utf8.GetBytes('Not Found') }
   else {
    $body=[System.IO.File]::ReadAllBytes($filePath)
    if($filePath.EndsWith('.html')) { $mime='text/html; charset=utf-8' }
    elseif($filePath.EndsWith('.json')) { $mime='application/json; charset=utf-8' }
    elseif($filePath.EndsWith('.js')) { $mime='text/javascript; charset=utf-8' }
    elseif($filePath.EndsWith('.docx')) { $mime='application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
   }
   $head="HTTP/1.1 $code`r`nContent-Type: $mime`r`nContent-Length: $($body.Length)`r`nCache-Control: no-store`r`nAccess-Control-Allow-Origin: *`r`nConnection: close`r`n`r`n"
   $headerBytes=[System.Text.Encoding]::ASCII.GetBytes($head)
   $stream.Write($headerBytes,0,$headerBytes.Length)
   $stream.Write($body,0,$body.Length)
   $stream.Flush()
  } catch { Write-Host $_.Exception.Message -ForegroundColor Yellow }
  finally { $client.Close() }
 }
}
finally { $listener.Stop() }
