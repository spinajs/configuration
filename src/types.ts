import { AsyncModule } from '@spinajs/di';

/**
 * App version struct
 */
export interface IFrameworkVersion {
    minor: number;
    major: number;
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
     * Get config value for given property. Returns any if value is present, default value if provided or null when empty
     *
     * @param path - path to property eg. ["system","dirs"] or "system" or "system.dirs"
     */
    public abstract get<T>(path: string[] | string, defaultValue?: T): T;

}
