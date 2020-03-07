import { IContainer, Injectable, ResolveStrategy } from '@spinajs/di';
import * as fs from 'fs';
import * as glob from 'glob';
import * as _ from 'lodash';
import { join, normalize, resolve, sep } from 'path';


/**
 * Hack to inform ts that jasmine var is declared to skip syntax error
 */
declare var jasmine: any;

/**
 * App version struct
 */
interface IFrameworkVersion {
  minor: number;
  major: number;
}

function log(message: string) {
  if (typeof jasmine === 'undefined') {
    console.log('[ CONFIGURATION ] ' + message)
  }
}

function merge(to: any, from: any): void {
  _.mergeWith(to, from, (src, dest) => {
    if (_.isArray(src) && _.isArray(dest)) {
      const tmp = src.concat(dest);
      return _.uniqWith(tmp, _.isEqual);
    } else if (!src) {
      return dest;
    }
  });

  return to;
}

// clean require cache config
// http://stackoverflow.com/questions/9210542/node-js-require-cache-possible-to-invalidate
function uncache(file: string) {
  delete require.cache[file];
  return file;
}

function filterDirs(dir: string) {
  if (fs.existsSync(dir)) {
    log(`Found config dir at ${dir}`);
    return true;
  }
  return false;
}

export abstract class Configuration extends ResolveStrategy {


  /**
   * Configuration base dir, where to look for app config
   */
  public BaseDir: string;

  /**
   * Current running app name
   */
  public RunApp: string;

  /**
   * Get config value for given property. Returns any if value is present, default value if provided or null when empty
   *
   * @param path - path to property eg. ["system","dirs"] or "system" or "system.dirs"
   */
  public abstract get<T>(path: string[] | string, defaultValue?: T): T;
}

@Injectable(Configuration)
export class FrameworkConfiguration extends Configuration {

  /**
   * Configuration base dir, where to look for app config
   */
  public BaseDir: string = './';

  /**
   * Current running app name
   */
  public RunApp: string = undefined;

  /**
   * Default dirs to check for  configuration files
   */
  protected CONFIG_DIRS: string[] = [
    // this module path
    normalize(join(resolve(__dirname), '/../config')),

    // other @spinajs modules paths
    normalize(join(resolve(__dirname).split(sep + 'node_modules')[0], '/node_modulse/@spinajs/orm/config')),
    normalize(join(resolve(__dirname).split(sep + 'node_modules')[0], '/node_modulse/@spinajs/orm-sqlite/config')),
    normalize(join(resolve(__dirname).split(sep + 'node_modules')[0], '/node_modulse/@spinajs/orm-sql/config')),
    normalize(join(resolve(__dirname).split(sep + 'node_modules')[0], '/node_modulse/@spinajs/log/config')),
    normalize(join(resolve(__dirname).split(sep + 'node_modules')[0], '/node_modulse/@spinajs/intl/config')),
    normalize(join(resolve(__dirname).split(sep + 'node_modules')[0], '/node_modulse/@spinajs/cli/config')),

    // project paths - last to allow overwrite @spinajs conf
    normalize(join(resolve(__dirname).split(sep + 'node_modules')[0], '/dist/config')),
    normalize(join(resolve(__dirname).split(sep + 'node_modules')[0], '/build/config')),
    normalize(join(resolve(__dirname).split(sep + 'node_modules')[0], '/config')),
  ];

  /**
   * Loaded & merged configuration
   */
  protected Config: any = {};

  /**
   *
   * @param app application name, pass it when you run in application mode
   * @param baseDir configuration base dir, where to look for application configs
   */
  constructor(app?: string, appBaseDir?: string) {
    super();

    this.RunApp = app ?? parseArgv("--app");
    this.BaseDir = appBaseDir ?? parseArgv("--appPath") ?? join(__dirname, '../apps/');

    log(`Running app: ${this.RunApp}`);
    log(`Base dir at: ${this.BaseDir}`);

    function parseArgv(param: string): string {
      const index = process.argv.indexOf(param);

      if (index === -1 || process.argv.length <= index + 1) {
        return undefined;
      }

      return process.argv[index + 1];
    }
  }

  /**
   * Get config value for given property. Returns Maybe<any> if value is present or Maybe<null> when empty
   *
   * @param path - path to property eg. ["system","dirs"]
   * @param defaultValue - optional, if value at specified path not exists returns default value
   */
  public get<T>(path: string[] | string, defaultValue?: T): T {
    return _.get(this.Config, path, defaultValue);
  }

  public resolve(_container: IContainer) {
    this.configureApp();

    this.load("js", (file: string) => {
      uncache(file);
      return require(file);
    });

    this.load("json", (file: string) => {
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    });

    this.version();
    this._appDirs();
    this.configure();

  }

  protected load(extension: string, callback: (file: string) => any) {
    this.CONFIG_DIRS.filter(filterDirs)
      // get all config files
      .map(d => glob.sync(d + `/**/*.${extension}`))
      // flatten files
      .reduce((prev, current) => {
        return prev.concat(_.flattenDeep(current));
      }, [])
      // normalize & resolve paths to be sure
      .map((f: string) => normalize(resolve(f)))
      // info about files about to load
      .map(f => {
        log(`Found file at: ${f}`);
        return f;
      })
      .map(callback)
      // load & merge configs
      .map(_.curry(merge)(this.Config));
  }

  protected dir(toJoin: string) {
    return normalize(join(resolve(this.BaseDir), toJoin));
  }


  /**
   * adds app dirs to system.dirs config
   */
  protected _appDirs() {
    if (_.isEmpty(this.RunApp)) {
      return;
    }

    for (const prop of Object.keys(this.get(['system', 'dirs'], []))) {
      this.get<string[]>(['system', 'dirs', prop]).push(this.dir(`/${this.RunApp}/${prop}`));
    }
  }

  /**
   * runs configuration func on files
   * eg. when you want to configure stuff at beginning eq. external libs
   */
  protected configure() {
    for (const prop of Object.keys(this.Config)) {
      const subconfig = this.Config[prop];

      if (_.isFunction(subconfig.configure)) {
        subconfig.configure.call(subconfig);
      }
    }
  }

  /**
   * Just prints framework version
   */
  protected version() {
    const version = this.get<IFrameworkVersion>('system.version', undefined);

    if (version) {
      log(`APP VERSION: ${version.major}.${version.minor}`);
    } else {
      log('APP VERSION UNKNOWN');
    }
  }

  /**
   * Gets app name passed to CLI & adds proper config dirs to merge
   */
  protected configureApp() {
    if (typeof this.RunApp === 'string') {
      log(`Application to run: ${this.RunApp}`);
      this.CONFIG_DIRS.push(this.dir(`/${this.RunApp}/config`));
    }
  }
}
