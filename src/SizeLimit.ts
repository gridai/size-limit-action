// @ts-ignore
import bytes from "bytes";

interface IResult {
  name: string;
  size: number;
  running?: number;
  loading?: number;
  total?: number;
}

const EmptyResult = {
  name: "-",
  size: 0,
  running: 0,
  loading: 0,
  total: 0
};

class SizeLimit {
  static SIZE_RESULTS_HEADER = [
    "Name",
    "Size (gzipped)",
    "Loading time (3g)",
  ];

  static TIME_RESULTS_HEADER = [
    "Name",
    "Size (gzipped)",
    "Loading time (3g)",
    "Running time (snapdragon)",
    "Total time"
  ];

  private formatBytes(size: number): string {
    return bytes.format(size, { unitSeparator: " " });
  }

  private formatTime(seconds: number): string {
    if (seconds >= 1) {
      return `${Math.ceil(seconds * 10) / 10} s`;
    }

    return `${Math.ceil(seconds * 1000)} ms`;
  }

  private formatChange(base: number = 0, current: number = 0): string {
    if (base === 0) {
      return "+100% 🔺";
    }

    const value = ((current - base) / base) * 100;
    const formatted =
      (Math.sign(value) * Math.ceil(Math.abs(value) * 100)) / 100;

    if (value > 0) {
      return `+${formatted}% 🔺`;
    }

    if (value === 0) {
      return `${formatted}%`;
    }

    return `${formatted}% 🔽`;
  }

  private formatLine(value: string, change: string) {
    return `${value} (${change})`;
  }

  private formatSizeResult(
    name: string,
    base: IResult,
    current: IResult
  ): Array<string> {
    return [
      name,
      this.formatLine(
        this.formatBytes(current.size),
        this.formatChange(base.size, current.size)
      ),
      current.loading === undefined ? "-" : this.formatLine(
        this.formatTime(current.loading),
        this.formatChange(base.loading, current.loading)
      ),
    ];
  }

  private formatTimeResult(
    name: string,
    base: IResult,
    current: IResult
  ): Array<string> {
    return [
      name,
      this.formatLine(
        this.formatBytes(current.size),
        this.formatChange(base.size, current.size)
      ),
      current.loading === undefined ? "-" : this.formatLine(
        this.formatTime(current.loading),
        this.formatChange(base.loading, current.loading)
      ),
      current.running === undefined ? "-" : this.formatLine(
        this.formatTime(current.running),
        this.formatChange(base.running, current.running)
      ),
      current.total === undefined ? "-" : this.formatTime(current.total)
    ];
  }

  parseResults(output: string): { [name: string]: IResult } {
    const results = JSON.parse(output);

    return results.reduce(
      (current: { [name: string]: IResult }, result: any) => {
        let time: Pick<IResult, 'loading' | 'running' | 'total'> = {};

        if (result.loading !== undefined) {
          time.loading = +result.oading;
        }

        if (result.running !== undefined) {
          time.running = +result.running;

          if (time.loading !== undefined) {
            time.total = time.loading + time.running;
          }
        }

        return {
          ...current,
          [result.name]: {
            name: result.name,
            size: +result.size,
            ...time
          }
        };
      },
      {}
    );
  }

  formatResults(
    base: { [name: string]: IResult },
    current: { [name: string]: IResult }
  ): Array<Array<string>> {
    const names = [...new Set([...Object.keys(base), ...Object.keys(current)])];
    const isSize = names.every((name: string) => current[name]?.total === undefined);
    const header = isSize
      ? SizeLimit.SIZE_RESULTS_HEADER
      : SizeLimit.TIME_RESULTS_HEADER;
    const fields = names.map((name: string) => {
      const baseResult = base[name] || EmptyResult;
      const currentResult = current[name] || EmptyResult;

      if (isSize) {
        return this.formatSizeResult(name, baseResult, currentResult);
      }
      return this.formatTimeResult(name, baseResult, currentResult);
    });

    return [header, ...fields];
  }
}
export default SizeLimit;
