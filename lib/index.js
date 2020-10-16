#!/usr/bin/env node
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var path = require("path");
var os = require("os");
var glob = require("glob");
var childProcess = require("child_process");
var program = require("commander");
program
    .version(require('../package.json').version)
    .description('Sync `yarn.lock` package versions, into package.json')
    .option('-d, --dir <path>', 'directory path where the yarn.lock file is located (default to current directory)')
    .option('-p, --dirPackageJson <path>', 'directory of project with target package.json, if not set, -d will be used')
    .option('-s, --save', 'By default don\'t override the package.json file, make a new one instead package.json.yarn ')
    .option('-k, --keepPrefix', 'By default the ^ or any other dynamic numbers are removed and replaced with static ones.')
    .option('-g, --keepGit', 'By default direct git repositories are also replaced by the version written in yarn.')
    .option('-l, --keepLink', 'By default direct link: repositories are also replaced by the version written in yarn.')
    .option('-a, --keepVariable <variable>', 'By default everything is converted to yarn version, write a part of the type you wish not to convert, seperate by comma if more than one, to not replace git and link you would use +,link:')
    .parse(process.argv);
var proccessVersion = function (newVersion, currentVersion) {
    if (program.keepGit && currentVersion.includes('+'))
        return currentVersion;
    if (program.keepLink && currentVersion.includes('link:'))
        return currentVersion;
    if (program.keepVariable && program.keepVariable.split(',').find(function (f) { return currentVersion.includes(f); }))
        return currentVersion;
    if (program.keepPrefix) {
        var match = currentVersion.match(/(^[\^><=~]+)/);
        var range = match ? match[0] : '';
        return range + newVersion;
    }
    return newVersion;
};
var syncDepsIntoPackageJson = function (packageJsonObject, deps) {
    deps.forEach(function (dependency) {
        var sep = dependency.name.lastIndexOf('@');
        var name = dependency.name.slice(0, sep);
        var version = dependency.name.slice(sep + 1);
        if (packageJsonObject.dependencies && name in packageJsonObject.dependencies) {
            packageJsonObject.dependencies[name] = proccessVersion(version, packageJsonObject.dependencies[name]);
        }
        else if (packageJsonObject.devDependencies && name in packageJsonObject.devDependencies) {
            packageJsonObject.devDependencies[name] = proccessVersion(version, packageJsonObject.devDependencies[name]);
        }
    });
    return packageJsonObject;
};
function getLineFeed(source) {
    var match = source.match(/\r?\n/);
    return match === null ? os.EOL : match[0];
}
function updatePackage(jsonPath, rootDeps) {
    if (!fs.existsSync(jsonPath))
        return;
    var packageJsonText = fs.readFileSync(jsonPath, 'utf8');
    var packageJson = JSON.parse(packageJsonText);
    var saveTo = path.resolve(path.dirname(jsonPath), program.save ? 'package.json' : 'package.json.yarn');
    var workspacePackageDeps = (rootDeps.find(function (dep) { return dep.name.startsWith(packageJson.name + "@"); }) || {}).children || [];
    var syncedDeps = syncDepsIntoPackageJson(packageJson, rootDeps.concat(workspacePackageDeps));
    var newPackageJsonText = (JSON.stringify(syncedDeps, null, 2) + '\n').replace(/\r?\n/g, getLineFeed(packageJsonText));
    if (!program.save || packageJsonText !== newPackageJsonText) {
        fs.writeFile(saveTo, newPackageJsonText, function (e) { return console.log('Saved %s', saveTo, e ? e : ''); });
    }
    else {
        console.log("No changes to %s", saveTo);
    }
    if (packageJson.workspaces) {
        var packagePaths = packageJson.workspaces.packages || packageJson.workspaces;
        packagePaths.forEach(function (packagePath) {
            var packages = glob.sync("" + packagePath + (packagePath.endsWith('/') ? '' : '/'), { absolute: true });
            packages.forEach(function (workspaceDir) {
                var workspacePackageJson = path.join(workspaceDir, 'package.json');
                updatePackage(workspacePackageJson, rootDeps);
            });
        });
    }
}
var dir = program.dir ? program.dir : process.cwd();
var packageDir = program.dirPackageJson ? program.dirPackageJson : dir;
var depsTree = JSON.parse(childProcess.execSync("yarn list --json --depth 1").toString()).data.trees;
updatePackage(path.resolve(packageDir, 'package.json'), depsTree);
//# sourceMappingURL=index.js.map