param(
  [string]$Executable = ''
)

$ErrorActionPreference = 'Stop'

if ($env:OS -ne 'Windows_NT') {
  throw 'The native window-close smoke test requires Windows UI Automation.'
}

if (-not $Executable) {
  $Executable = Join-Path $PSScriptRoot '..\..\src-tauri\target\release\zakape.exe'
}
$Executable = [System.IO.Path]::GetFullPath($Executable)
if (-not (Test-Path -LiteralPath $Executable -PathType Leaf)) {
  throw "Build the desktop app before running this test: $Executable"
}

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type @'
using System;
using System.Runtime.InteropServices;

public static class ZakapeNativeWindowProbe {
  [DllImport("user32.dll")]
  public static extern bool SetWindowPos(
    IntPtr window,
    IntPtr insertAfter,
    int x,
    int y,
    int width,
    int height,
    uint flags
  );

  [DllImport("user32.dll")]
  public static extern bool ShowWindow(IntPtr window, int command);
}
'@

function Find-NamedButton {
  param(
    [System.Windows.Automation.AutomationElement]$Root,
    [string]$Name
  )

  $nameCondition = [System.Windows.Automation.PropertyCondition]::new(
    [System.Windows.Automation.AutomationElement]::NameProperty,
    $Name
  )
  $typeCondition = [System.Windows.Automation.PropertyCondition]::new(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
    [System.Windows.Automation.ControlType]::Button
  )
  $condition = [System.Windows.Automation.AndCondition]::new(
    $nameCondition,
    $typeCondition
  )
  return $Root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $condition)
}

function Wait-ForButton {
  param(
    [System.Diagnostics.Process]$Process,
    [string]$Name,
    [int]$Attempts = 80
  )

  for ($attempt = 0; $attempt -lt $Attempts; $attempt += 1) {
    $Process.Refresh()
    if ($Process.HasExited) {
      throw "Zakape exited before the '$Name' button became available."
    }
    $root = [System.Windows.Automation.AutomationElement]::FromHandle(
      $Process.MainWindowHandle
    )
    $button = Find-NamedButton -Root $root -Name $Name
    if ($button) {
      return $button
    }
    Start-Sleep -Milliseconds 250
  }
  throw "The '$Name' button did not become available."
}

$application = Start-Process -FilePath $Executable -PassThru -WindowStyle Hidden
try {
  for (
    $attempt = 0;
    $attempt -lt 40 -and $application.MainWindowHandle -eq 0;
    $attempt += 1
  ) {
    Start-Sleep -Milliseconds 250
    $application.Refresh()
  }
  if ($application.MainWindowHandle -eq 0) {
    throw 'Zakape did not create its main window.'
  }

  # WebView accessibility content is available only for a shown window. Keep the
  # smoke-test window offscreen so it does not interrupt the active desktop.
  [ZakapeNativeWindowProbe]::SetWindowPos(
    $application.MainWindowHandle,
    [IntPtr]::Zero,
    -32000,
    -32000,
    1440,
    960,
    0x0004
  ) | Out-Null
  [ZakapeNativeWindowProbe]::ShowWindow($application.MainWindowHandle, 5) | Out-Null

  $closeButton = Wait-ForButton -Process $application -Name 'Close window'
  $closeButton.GetCurrentPattern(
    [System.Windows.Automation.InvokePattern]::Pattern
  ).Invoke()

  $exitButton = Wait-ForButton -Process $application -Name 'Exit Zakape' -Attempts 40
  $exitButton.GetCurrentPattern(
    [System.Windows.Automation.InvokePattern]::Pattern
  ).Invoke()

  if (-not $application.WaitForExit(10000)) {
    throw 'Zakape stayed open after exit confirmation.'
  }
  if ($application.ExitCode -ne 0) {
    throw "Zakape exited with code $($application.ExitCode)."
  }
  Write-Output 'Native exit confirmation closed Zakape with exit code 0.'
}
finally {
  if (-not $application.HasExited) {
    Stop-Process -Id $application.Id -Force
  }
}
