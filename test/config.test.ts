import 'mocha';

import { expect } from 'chai';
import { join, normalize } from 'path';

import { DI } from '@spinajs/di';
import { Configuration, FrameworkConfiguration } from '../src/';

function cfg() {
    return DI.resolve<Configuration>(Configuration);
}

function cfgApp() {
    return DI.resolve<Configuration>(Configuration, ["testapp", normalize(join(__dirname, "/mocks/apps"))]);
}


function cfgNoApp() {
    return DI.resolve<Configuration>(Configuration,[null,null, normalize(join(__dirname, "/mocks/config"))]);
}

class TestConfiguration extends FrameworkConfiguration {
    protected CONFIG_DIRS: string[] = [
        // project path
        "./config",
    ];
}

describe("Configuration tests", () => {

    beforeEach(() => {
        DI.clear();
        DI.register(TestConfiguration).as(Configuration);
    });

    it("Should load multiple nested files", async () => {
        const config = await cfgNoApp();
        const test = config.get(["test", "value2"]);
        expect(test).to.be.eq(666);
    });


    it("Should load config files without app specified", async () => {
        const config = await cfgNoApp();
        const test = config.get(["app", "appLoaded"]);
        expect(test).to.be.undefined;
    });


    it("Should load config files", async () => {
        const config = await cfgNoApp();
        const test = config.get(["test"]);
        const json = config.get(["jsonentry"]);

        expect(test).to.not.be.undefined;
        expect(json).to.be.true;
    });

    it("should return default value if no config property exists", async () => {

        const config = await cfgNoApp();
        const test = config.get(["test", "value3"], 111);

        expect(test).to.be.eq(111);
    });

    it("should merge two config files", async () => {
        const config = await cfgNoApp();
        const test = config.get("test.array");

        expect(test).to.include.members([1, 2, 3, 4]);
    });

    it("should run configuration function", async () => {
        const config = await cfgNoApp();
        const test = config.get("test.confFunc");

        expect(test).to.eq(true);
    });

    it("should get with dot notation", async () => {
        const config = await cfgNoApp();
        const test = config.get("test.value");

        expect(test).to.eq(1);
    });

    it("should merge application config", async () => {

        const config = await cfgApp();
        const test = config.get("app");

        expect(test).to.not.be.undefined;
    });

    it("should return undefined when no value", async () => {

        const config = await cfgNoApp();
        const test = config.get("app.undefinedValue");

        expect(test).to.be.undefined;
    });

    it("should run with app from argv", async () => {

        process.argv.push("--app");
        process.argv.push("world");
        const config = await cfg();

        expect(config.RunApp).to.eq("world");
    });

    it("should run with app basepath from argv", async () => {

        process.argv.push("--apppath");
        process.argv.push("world");
        const config = await cfg();

        expect(config.RunApp).to.eq("world");
    });
});
