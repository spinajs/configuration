import { AsyncModule } from '@spinajs/di';

/**
 * App version struct
 */
export interface IFrameworkVersion {
    minor: number;
    major: number;
}

export interface ConfigurationOptions {
    /**
     * application name, pass it when you run in application mode
     * */
    app?: string;

    /**
     * configuration base dir, where to look for application configs
     */
    appBaseDir?: string;

    /**
     * custom cfg paths eg. to load config from non standard folders ( usefull in tests )
     */
    cfgCustomPaths?: string[];

    /**
     * Should watch for changes in config files
     */
    watchFileChanges? : boolean;
}

export abstract class Configuration extends AsyncModule {
    /**
     * Configuration base dir, where to look for app config
     */
    public BaseDir: string;

    /**
     * Current running app name
     */
    public RunApp: string;

    /**
     * Apps configuration base dir, where to look for app config
     */
    public AppBaseDir: string;

    /**
     * Get config value for given property. Returns any if value is present, default value if provided or null when empty
     *
     * @param path - path to property eg. ["system","dirs"] or "system" or "system.dirs"
     */
    public abstract get<T>(path: string[] | string, defaultValue?: T): T;

}
