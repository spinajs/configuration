import { Injectable } from "@spinajs/di";
import glob = require("glob");
import _ = require("lodash");
import { join, normalize, resolve } from 'path';
import { filterDirs, findBasePath, uncache } from "./util";
import * as fs from 'fs';
import * as path from 'path';
import { Log } from "@spinajs/log";


function mergeArrays(target: any, source: any) {
    if (_.isArray(target)) {
        return target.concat(source);
    }
}

const DEFAULT_CONFIG_DIRS = [
    // this module path
    normalize(join(resolve(__dirname), '/../config')),

    // for tests, in src dir
    normalize(join(resolve(__dirname), '/config')),


    // other @spinajs modules paths
    '/node_modules/@spinajs/*/lib/config',


    // project paths - last to allow overwrite @spinajs conf
    '/lib/config',
    '/dist/config',
    '/build/config',
    '/config',
];

export abstract class ConfigurationSource {
    public abstract Load(): Promise<any>;
}

export abstract class BaseFileSource extends ConfigurationSource {
    /**
     * Configuration base dir, where to look for app config
     */
    public BaseDir: string = './';

    /**
    * Default dirs to check for  configuration files
    */
    protected CONFIG_DIRS: string[] = [];

    constructor(protected RunApp?: string, protected CustomConfigPaths?: string[], protected appBaseDir?: string) {
        super();
    }

    protected load(extension: string, callback: (file: string) => any) {

        let config = {};
        let dirs = this.CONFIG_DIRS;
        const basePath = findBasePath(process.cwd());


        if (this.RunApp) {
            dirs = dirs.concat([join(this.appBaseDir, `/${this.RunApp}/config`)]);
        }

        if (this.CustomConfigPaths) {
            dirs = dirs.concat(this.CustomConfigPaths);
        }

        dirs.map(f => path.isAbsolute(f) ? f : join(basePath, f))
            .filter(filterDirs)
            // get all config files
            .map(d => glob.sync(d + `/**/${extension}`))
            // flatten files
            .reduce((prev, current) => {
                return prev.concat(_.flattenDeep(current));
            }, [])
            // normalize & resolve paths to be sure
            .map((f: string) => normalize(resolve(f)))
            .map(callback)
            .filter((v) => v !== null)
            // load & merge configs
            .map(c => _.mergeWith(config, c, mergeArrays));

        return config;
    }
}

@Injectable(ConfigurationSource)
export class JsFileSource extends BaseFileSource {

    /**
   * Default dirs to check for  configuration files
   */
    protected CONFIG_DIRS: string[] = DEFAULT_CONFIG_DIRS;

    public async Load(): Promise<any> {
        const common = this.load('!(*.dev|*.prod).js', _load);

        if (process.env.NODE_ENV) {
            if (process.env.NODE_ENV === "development") {
                return _.mergeWith(common, this.load("*.dev.js", _load), mergeArrays);
            } else if (process.env.NODE_ENV === "production") {
                return _.mergeWith(common, this.load("*.prod.js", _load), mergeArrays);
            }
        }

        return common;

        function _load(file: string) {

            Log.trace(`Found configuration file at ${file}`, "Configuration");

            uncache(file);
            return require(file);
        }
    }

}


@Injectable(ConfigurationSource)
export class JsonFileSource extends BaseFileSource {

    /**
     * Default dirs to check for  configuration files
     */
    protected CONFIG_DIRS: string[] = DEFAULT_CONFIG_DIRS;

    public async Load(): Promise<any> {
        const common = this.load('!(*.dev|*.prod).json', _load);

        if (process.env.NODE_ENV) {
            if (process.env.NODE_ENV === "development") {
                return _.merge(common, this.load("*.dev.json", _load));
            } else if (process.env.NODE_ENV === "production") {
                return _.merge(common, this.load("*.prod.json", _load));
            }
        }

        return common;

        function _load(file: string) {

            try {
                Log.trace(`Found configuration file at ${file}`, "Configuration");
                return JSON.parse(fs.readFileSync(file, "utf-8"));
            } catch (err) {
                Log.error(err, `Config ${file} invalid !`, "Configuration");
                return null;
            }
        }
    }
}