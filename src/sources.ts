import { Injectable } from "@spinajs/di";
import glob = require("glob");
import { merge } from "lodash";
import _ = require("lodash");
import { join, normalize, resolve } from 'path';
import { filterDirs, findBasePath, log, uncache } from "./util";
import * as fs from 'fs';

const DEFAULT_CONFIG_DIRS = [
    // this module path
    normalize(join(resolve(__dirname), '/../config')),

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

    constructor(protected RunApp: string) {
        super();

        if (typeof this.RunApp === 'string') {
            this.CONFIG_DIRS.push(`./${this.RunApp}/config`);
        }
    }

    protected load(extension: string, callback: (file: string) => any) {

        let config = {};
        const basePath = this.RunApp ? this.BaseDir : findBasePath(process.cwd());

        this.CONFIG_DIRS.map(f => join(basePath, f))
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
            .map(_.curry(merge)(config));

        return config;
    }
}

@Injectable()
export class JsFileSource extends BaseFileSource {

    /**
   * Default dirs to check for  configuration files
   */
    protected CONFIG_DIRS: string[] = DEFAULT_CONFIG_DIRS;

    public async Load(): Promise<any> {
        const common = this.load('!(*.dev|*.prod).js', _load);

        if (process.env.NODE_ENV === "development") {
            return _.merge(common, this.load("*.dev.js", _load));
        } else {
            return _.merge(common, this.load("*.prod.js", _load));
        }

        function _load(file: string) {
            log(`Found configuration file at: ${file}`);
            uncache(file);
            return require(file);
        }
    }

}


@Injectable()
export class JsonFileSource extends BaseFileSource {

    /**
     * Default dirs to check for  configuration files
     */
    protected CONFIG_DIRS: string[] = DEFAULT_CONFIG_DIRS;

    public async Load(): Promise<any> {
        const common = this.load('!(*.dev|*.prod).json', _load);

        if (process.env.NODE_ENV === "development") {
            return _.merge(common, this.load("*.dev.json", _load));
        } else {
            return _.merge(common, this.load("*.prod.json", _load));
        }

        function _load(file: string) {
            try {
                log(`Found configuration file at: ${file}`);
                return JSON.parse(fs.readFileSync(file, "utf-8"));
            } catch (err) {
                log(`Config ${file} invalid ! Error: ${err.message}`)
                return null;
            }
        }
    }
}