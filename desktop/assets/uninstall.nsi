/**
 * EPM Commercial - Custom Uninstaller Script (NSIS)
 * This script is embedded in the NSIS installer to handle uninstallation
 */

!include "MUI2.nsh"
!include "WinMessages.nsh"

; Uninstaller configuration
Name "EPM Monitor"
OutFile "uninstall.exe"
SilentInstall / silent

; Variables
Var PASSWORD_VERIFIED
Var PASSWORD_REQUIRED

; Installer pages
!define MUI_ABORTWARNING

; Request application privileges
RequestExecutionLevel admin

; Installer Functions
Function .onInit
  ; Check if uninstallation is allowed
  Call CheckUninstallAllowed
  IfErrors silent_abort

  ; Show password dialog if required
  Call ShowPasswordDialog
  ${If} $PASSWORD_VERIFIED == "0"
    MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "Invalid password. Uninstall cancelled." IDOK silent_abort
  ${EndIf}

  silent_abort:
  Abort
FunctionEnd

; Check if uninstallation is allowed
Function CheckUninstallAllowed
  ; Read registry to check if license is valid
  ReadRegStr $0 HKCU "Software\EPMMonitor" "LicenseValid"
  ${If} $0 == "1"
    ; License is valid, password required
    StrCpy $PASSWORD_REQUIRED "1"
  ${Else}
    ; No license, allow uninstall
    StrCpy $PASSWORD_REQUIRED "0"
  ${EndIf}
FunctionEnd

; Show password dialog
Function ShowPasswordDialog
  ; Launch password verification dialog
  nsExec::ExecToLog '"$INSTDIR\EPMMonitor.exe" --uninstall-password'
  Pop $0

  ${If} $0 == "0"
    StrCpy $PASSWORD_VERIFIED "1"
  ${Else}
    StrCpy $PASSWORD_VERIFIED "0"
  ${EndIf}
FunctionEnd

; Silent abort handler
Function un.onInit
  Abort
FunctionEnd

; Uninstaller section
Section "Uninstall"
  ; Stop the EPM Monitor service
  nsExec::ExecToLog 'net stop EPMMonitorService'

  ; Remove application files
  RMDir /r "$INSTDIR"

  ; Remove registry entries
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\EPMMonitor"
  DeleteRegKey HKCU "Software\EPMMonitor"

  ; Remove startup entry
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "EPMMonitor"

  ; Remove desktop shortcut
  Delete "$DESKTOP\EPM Monitor.lnk"

  ; Remove start menu entry
  RMDir /r "$SMPROGRAMS\EPM Monitor"

  ; Remove app data
  RMDir /r "$APPDATA\EPMMonitor"

SectionEnd