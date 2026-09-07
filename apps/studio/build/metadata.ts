import { execFileSync } from 'node:child_process'

export type BuildMetadata = {
  buildId: string
  releaseChannel: string
  buildType: string
}

const safeValue = (value: string | undefined, fallback: string) => {
  const normalized = value?.trim().replace(/[^a-zA-Z0-9._-]/g, '')
  return normalized ? normalized.slice(0, 64) : fallback
}

const localGitSha = () => {
  try {
    return execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch {
    return undefined
  }
}

export const resolveBuildMetadata = (
  environment: Record<string, string | undefined> = process.env,
  gitSha?: string | null,
): BuildMetadata => {
  const resolvedGitSha = gitSha === undefined ? localGitSha() : gitSha
  return {
    buildId: safeValue(
      environment.ZAKAPE_BUILD_SHA ?? environment.GITHUB_SHA ?? resolvedGitSha ?? undefined,
      'development',
    ),
    releaseChannel: safeValue(environment.ZAKAPE_RELEASE_CHANNEL, 'development'),
    buildType: safeValue(environment.ZAKAPE_BUILD_TYPE, 'development'),
  }
}
