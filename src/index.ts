import { IContainer, Injectable, ResolveStrategy } from '@spinajs/di';
import * as commander from 'commander';
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
   * Get config value for given property. Returns any if value is present, default value if provided or null when empty
   *
   * @param path - path to property eg. ["system","dirs"] or "system" or "system.dirs"
   */
  public abstract get<T>(path: string[] | string, defaultValue?: T): T;
}

@Injectable(Configuration)
export class FrameworkConfiguration extends Configuration {
  /**
   * Default dirs to check for  configuration files
   */
  protected CONFIG_DIRS: string[] = [
    // framework path
    normalize(join(resolve(__dirname), '/../config')),

    // project paths
    normalize(join(resolve(__dirname).split(sep + 'node_modules')[0], '/dist/config')),
    normalize(join(resolve(__dirname).split(sep + 'node_modules')[0], '/build/config')),
    normalize(join(resolve(__dirname).split(sep + 'node_modules')[0], '/config')),
  ];

  /**
   * Loaded & merged configuration
   */
  protected Config: any = {};

  /**
   * Configuration base dir, where to look for app config
   */
  protected BaseDir: string = './';

  /**
   * Current running app name
   */
  protected RunApp: string = undefined;

  /**
   *
   * @param app application name, pass it when you run in application mode
   * @param baseDir configuration base dir, where to look for application configs
   */
  constructor(app?: string, appBaseDir?: string) {
    super();

    if (!app) {
      commander.option('-a, --app <appname>', 'Application name to run');
      commander.option('-p, --apppath <apppath>', 'Custom app path');
      commander.parse(process.argv);
    }

    this.RunApp = app || commander.app;
    this.BaseDir = commander.apppath ? commander.apppath : appBaseDir ? appBaseDir : join(__dirname, '../apps/');
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
