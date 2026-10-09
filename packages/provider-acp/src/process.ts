import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'

export interface OwnedProcess {
  child: ChildProcessWithoutNullStreams
  close(): Promise<void>
}

export function startProcess(
  command: string,
  args: string[],
  cwd: string,
  env: Record<string, string | undefined>,
  graceMs: number,
): OwnedProcess {
  let child: ChildProcessWithoutNullStreams
  try {
    child = spawn(command, args, { cwd, env, stdio: 'pipe', shell: false })
  } catch {
    throw new Error('ACP process could not start')
  }
  child.stderr.resume()
  child.stdin.on('error', () => undefined)
  const exited = new Promise<void>((resolve, reject) => {
    child.once('close', () => resolve())
    child.once('error', () => reject(new Error('ACP process could not start')))
  })
  void exited.catch(() => undefined)
  let closing: Promise<void> | undefined
  const stop = async (): Promise<void> => {
    if (child.exitCode !== null || child.signalCode !== null) {
      await within(exited, graceMs, 'ACP process closure was not confirmed')
      return
    }
    child.stdin.end()
    if (await settledWithin(exited, graceMs)) return
    child.kill('SIGTERM')
    if (await settledWithin(exited, graceMs)) return
    child.kill('SIGKILL')
    await within(exited, graceMs, 'ACP process closure was not confirmed')
  }
  return {
    child,
    close: () => {
      closing ??= stop()
      return closing
    },
  }
}

export async function within<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function settledWithin(promise: Promise<void>, timeoutMs: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise.then(() => true),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}
