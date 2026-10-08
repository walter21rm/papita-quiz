# Converts an Office document using the locally installed Microsoft Office (COM automation).
#   word / powerpoint -> PDF
#   excel             -> XLSX (legacy .xls workbooks)
# Exit codes: 0 ok, 2 no output produced, 3 Office application not available.
param(
  [Parameter(Mandatory = $true)][string]$InputPath,
  [Parameter(Mandatory = $true)][string]$OutputPath,
  [Parameter(Mandatory = $true)][ValidateSet('word', 'powerpoint', 'excel')][string]$App
)

$ErrorActionPreference = 'Stop'
$ForceDisableMacros = 3
# Passing a password keeps Office from showing a prompt for protected files (they fail instead).
# Legacy formats only accept up to 15 characters.
$DummyPassword = 'papita'

function Release-Com($obj) {
  if ($null -ne $obj) {
    try { [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($obj) } catch {}
  }
}

function New-OfficeApp([string]$progId) {
  try {
    return New-Object -ComObject $progId
  } catch {
    [Console]::Error.WriteLine("OFFICE_NOT_AVAILABLE: $progId")
    exit 3
  }
}

switch ($App) {
  'word' {
    $word = New-OfficeApp 'Word.Application'
    $doc = $null
    try {
      $word.Visible = $false
      $word.DisplayAlerts = 0
      $word.AutomationSecurity = $ForceDisableMacros
      # Open(FileName, ConfirmConversions, ReadOnly, AddToRecentFiles, PasswordDocument, PasswordTemplate)
      $doc = $word.Documents.Open($InputPath, $false, $true, $false, $DummyPassword, $DummyPassword)
      # 17 = wdExportFormatPDF
      $doc.ExportAsFixedFormat($OutputPath, 17)
    } finally {
      if ($null -ne $doc) { try { $doc.Close(0) } catch {} }
      Release-Com $doc
      try { if ($word.Documents.Count -eq 0) { $word.Quit(0) } } catch {}
      Release-Com $word
    }
  }
  'powerpoint' {
    $ppt = New-OfficeApp 'PowerPoint.Application'
    $presentation = $null
    try {
      $ppt.AutomationSecurity = $ForceDisableMacros
      # Open(FileName, ReadOnly = msoTrue, Untitled = msoFalse, WithWindow = msoFalse)
      $presentation = $ppt.Presentations.Open($InputPath, -1, 0, 0)
      # 32 = ppSaveAsPDF
      $presentation.SaveAs($OutputPath, 32)
    } finally {
      if ($null -ne $presentation) { try { $presentation.Close() } catch {} }
      Release-Com $presentation
      # PowerPoint is single-instance: only quit if the user has nothing else open.
      try { if ($ppt.Presentations.Count -eq 0) { $ppt.Quit() } } catch {}
      Release-Com $ppt
    }
  }
  'excel' {
    $excel = New-OfficeApp 'Excel.Application'
    $workbook = $null
    try {
      $excel.Visible = $false
      $excel.DisplayAlerts = $false
      $excel.AutomationSecurity = $ForceDisableMacros
      # Open(Filename, UpdateLinks, ReadOnly, Format, Password, WriteResPassword, IgnoreReadOnlyRecommended)
      $workbook = $excel.Workbooks.Open($InputPath, 0, $true, 1, $DummyPassword, $DummyPassword, $true)
      # 51 = xlOpenXMLWorkbook (.xlsx)
      $workbook.SaveAs($OutputPath, 51)
    } finally {
      if ($null -ne $workbook) { try { $workbook.Close($false) } catch {} }
      Release-Com $workbook
      try { if ($excel.Workbooks.Count -eq 0) { $excel.Quit() } } catch {}
      Release-Com $excel
    }
  }
}

[System.GC]::Collect()
[System.GC]::WaitForPendingFinalizers()

if (-not (Test-Path -LiteralPath $OutputPath)) {
  [Console]::Error.WriteLine('CONVERSION_FAILED')
  exit 2
}
exit 0
