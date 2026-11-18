; Blockhaus – Windows-Installer (Inno Setup 6). Wird in GitHub Actions gebaut:
;   iscc /DAppVersion=0.1.0 packaging\windows\blockhaus.iss
; Erwartet das portable Paket in build\blockhaus (python packaging\build.py portable).

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif

[Setup]
AppId={{8F3C2A51-6B2E-4D7B-9C1A-B10C4A05E001}
AppName=Blockhaus
AppVersion={#AppVersion}
AppVerName=Blockhaus {#AppVersion}
AppPublisher=Blockhaus
AppPublisherURL=https://github.com/ZitronenSucht/blockhaus
DefaultDirName={localappdata}\Programs\Blockhaus
PrivilegesRequired=lowest
DisableProgramGroupPage=yes
DisableDirPage=auto
OutputDir=..\..\dist
OutputBaseFilename=Blockhaus-Setup-windows-x86_64
SetupIconFile=..\..\build\blockhaus\icons\blockhaus.ico
UninstallDisplayIcon={app}\icons\blockhaus.ico
UninstallDisplayName=Blockhaus
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
ShowLanguageDialog=auto
CloseApplications=force

[Languages]
Name: "de"; MessagesFile: "compiler:Languages\German.isl"
Name: "en"; MessagesFile: "compiler:Default.isl"

[CustomMessages]
de.ModeGroup=Wie möchtest du Blockhaus benutzen?
en.ModeGroup=How do you want to use Blockhaus?
de.ModeGui=Als Desktop-App mit eigenem Fenster (empfohlen)
en.ModeGui=As a desktop app with its own window (recommended)
de.ModeTerminal=Im Hintergrund, Bedienung im Browser (für Server-Rechner)
en.ModeTerminal=In the background, used in the browser (for server machines)
de.Extras=Zusätzlich:
en.Extras=Additionally:
de.Autostart=Blockhaus beim Anmelden bei Windows im Hintergrund starten
en.Autostart=Start Blockhaus in the background when signing in to Windows
de.Desktop=Verknüpfung auf dem Desktop
en.Desktop=Shortcut on the desktop
de.AskDeleteWorlds=Sollen auch der Minecraft-Server, deine Welten und alle Backups gelöscht werden?%n%nJa = alles löschen.%nNein = Server und Backups werden in deinen Benutzerordner (Blockhaus-Sicherung-…) verschoben.
en.AskDeleteWorlds=Should the Minecraft server, your worlds and all backups be deleted as well?%n%nYes = delete everything.%nNo = server and backups are moved to your user folder (Blockhaus-Sicherung-…).
de.OpenBrowser=Blockhaus im Browser öffnen
en.OpenBrowser=Open Blockhaus in the browser

[Tasks]
Name: "modegui"; Description: "{cm:ModeGui}"; GroupDescription: "{cm:ModeGroup}"; Flags: exclusive
Name: "modeterminal"; Description: "{cm:ModeTerminal}"; GroupDescription: "{cm:ModeGroup}"; Flags: exclusive unchecked
Name: "desktopicon"; Description: "{cm:Desktop}"; GroupDescription: "{cm:Extras}"
Name: "autostart"; Description: "{cm:Autostart}"; GroupDescription: "{cm:Extras}"; Flags: unchecked

[InstallDelete]
; alte Code-Versionen ersetzen (Updates legen sie selbst an)
Type: filesandordirs; Name: "{app}\app"

[Files]
Source: "..\..\build\blockhaus\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{userprograms}\Blockhaus"; Filename: "{app}\runtime\pythonw.exe"; Parameters: """{app}\launch.py"" --gui"; WorkingDir: "{app}"; IconFilename: "{app}\icons\blockhaus.ico"; Tasks: modegui
Name: "{userdesktop}\Blockhaus"; Filename: "{app}\runtime\pythonw.exe"; Parameters: """{app}\launch.py"" --gui"; WorkingDir: "{app}"; IconFilename: "{app}\icons\blockhaus.ico"; Tasks: modegui and desktopicon
Name: "{userprograms}\Blockhaus"; Filename: "{app}\runtime\pythonw.exe"; Parameters: """{app}\launch.py"" --browser"; WorkingDir: "{app}"; IconFilename: "{app}\icons\blockhaus.ico"; Tasks: modeterminal
Name: "{userdesktop}\Blockhaus"; Filename: "{app}\runtime\pythonw.exe"; Parameters: """{app}\launch.py"" --browser"; WorkingDir: "{app}"; IconFilename: "{app}\icons\blockhaus.ico"; Tasks: modeterminal and desktopicon

[Run]
Filename: "{app}\runtime\pythonw.exe"; Parameters: """{app}\launch.py"" autostart on"; Flags: runhidden; Tasks: autostart
Filename: "{app}\runtime\pythonw.exe"; Parameters: """{app}\launch.py"" --gui"; Description: "{cm:LaunchProgram,Blockhaus}"; Flags: nowait postinstall skipifsilent; Tasks: modegui
Filename: "{app}\runtime\pythonw.exe"; Parameters: """{app}\launch.py"" --browser"; Description: "{cm:OpenBrowser}"; Flags: nowait postinstall skipifsilent; Tasks: modeterminal

[UninstallRun]
; Blockhaus beenden, Autostart entfernen, Daten löschen bzw. Welten sichern – das Programm selbst entfernt Inno Setup
Filename: "{app}\runtime\python.exe"; Parameters: """{app}\launch.py"" uninstall --yes --keep-program {code:WorldsFlag}"; Flags: runhidden waituntilterminated; RunOnceId: "BlockhausData"

[UninstallDelete]
Type: filesandordirs; Name: "{app}"

[Code]
var
  DeleteWorlds: Boolean;

function InitializeUninstall(): Boolean;
begin
  DeleteWorlds := MsgBox(CustomMessage('AskDeleteWorlds'), mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES;
  Result := True;
end;

function WorldsFlag(Param: String): String;
begin
  if DeleteWorlds then
    Result := '--delete-worlds'
  else
    Result := '';
end;
