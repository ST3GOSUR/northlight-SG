// READ-ONLY PC health report. Run: node tools/pc-health.js
// Only reads: Node's own OS and disk info, plus two read-only PowerShell queries. Changes no setting.
const os = require('os');
const fs = require('fs');
const { execFileSync } = require('child_process');
const lib = require('./lib');

if (process.platform !== 'win32') { console.error('pc-health.js supports Windows only.'); process.exit(2); }

// Fixed arguments, no shell, no user input: nothing to inject into.
function ps(command) {
  try {
    return execFileSync('powershell', ['-NoProfile', '-Command', command], { encoding: 'utf8', timeout: 30000 });
  } catch (e) {
    return ''; // blocked or failed: the judge turns empty output into SKIP
  }
}

const drive = (process.env.SystemDrive || 'C:') + '\\';
const disk = fs.statfsSync(drive);

const results = [
  lib.result('OS', 'PASS', `${os.type()} ${os.release()} (${os.arch()}), up ${Math.floor(os.uptime() / 3600)} h`),
  lib.judgeDisk(disk.bavail * disk.bsize, disk.blocks * disk.bsize),
  lib.judgeFirewall(lib.parseFirewall(ps("Get-NetFirewallProfile | ForEach-Object { $_.Name + '=' + $_.Enabled }"))),
  lib.judgeUpdates(lib.parseLastUpdate(
    ps("Get-HotFix | Where-Object InstalledOn | Sort-Object InstalledOn -Descending | Select-Object -First 1 | ForEach-Object { $_.InstalledOn.ToString('yyyy-MM-dd') }"))),
];

results.forEach((r) => console.log(lib.formatLine(r)));
process.exitCode = results.some((r) => r.status === 'FAIL') ? 1 : 0;
