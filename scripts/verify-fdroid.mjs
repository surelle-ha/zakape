import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const metadataRoot = resolve(repositoryRoot, 'fastlane/metadata/android/en-US')
const wrapperRoot = resolve(repositoryRoot, 'apps/studio/src-tauri/gen/android/gradle/wrapper')
const androidMain = resolve(repositoryRoot, 'apps/studio/src-tauri/gen/android/app/src/main')
const distributionHash = 'bd71102213493060956ec229d946beee57158dbd89d0e62b91bca0fa2c5f3531'
const wrapperHash = '7d3a4ac4de1c32b59bc6a4eb8ecb8e612ccd0cf1ae1e99f66902da64df296172'

const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

const textMetadata = async (name, maxLength) => {
  const value = (await readFile(resolve(metadataRoot, name), 'utf8')).trim()
  assert(value.length > 0, `${name} must not be empty.`)
  assert(value.length <= maxLength, `${name} exceeds ${maxLength} characters.`)
  return value
}

const pngDimensions = async (path) => {
  const data = await readFile(path)
  assert(data.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')), `${path} is not PNG.`)
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) }
}

await textMetadata('title.txt', 30)
await textMetadata('short_description.txt', 80)
await textMetadata('full_description.txt', 4000)

const changelogs = (await readdir(resolve(metadataRoot, 'changelogs'))).filter((name) =>
  /^\d+\.txt$/.test(name),
)
assert(changelogs.length > 0, 'Fastlane needs at least one version-code changelog.')
for (const changelog of changelogs) await textMetadata(`changelogs/${changelog}`, 500)

const icon = await pngDimensions(resolve(metadataRoot, 'images/icon.png'))
assert(icon.width <= 512 && icon.height <= 512, 'Fastlane icon must be at most 512 x 512.')
const feature = await pngDimensions(resolve(metadataRoot, 'images/featureGraphic.png'))
assert(feature.width === 1024 && feature.height === 500, 'Feature graphic must be 1024 x 500.')

for (const directory of ['phoneScreenshots', 'sevenInchScreenshots']) {
  const screenshots = (await readdir(resolve(metadataRoot, `images/${directory}`))).filter((name) =>
    name.endsWith('.png'),
  )
  assert(screenshots.length > 0, `${directory} must contain a PNG screenshot.`)
  for (const screenshot of screenshots) {
    const size = await pngDimensions(resolve(metadataRoot, `images/${directory}/${screenshot}`))
    assert(size.width >= 320 && size.height >= 320, `${screenshot} is too small for store use.`)
  }
}

const properties = await readFile(resolve(wrapperRoot, 'gradle-wrapper.properties'), 'utf8')
assert(
  properties.includes(
    'distributionUrl=https\\://services.gradle.org/distributions/gradle-8.14.3-bin.zip',
  ),
  'Gradle wrapper distribution must remain on 8.14.3.',
)
assert(
  properties.includes(`distributionSha256Sum=${distributionHash}`),
  'Gradle distribution SHA-256 is missing or incorrect.',
)
const wrapperJar = await readFile(resolve(wrapperRoot, 'gradle-wrapper.jar'))
assert(
  createHash('sha256').update(wrapperJar).digest('hex') === wrapperHash,
  'Gradle wrapper JAR does not match Gradle 8.14.3.',
)

const manifest = await readFile(resolve(androidMain, 'AndroidManifest.xml'), 'utf8')
assert(manifest.includes('android:allowBackup="true"'), 'Android project backup must be enabled.')
assert(
  manifest.includes('android:hasFragileUserData="true"'),
  'Android uninstall must offer to retain artist data.',
)
assert(
  manifest.includes('android:dataExtractionRules="@xml/data_extraction_rules"'),
  'Android 12+ data extraction rules are missing.',
)
assert(
  manifest.includes('android:fullBackupContent="@xml/backup_rules"'),
  'Legacy Android backup rules are missing.',
)
for (const rulesFile of ['backup_rules.xml', 'data_extraction_rules.xml']) {
  const rules = await readFile(resolve(androidMain, 'res/xml', rulesFile), 'utf8')
  assert(rules.includes('domain="root"'), `${rulesFile} must include the native data root.`)
  assert(rules.includes('path="zakape/"'), `${rulesFile} must include only Zakape project mirrors.`)
}

console.log('F-Droid metadata and Gradle wrapper integrity checks passed.')
