; Custom NSIS installer script for ARGUS
; Checks for Visual C++ Redistributable and provides installation guidance

!macro customInit
  ; Check if Visual C++ 2015-2022 Redistributable is installed
  ; Check for x64 version
  ReadRegStr $0 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Installed"
  ${If} $0 == "1"
    ; VC++ Redistributable is installed
    DetailPrint "Visual C++ Redistributable 2015-2022 (x64) found"
  ${Else}
    ; Not installed - show warning
    MessageBox MB_ICONEXCLAMATION|MB_OKCANCEL \
      "Microsoft Visual C++ Redistributable 2015-2022 is not installed.$\n$\n\
       ARGUS requires this to run properly.$\n$\n\
       Click OK to continue installation (you'll need to install it later).$\n\
       Click Cancel to abort installation.$\n$\n\
       Download from: https://aka.ms/vs/17/release/vc_redist.x64.exe" \
      IDOK continue
      Abort "Installation cancelled. Please install Visual C++ Redistributable first."
      continue:
  ${EndIf}
!macroend

!macro customInstall
  ; Create a readme file with troubleshooting info
  FileOpen $0 "$INSTDIR\README-DLL-Issues.txt" w
  FileWrite $0 "ARGUS - Python DLL Troubleshooting$\r$\n"
  FileWrite $0 "=====================================$\r$\n$\r$\n"
  FileWrite $0 "If you see 'Failed to load Python DLL' error:$\r$\n$\r$\n"
  FileWrite $0 "1. Install Visual C++ Redistributable 2015-2022 (x64)$\r$\n"
  FileWrite $0 "   Download: https://aka.ms/vs/17/release/vc_redist.x64.exe$\r$\n$\r$\n"
  FileWrite $0 "2. Restart your computer after installing$\r$\n$\r$\n"
  FileWrite $0 "3. Check Windows Defender / Antivirus is not blocking:$\r$\n"
  FileWrite $0 "   $INSTDIR\resources\python\ARGUS_core.exe$\r$\n"
  FileWrite $0 "   $INSTDIR\resources\python\_internal\python311.dll$\r$\n$\r$\n"
  FileWrite $0 "4. Run ARGUS as Administrator (right-click > Run as administrator)$\r$\n$\r$\n"
  FileWrite $0 "5. If issue persists, check Event Viewer for detailed error:$\r$\n"
  FileWrite $0 "   Windows Logs > Application > Look for errors related to ARGUS$\r$\n$\r$\n"
  FileWrite $0 "Python Location: $INSTDIR\resources\python\ARGUS_core.exe$\r$\n"
  FileWrite $0 "DLLs Location: $INSTDIR\resources\python\_internal\$\r$\n"
  FileClose $0
!macroend
