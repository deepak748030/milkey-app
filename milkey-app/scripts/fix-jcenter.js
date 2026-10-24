const fs = require('fs');
const path = require('path');

function patchFile() {
  const target = path.join(__dirname, '..', 'node_modules', 'react-native-thermal-printer', 'android', 'build.gradle');
  if (!fs.existsSync(target)) return;
  let content = fs.readFileSync(target, 'utf8');
  if (!content.includes('jcenter()')) return;
  const patched = content.replace(/jcenter\(\)/g, 'mavenCentral()');
  fs.writeFileSync(target, patched, 'utf8');
  console.log('[fix-jcenter] Patched jcenter() -> mavenCentral() in', target);
}

try {
  patchFile();
} catch (e) {
  console.error('[fix-jcenter] failed:', e.message);
}
