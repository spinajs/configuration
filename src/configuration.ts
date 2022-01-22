import { IContainer, Injectable } from '@spinajs/di';
import { InvalidOperation } from '@spinajs/exceptions';
import { join, normalize, resolve } from 'path';
import { ConfigurationSource } from './sources';
import { Configuration } from './types';
import { parseArgv } from './util';
import * as _ from "lodash";

@Injectable(Configuration)
export class FrameworkConfiguration extends Configuration {
  /**
   * Configuration base dir, where to look for app config
   */
  public AppBaseDir: string = './';

  /**
   * Current running app name
   */
  public RunApp: string = undefined;

  /**
   * Loaded & merged configuration
   */
  protected Config: any = {};

  protected CustomConfigPaths: string[];

  protected Sources: ConfigurationSource[];

  /**
   *
   * @param app application name, pass it when you run in application mode
   * @param baseDir configuration base dir, where to look for application configs
   * @param cfgCustomPaths custom cfg paths eg. to load config from non standard folders ( usefull in tests )
   */
  constructor(app?: string, appBaseDir?: string, cfgCustomPaths?: string[]) {
    super();

    this.CustomConfigPaths = cfgCustomPaths ?? [];
    this.RunApp = app ?? parseArgv('--app');
    this.AppBaseDir = appBaseDir ?? parseArgv('--appPath') ?? join(__dirname, '../apps/');

  }

  /**
   * Get config value for given property. If value not exists it returns default value, if default value is not provided returns undefined
   *
   * @param path - path to property eg. ["system","dirs"]
   * @param defaultValue - optional, if value at specified path not exists returns default value
   * @returns { T | undefined }
   */
  public get<T>(path: string[] | string, defaultValue?: T): T {
    return _.get(this.Config, path, defaultValue);
  }

  public async resolveAsync(container: IContainer): Promise<void> {

    if (!container.hasRegistered(ConfigurationSource)) {
      throw new InvalidOperation("No configuration sources configured. Please ensure that config module have any source to read from !");
    }

    this.Sources = await container.resolve(Array.ofType(ConfigurationSource), [this.RunApp, this.CustomConfigPaths, this.AppBaseDir]);

    await Promise.all(this.Sources.map(s => s.Load())).then(result => {
      result.map(c => _.merge(this.Config, c));
    });

    this.applyAppDirs();
    this.configure();
    

    await super.resolveAsync(container);
  }


  protected dir(toJoin: string) {
    return normalize(join(resolve(this.BaseDir), toJoin));
  }

  /**
   * adds app dirs to system.dirs config
   */
  protected applyAppDirs() {

    if (!this.RunApp) {
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
}
