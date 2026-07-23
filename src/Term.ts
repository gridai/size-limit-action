import { exec } from "@actions/exec";
import hasYarn from "has-yarn";
import hasPNPM from "has-pnpm";

import process from 'node:process';
import path from 'node:path';
import fs from 'node:fs';

function hasBun(cwd = process.cwd()) {
	return fs.existsSync(path.resolve(cwd, 'bun.lockb'));
}

const INSTALL_STEP = "install";
const BUILD_STEP = "build";

class Term {
  /**
   * Autodetects and gets the current package manager for the current directory, either yarn, pnpm, bun,
   * or npm. Default is `npm`.
   *
   * @param directory The current directory
   * @returns The detected package manager in use, one of `yarn`, `pnpm`, `npm`, `bun`
   */
  getPackageManager(directory?: string): string {
    return hasYarn(directory) ? "yarn" : hasPNPM(directory) ? "pnpm" : hasBun(directory) ? "bun" : "npm";
  }

  async execSizeLimit(
    branch?: string,
    skipStep?: string,
    buildScript?: string,
    cleanScript?: string,
    windowsVerbatimArguments?: boolean,
    directory?: string,
    script?: string,
    packageManager?: string
  ): Promise<{ status: number; output: string }> {
    const manager = packageManager || this.getPackageManager(directory);
    let output = "";
    let status = 0;
    let originalRef = "";

    if (branch) {
      try {
        await exec(`git fetch origin ${branch} --depth=1`);
      } catch (error) {
        console.log("Fetch failed", error.message);
      }

      // Remember where we are so we can return here after building the base
      // branch. Without this the workspace is left checked out on the base ref,
      // which breaks any later step or post-action that expects the original
      // tree (e.g. a local composite action whose post-step files then vanish).
      await exec(`git rev-parse HEAD`, [], {
        listeners: {
          stdout: (data: Buffer) => {
            originalRef += data.toString();
          }
        }
      });
      originalRef = originalRef.trim();

      await exec(`git checkout -f ${branch}`);
    }

    try {
      if (skipStep !== INSTALL_STEP && skipStep !== BUILD_STEP) {
        await exec(`${manager} install`, [], {
          cwd: directory
        });
      }

      if (skipStep !== BUILD_STEP) {
        const buildStep = buildScript || "build";
        await exec(`${manager} run ${buildStep}`, [], {
          cwd: directory
        });
      }

      status = await exec(script, [], {
        windowsVerbatimArguments,
        ignoreReturnCode: true,
        listeners: {
          stdout: (data: Buffer) => {
            output += data.toString();
          }
        },
        cwd: directory
      });

      if (cleanScript) {
        await exec(`${manager} run ${cleanScript}`, [], {
          cwd: directory
        });
      }
    } finally {
      // Restore the original checkout even if the base build fails, so we never
      // leave the workspace stranded on the base ref.
      if (originalRef) {
        await exec(`git checkout -f ${originalRef}`);
      }
    }

    return {
      status,
      output
    };
  }
}

export default Term;
